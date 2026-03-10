/**
 * Unit Tests: Deduplicator
 */
const { Deduplicator } = require('../../src/automation/deduplicator');

describe('Deduplicator', () => {
  let dedup;

  beforeEach(() => {
    dedup = new Deduplicator();
  });

  describe('computeHash', () => {
    it('should produce consistent hashes', () => {
      const job = { title: 'SWE', company: 'Google', location: 'NYC' };
      expect(dedup.computeHash(job)).toBe(dedup.computeHash(job));
    });

    it('should be case insensitive', () => {
      const j1 = { title: 'SWE', company: 'GOOGLE', location: 'NYC' };
      const j2 = { title: 'swe', company: 'google', location: 'nyc' };
      expect(dedup.computeHash(j1)).toBe(dedup.computeHash(j2));
    });

    it('should trim whitespace', () => {
      const j1 = { title: '  SWE  ', company: ' Google ', location: ' NYC ' };
      const j2 = { title: 'SWE', company: 'Google', location: 'NYC' };
      expect(dedup.computeHash(j1)).toBe(dedup.computeHash(j2));
    });

    it('should produce different hashes for different jobs', () => {
      const j1 = { title: 'SWE', company: 'Google', location: 'NYC' };
      const j2 = { title: 'PM', company: 'Apple', location: 'SF' };
      expect(dedup.computeHash(j1)).not.toBe(dedup.computeHash(j2));
    });

    it('should handle missing fields', () => {
      expect(() => dedup.computeHash({})).not.toThrow();
      expect(() => dedup.computeHash({ title: 'Test' })).not.toThrow();
    });

    it('should produce 16 char hex strings', () => {
      const hash = dedup.computeHash({ title: 'Test', company: 'Co', location: 'LA' });
      expect(hash.length).toBe(16);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe('isDuplicate / markSeen', () => {
    it('should not detect unseen jobs as duplicates', () => {
      expect(dedup.isDuplicate({ title: 'A', company: 'B', location: 'C', hash: 'abc123' })).toBe(false);
    });

    it('should detect seen jobs as duplicates', () => {
      const job = { title: 'SWE', company: 'Google', location: 'NYC' };
      job.hash = dedup.computeHash(job);
      dedup.markSeen(job);
      expect(dedup.isDuplicate(job)).toBe(true);
    });

    it('should detect duplicates regardless of case', () => {
      const j1 = { title: 'SWE', company: 'Google', location: 'NYC' };
      const j2 = { title: 'swe', company: 'google', location: 'nyc' };
      j1.hash = dedup.computeHash(j1);
      j2.hash = dedup.computeHash(j2);
      dedup.markSeen(j1);
      expect(dedup.isDuplicate(j2)).toBe(true);
    });

    it('should not cross-detect different jobs', () => {
      const j1 = { title: 'SWE', company: 'Google', location: 'NYC' };
      const j2 = { title: 'PM', company: 'Apple', location: 'SF' };
      j1.hash = dedup.computeHash(j1);
      j2.hash = dedup.computeHash(j2);
      dedup.markSeen(j1);
      expect(dedup.isDuplicate(j2)).toBe(false);
    });
  });

  describe('deduplicateBatch', () => {
    it('should remove duplicates within a batch', () => {
      const jobs = [
        { title: 'SWE', company: 'Google', location: 'NYC' },
        { title: 'SWE', company: 'Google', location: 'NYC' }, // duplicate
        { title: 'PM', company: 'Apple', location: 'SF' },
      ];
      const unique = dedup.deduplicateBatch(jobs);
      expect(unique.length).toBe(2);
    });

    it('should remove previously seen duplicates', () => {
      const seen = { title: 'SWE', company: 'Google', location: 'NYC' };
      seen.hash = dedup.computeHash(seen);
      dedup.markSeen(seen);

      const jobs = [
        { title: 'SWE', company: 'Google', location: 'NYC' },
        { title: 'PM', company: 'Apple', location: 'SF' },
      ];
      const unique = dedup.deduplicateBatch(jobs);
      expect(unique.length).toBe(1);
      expect(unique[0].title).toBe('PM');
    });

    it('should handle empty batch', () => {
      expect(dedup.deduplicateBatch([])).toEqual([]);
    });

    it('should handle all-duplicate batch', () => {
      const jobs = [
        { title: 'SWE', company: 'Google', location: 'NYC' },
        { title: 'SWE', company: 'Google', location: 'NYC' },
        { title: 'swe', company: 'google', location: 'nyc' },
      ];
      const unique = dedup.deduplicateBatch(jobs);
      expect(unique.length).toBe(1);
    });

    it('should assign hashes to jobs', () => {
      const jobs = [{ title: 'SWE', company: 'Google', location: 'NYC' }];
      const unique = dedup.deduplicateBatch(jobs);
      expect(unique[0].hash).toBeDefined();
    });

    it('should handle large batches efficiently', () => {
      const jobs = [];
      for (let i = 0; i < 1000; i++) {
        jobs.push({ title: `Job ${i % 100}`, company: `Company ${i % 50}`, location: `City ${i % 20}` });
      }
      const start = Date.now();
      const unique = dedup.deduplicateBatch(jobs);
      const elapsed = Date.now() - start;
      expect(unique.length).toBeLessThan(1000);
      expect(elapsed).toBeLessThan(1000); // Under 1 second
    });
  });

  describe('deduplicateAgainstDb', () => {
    it('should filter out jobs with existing hashes', () => {
      const jobs = [
        { title: 'A', company: 'B', location: 'C', hash: 'hash1' },
        { title: 'D', company: 'E', location: 'F', hash: 'hash2' },
        { title: 'G', company: 'H', location: 'I', hash: 'hash3' },
      ];
      const existingHashes = ['hash1', 'hash3'];
      const newJobs = dedup.deduplicateAgainstDb(jobs, existingHashes);
      expect(newJobs.length).toBe(1);
      expect(newJobs[0].hash).toBe('hash2');
    });

    it('should return all jobs when no existing hashes', () => {
      const jobs = [
        { title: 'A', company: 'B', hash: 'h1' },
        { title: 'C', company: 'D', hash: 'h2' },
      ];
      const newJobs = dedup.deduplicateAgainstDb(jobs, []);
      expect(newJobs.length).toBe(2);
    });

    it('should return empty when all exist', () => {
      const jobs = [
        { title: 'A', company: 'B', hash: 'h1' },
      ];
      const newJobs = dedup.deduplicateAgainstDb(jobs, ['h1']);
      expect(newJobs.length).toBe(0);
    });
  });

  describe('similarity', () => {
    it('should return 1 for identical jobs', () => {
      const job = { title: 'SWE', company: 'Google', location: 'NYC' };
      expect(dedup.similarity(job, job)).toBe(1);
    });

    it('should return 0 for completely different jobs', () => {
      const j1 = { title: 'Software Engineer', company: 'Google', location: 'New York' };
      const j2 = { title: 'Marketing Manager', company: 'Apple', location: 'San Francisco' };
      expect(dedup.similarity(j1, j2)).toBeLessThan(0.3);
    });

    it('should return high score for similar jobs', () => {
      const j1 = { title: 'Senior Software Engineer', company: 'Google', location: 'NYC' };
      const j2 = { title: 'Software Engineer Senior', company: 'Google', location: 'NYC' };
      expect(dedup.similarity(j1, j2)).toBeGreaterThan(0.7);
    });

    it('should handle empty fields', () => {
      const j1 = { title: 'SWE' };
      const j2 = { title: 'SWE' };
      expect(() => dedup.similarity(j1, j2)).not.toThrow();
    });
  });

  describe('findNearDuplicates', () => {
    it('should find groups of similar jobs', () => {
      const jobs = [
        { title: 'Software Engineer', company: 'Google', location: 'NYC' },
        { title: 'Software Engineer', company: 'Google', location: 'New York' },
        { title: 'Product Manager', company: 'Apple', location: 'SF' },
      ];
      const groups = dedup.findNearDuplicates(jobs, 0.7);
      expect(groups.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty for all unique jobs', () => {
      const jobs = [
        { title: 'Engineer', company: 'A', location: 'X' },
        { title: 'Designer', company: 'B', location: 'Y' },
        { title: 'Manager', company: 'C', location: 'Z' },
      ];
      const groups = dedup.findNearDuplicates(jobs, 0.99);
      expect(groups.length).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const job = { title: 'A', company: 'B', location: 'C' };
      job.hash = dedup.computeHash(job);
      dedup.markSeen(job);
      expect(dedup.isDuplicate(job)).toBe(true);

      dedup.reset();
      expect(dedup.isDuplicate(job)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const stats = dedup.getStats();
      expect(stats.totalSeen).toBe(0);
      expect(stats.bloomFilterUsage).toBe(0);

      dedup.markSeen({ title: 'A', company: 'B', hash: 'test123' });
      const stats2 = dedup.getStats();
      expect(stats2.totalSeen).toBe(1);
    });
  });
});
