/**
 * Scraper Cache
 * In-memory + Redis caching for scraped job results with TTL
 */
const logger = require('../utils/logger');

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class ScraperCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    this.maxSize = options.maxSize || 1000;
    this._store = new Map();
    this._redis = null;
  }

  /**
   * Set a Redis client for distributed caching
   */
  setRedisClient(redisClient) {
    this._redis = redisClient;
  }

  /**
   * Generate cache key from search params
   */
  _makeKey(params) {
    const parts = [
      params.keywords || '',
      params.location || '',
      params.jobType || '',
      params.experienceLevel || '',
      String(params.page || 1),
    ];
    return `scraper:${parts.join(':')}`;
  }

  /**
   * Get cached result
   */
  async get(params) {
    const key = this._makeKey(params);

    // Check in-memory first
    const memEntry = this._store.get(key);
    if (memEntry && Date.now() - memEntry.timestamp < this.ttlMs) {
      logger.debug('Cache hit (memory)', { key });
      return memEntry.data;
    }

    // Evict stale memory entry
    if (memEntry) {
      this._store.delete(key);
    }

    // Check Redis
    if (this._redis) {
      try {
        const redisData = await this._redis.get(key);
        if (redisData) {
          const parsed = JSON.parse(redisData);
          // Populate memory cache
          this._setMemory(key, parsed);
          logger.debug('Cache hit (redis)', { key });
          return parsed;
        }
      } catch (err) {
        logger.warn('Redis cache read error', { error: err.message });
      }
    }

    return null;
  }

  /**
   * Store result in cache
   */
  async set(params, data) {
    const key = this._makeKey(params);

    this._setMemory(key, data);

    // Store in Redis with TTL
    if (this._redis) {
      try {
        const ttlSeconds = Math.ceil(this.ttlMs / 1000);
        await this._redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        logger.debug('Cache set (redis)', { key, ttlSeconds });
      } catch (err) {
        logger.warn('Redis cache write error', { error: err.message });
      }
    }
  }

  /**
   * Store in memory cache with LRU eviction
   */
  _setMemory(key, data) {
    // Evict oldest if at capacity
    if (this._store.size >= this.maxSize) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
    }

    this._store.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(params) {
    const key = this._makeKey(params);
    this._store.delete(key);

    if (this._redis) {
      try {
        await this._redis.del(key);
      } catch (err) {
        logger.warn('Redis cache delete error', { error: err.message });
      }
    }
  }

  /**
   * Clear all cached data
   */
  async clear() {
    this._store.clear();

    if (this._redis) {
      try {
        // Only clear scraper keys
        const keys = await this._redis.keys('scraper:*');
        if (keys.length > 0) {
          await this._redis.del(...keys);
        }
      } catch (err) {
        logger.warn('Redis cache clear error', { error: err.message });
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let activeEntries = 0;
    const now = Date.now();

    for (const [, entry] of this._store) {
      if (now - entry.timestamp < this.ttlMs) {
        activeEntries++;
      }
    }

    return {
      totalEntries: this._store.size,
      activeEntries,
      staleEntries: this._store.size - activeEntries,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

module.exports = ScraperCache;
module.exports.DEFAULT_TTL_MS = DEFAULT_TTL_MS;
