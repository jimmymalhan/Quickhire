/**
 * Job Deduplication Engine
 * Ensures no duplicate jobs are stored or processed
 */
const crypto = require('crypto');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

class Deduplicator {
  constructor() {
    this.seenHashes = new Set();
    this.bloomFilter = new Array(65536).fill(0); // Simple bloom filter
    this.hashFunctions = 3;
  }

  /**
   * Compute content hash for a job
   */
  computeHash(job) {
    const normalized = [
      (job.title || '').toLowerCase().trim(),
      (job.company || '').toLowerCase().trim(),
      (job.location || '').toLowerCase().trim(),
    ].join('|');
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if a job is a duplicate
   */
  isDuplicate(job) {
    const hash = job.hash || this.computeHash(job);

    // Quick bloom filter check
    if (!this._bloomMightContain(hash)) {
      return false;
    }

    return this.seenHashes.has(hash);
  }

  /**
   * Mark a job as seen
   */
  markSeen(job) {
    const hash = job.hash || this.computeHash(job);
    this.seenHashes.add(hash);
    this._bloomAdd(hash);
  }

  /**
   * Deduplicate a batch of jobs, returns unique jobs only
   */
  deduplicateBatch(jobs) {
    const unique = [];
    const batchHashes = new Set();

    for (const job of jobs) {
      const hash = job.hash || this.computeHash(job);
      job.hash = hash;

      // Skip if seen in this batch or previously
      if (batchHashes.has(hash) || this.isDuplicate(job)) {
        logger.debug('Duplicate job skipped', { title: job.title, company: job.company, hash });
        continue;
      }

      batchHashes.add(hash);
      this.markSeen(job);
      unique.push(job);
    }

    logger.info('Deduplication complete', {
      input: jobs.length,
      unique: unique.length,
      duplicates: jobs.length - unique.length,
    });

    return unique;
  }

  /**
   * Check duplicates against cache
   */
  async deduplicateWithCache(jobs) {
    const unique = [];

    for (const job of jobs) {
      const hash = job.hash || this.computeHash(job);
      job.hash = hash;
      const cacheKey = `job:hash:${hash}`;

      // Check local set first (fast)
      if (this.seenHashes.has(hash)) {
        continue;
      }

      // Check cache
      const cached = await cache.has(cacheKey);
      if (cached) {
        this.markSeen(job);
        continue;
      }

      // New job
      this.markSeen(job);
      await cache.set(cacheKey, { id: job.linkedinJobId, title: job.title }, 86400);
      unique.push(job);
    }

    return unique;
  }

  /**
   * Check duplicates against database hashes
   */
  deduplicateAgainstDb(jobs, existingHashes) {
    const dbHashSet = new Set(existingHashes);
    return jobs.filter((job) => {
      const hash = job.hash || this.computeHash(job);
      job.hash = hash;
      return !dbHashSet.has(hash);
    });
  }

  /**
   * Compute similarity score between two jobs (0-1)
   */
  similarity(job1, job2) {
    let score = 0;
    let total = 0;

    // Title similarity
    if (job1.title && job2.title) {
      score += this._stringSimilarity(job1.title, job2.title) * 3; // weighted
      total += 3;
    }

    // Company exact match
    if (job1.company && job2.company) {
      score += job1.company.toLowerCase().trim() === job2.company.toLowerCase().trim() ? 2 : 0;
      total += 2;
    }

    // Location similarity
    if (job1.location && job2.location) {
      score += this._stringSimilarity(job1.location, job2.location);
      total += 1;
    }

    return total > 0 ? score / total : 0;
  }

  /**
   * Find near-duplicates in a batch using similarity threshold
   */
  findNearDuplicates(jobs, threshold = 0.85) {
    const groups = [];
    const assigned = new Set();

    for (let i = 0; i < jobs.length; i++) {
      if (assigned.has(i)) {
        continue;
      }
      const group = [i];
      assigned.add(i);

      for (let j = i + 1; j < jobs.length; j++) {
        if (assigned.has(j)) {
          continue;
        }
        if (this.similarity(jobs[i], jobs[j]) >= threshold) {
          group.push(j);
          assigned.add(j);
        }
      }

      if (group.length > 1) {
        groups.push(group.map((idx) => jobs[idx]));
      }
    }

    return groups;
  }

  /**
   * Reset the deduplication state
   */
  reset() {
    this.seenHashes.clear();
    this.bloomFilter.fill(0);
  }

  getStats() {
    return {
      totalSeen: this.seenHashes.size,
      bloomFilterUsage: this.bloomFilter.filter((b) => b > 0).length / this.bloomFilter.length,
    };
  }

  // --- Bloom filter helpers ---

  _bloomHash(value, seed) {
    let hash = seed;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % this.bloomFilter.length;
  }

  _bloomAdd(value) {
    for (let i = 0; i < this.hashFunctions; i++) {
      this.bloomFilter[this._bloomHash(value, i + 1)] = 1;
    }
  }

  _bloomMightContain(value) {
    for (let i = 0; i < this.hashFunctions; i++) {
      if (this.bloomFilter[this._bloomHash(value, i + 1)] === 0) {
        return false;
      }
    }
    return true;
  }

  _stringSimilarity(a, b) {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) {
      return 1;
    }

    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = [...words1].filter((w) => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? intersection / union : 0;
  }
}

module.exports = new Deduplicator();
module.exports.Deduplicator = Deduplicator;
