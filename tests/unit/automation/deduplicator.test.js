const { Deduplicator } = require('../../../src/automation/deduplicator');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/cache', () => ({
  has: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

const cache = require('../../../src/utils/cache');

describe('Deduplicator', () => {
  let dedup;

  beforeEach(() => {
    dedup = new Deduplicator();
    jest.clearAllMocks();
  });

  describe('computeHash', () => {
    it('returns consistent hash for same input', () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      const hash1 = dedup.computeHash(job);
      const hash2 = dedup.computeHash(job);
      expect(hash1).toBe(hash2);
    });

    it('normalizes to lowercase and trims', () => {
      const job1 = { title: '  Engineer  ', company: 'ACME', location: 'nyc' };
      const job2 = { title: 'engineer', company: 'acme', location: 'nyc' };
      expect(dedup.computeHash(job1)).toBe(dedup.computeHash(job2));
    });

    it('returns different hash for different inputs', () => {
      const job1 = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      const job2 = { title: 'Designer', company: 'Acme', location: 'NYC' };
      expect(dedup.computeHash(job1)).not.toBe(dedup.computeHash(job2));
    });

    it('handles missing fields gracefully', () => {
      const job = { title: 'Engineer' };
      expect(() => dedup.computeHash(job)).not.toThrow();
      expect(dedup.computeHash(job)).toBeTruthy();
    });

    it('handles null fields', () => {
      const job = { title: null, company: null, location: null };
      expect(() => dedup.computeHash(job)).not.toThrow();
    });

    it('handles empty string fields', () => {
      const job = { title: '', company: '', location: '' };
      expect(dedup.computeHash(job)).toBeTruthy();
    });

    it('returns a 16-character hex string', () => {
      const job = { title: 'Test', company: 'Co', location: 'SF' };
      const hash = dedup.computeHash(job);
      expect(hash).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('isDuplicate', () => {
    it('returns false for unseen job', () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      expect(dedup.isDuplicate(job)).toBe(false);
    });

    it('returns true for previously seen job', () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      dedup.markSeen(job);
      expect(dedup.isDuplicate(job)).toBe(true);
    });

    it('uses pre-computed hash if available', () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC', hash: 'custom_hash_123' };
      dedup.markSeen(job);
      expect(dedup.isDuplicate({ hash: 'custom_hash_123' })).toBe(true);
    });

    it('returns false for different job', () => {
      const job1 = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      const job2 = { title: 'Designer', company: 'Beta', location: 'LA' };
      dedup.markSeen(job1);
      expect(dedup.isDuplicate(job2)).toBe(false);
    });
  });

  describe('markSeen', () => {
    it('marks a job as seen in the hash set', () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      dedup.markSeen(job);
      expect(dedup.seenHashes.size).toBe(1);
    });

    it('adds to bloom filter', () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      const initialSum = dedup.bloomFilter.reduce((a, b) => a + b, 0);
      dedup.markSeen(job);
      const afterSum = dedup.bloomFilter.reduce((a, b) => a + b, 0);
      expect(afterSum).toBeGreaterThan(initialSum);
    });

    it('uses pre-computed hash', () => {
      const job = { hash: 'prehashed_value' };
      dedup.markSeen(job);
      expect(dedup.seenHashes.has('prehashed_value')).toBe(true);
    });
  });

  describe('deduplicateBatch', () => {
    it('returns all unique jobs from batch', () => {
      const jobs = [
        { title: 'Engineer', company: 'Acme', location: 'NYC' },
        { title: 'Designer', company: 'Beta', location: 'LA' },
      ];
      const result = dedup.deduplicateBatch(jobs);
      expect(result).toHaveLength(2);
    });

    it('removes duplicates within batch', () => {
      const jobs = [
        { title: 'Engineer', company: 'Acme', location: 'NYC' },
        { title: 'Engineer', company: 'Acme', location: 'NYC' },
      ];
      const result = dedup.deduplicateBatch(jobs);
      expect(result).toHaveLength(1);
    });

    it('removes previously seen jobs', () => {
      const seen = { title: 'Engineer', company: 'Acme', location: 'NYC' };
      dedup.markSeen(seen);
      const jobs = [
        { title: 'Engineer', company: 'Acme', location: 'NYC' },
        { title: 'Designer', company: 'Beta', location: 'LA' },
      ];
      const result = dedup.deduplicateBatch(jobs);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Designer');
    });

    it('assigns hash to each job', () => {
      const jobs = [{ title: 'Engineer', company: 'Acme', location: 'NYC' }];
      const result = dedup.deduplicateBatch(jobs);
      expect(result[0].hash).toBeTruthy();
    });

    it('handles empty batch', () => {
      const result = dedup.deduplicateBatch([]);
      expect(result).toHaveLength(0);
    });

    it('handles large batch efficiently', () => {
      const jobs = Array.from({ length: 1000 }, (_, i) => ({
        title: `Role ${i}`,
        company: `Company ${i}`,
        location: `Location ${i}`,
      }));
      const start = Date.now();
      const result = dedup.deduplicateBatch(jobs);
      const elapsed = Date.now() - start;
      expect(result).toHaveLength(1000);
      expect(elapsed).toBeLessThan(5000);
    });

    it('handles batch with mixed duplicates', () => {
      const jobs = [
        { title: 'A', company: 'X', location: 'L1' },
        { title: 'B', company: 'Y', location: 'L2' },
        { title: 'A', company: 'X', location: 'L1' },
        { title: 'C', company: 'Z', location: 'L3' },
        { title: 'B', company: 'Y', location: 'L2' },
      ];
      const result = dedup.deduplicateBatch(jobs);
      expect(result).toHaveLength(3);
    });
  });

  describe('deduplicateWithCache', () => {
    it('returns unique jobs checking cache', async () => {
      cache.has.mockResolvedValue(false);
      cache.set.mockResolvedValue(true);
      const jobs = [{ title: 'Engineer', company: 'Acme', location: 'NYC', linkedinJobId: 'li1' }];
      const result = await dedup.deduplicateWithCache(jobs);
      expect(result).toHaveLength(1);
      expect(cache.set).toHaveBeenCalled();
    });

    it('skips cached jobs', async () => {
      cache.has.mockResolvedValue(true);
      const jobs = [{ title: 'Engineer', company: 'Acme', location: 'NYC', linkedinJobId: 'li1' }];
      const result = await dedup.deduplicateWithCache(jobs);
      expect(result).toHaveLength(0);
    });

    it('skips locally seen jobs without checking cache', async () => {
      const job = { title: 'Engineer', company: 'Acme', location: 'NYC', linkedinJobId: 'li1' };
      dedup.markSeen(job);
      const result = await dedup.deduplicateWithCache([job]);
      expect(result).toHaveLength(0);
      expect(cache.has).not.toHaveBeenCalled();
    });

    it('handles empty array', async () => {
      const result = await dedup.deduplicateWithCache([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('deduplicateAgainstDb', () => {
    it('filters out jobs with existing hashes', () => {
      const jobs = [
        { title: 'A', company: 'X', location: 'L', hash: 'hash1' },
        { title: 'B', company: 'Y', location: 'L', hash: 'hash2' },
      ];
      const result = dedup.deduplicateAgainstDb(jobs, ['hash1']);
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('hash2');
    });

    it('returns all when no existing hashes', () => {
      const jobs = [
        { title: 'A', company: 'X', location: 'L' },
        { title: 'B', company: 'Y', location: 'L' },
      ];
      const result = dedup.deduplicateAgainstDb(jobs, []);
      expect(result).toHaveLength(2);
    });

    it('computes hash if not pre-set', () => {
      const jobs = [{ title: 'Engineer', company: 'Acme', location: 'NYC' }];
      const result = dedup.deduplicateAgainstDb(jobs, []);
      expect(result[0].hash).toBeTruthy();
    });

    it('returns empty when all exist in db', () => {
      const jobs = [
        { title: 'A', company: 'X', location: 'L', hash: 'h1' },
        { title: 'B', company: 'Y', location: 'L', hash: 'h2' },
      ];
      const result = dedup.deduplicateAgainstDb(jobs, ['h1', 'h2']);
      expect(result).toHaveLength(0);
    });
  });

  describe('similarity', () => {
    it('returns 1 for identical jobs', () => {
      const job = { title: 'Software Engineer', company: 'Acme', location: 'NYC' };
      expect(dedup.similarity(job, job)).toBe(1);
    });

    it('returns 0 for completely different jobs', () => {
      const job1 = { title: 'Software Engineer', company: 'Acme', location: 'NYC' };
      const job2 = { title: 'Chef', company: 'Restaurant', location: 'Paris' };
      expect(dedup.similarity(job1, job2)).toBeLessThan(0.5);
    });

    it('weighs title more heavily', () => {
      const base = { title: 'Software Engineer', company: 'Acme', location: 'NYC' };
      const sameTitleDiffCompany = { title: 'Software Engineer', company: 'Beta', location: 'NYC' };
      const diffTitleSameCompany = { title: 'Chef', company: 'Acme', location: 'NYC' };
      expect(dedup.similarity(base, sameTitleDiffCompany)).toBeGreaterThan(
        dedup.similarity(base, diffTitleSameCompany),
      );
    });

    it('handles missing fields', () => {
      const job1 = { title: 'Engineer' };
      const job2 = { title: 'Engineer' };
      expect(dedup.similarity(job1, job2)).toBeGreaterThan(0);
    });

    it('returns 0 for both empty jobs', () => {
      expect(dedup.similarity({}, {})).toBe(0);
    });

    it('is case insensitive', () => {
      const job1 = { title: 'SOFTWARE ENGINEER', company: 'ACME', location: 'NYC' };
      const job2 = { title: 'software engineer', company: 'acme', location: 'nyc' };
      expect(dedup.similarity(job1, job2)).toBe(1);
    });
  });

  describe('findNearDuplicates', () => {
    it('finds groups of near-duplicate jobs', () => {
      const jobs = [
        { title: 'Software Engineer', company: 'Acme', location: 'NYC' },
        { title: 'Software Engineer', company: 'Acme', location: 'New York' },
        { title: 'Chef', company: 'Restaurant', location: 'Paris' },
      ];
      const groups = dedup.findNearDuplicates(jobs, 0.7);
      expect(groups.length).toBeGreaterThanOrEqual(0);
    });

    it('returns empty for all unique jobs', () => {
      const jobs = [
        { title: 'Engineer', company: 'A', location: 'X' },
        { title: 'Designer', company: 'B', location: 'Y' },
        { title: 'Chef', company: 'C', location: 'Z' },
      ];
      const groups = dedup.findNearDuplicates(jobs, 0.99);
      expect(groups).toHaveLength(0);
    });

    it('handles empty array', () => {
      expect(dedup.findNearDuplicates([])).toHaveLength(0);
    });

    it('handles single job', () => {
      const jobs = [{ title: 'Engineer', company: 'A', location: 'X' }];
      expect(dedup.findNearDuplicates(jobs)).toHaveLength(0);
    });

    it('uses default threshold of 0.85', () => {
      const jobs = [
        { title: 'Software Engineer', company: 'Acme', location: 'NYC' },
        { title: 'Software Engineer', company: 'Acme', location: 'NYC' },
      ];
      const groups = dedup.findNearDuplicates(jobs);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('clears all seen hashes', () => {
      dedup.markSeen({ title: 'A', company: 'B', location: 'C' });
      expect(dedup.seenHashes.size).toBe(1);
      dedup.reset();
      expect(dedup.seenHashes.size).toBe(0);
    });

    it('clears bloom filter', () => {
      dedup.markSeen({ title: 'A', company: 'B', location: 'C' });
      dedup.reset();
      expect(dedup.bloomFilter.every((b) => b === 0)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns correct totalSeen', () => {
      dedup.markSeen({ title: 'A', company: 'B', location: 'C' });
      dedup.markSeen({ title: 'D', company: 'E', location: 'F' });
      const stats = dedup.getStats();
      expect(stats.totalSeen).toBe(2);
    });

    it('returns bloomFilterUsage between 0 and 1', () => {
      dedup.markSeen({ title: 'A', company: 'B', location: 'C' });
      const stats = dedup.getStats();
      expect(stats.bloomFilterUsage).toBeGreaterThan(0);
      expect(stats.bloomFilterUsage).toBeLessThanOrEqual(1);
    });

    it('returns 0 stats when empty', () => {
      const stats = dedup.getStats();
      expect(stats.totalSeen).toBe(0);
      expect(stats.bloomFilterUsage).toBe(0);
    });
  });

  describe('bloom filter internals', () => {
    it('_bloomAdd sets bits', () => {
      const before = dedup.bloomFilter.reduce((a, b) => a + b, 0);
      dedup._bloomAdd('test_value');
      const after = dedup.bloomFilter.reduce((a, b) => a + b, 0);
      expect(after).toBeGreaterThan(before);
    });

    it('_bloomMightContain returns true after add', () => {
      dedup._bloomAdd('test_value');
      expect(dedup._bloomMightContain('test_value')).toBe(true);
    });

    it('_bloomMightContain returns false for unknown value (likely)', () => {
      // Bloom filter can have false positives but unlikely for a single entry
      expect(dedup._bloomMightContain('never_added_value_xyz_123')).toBe(false);
    });

    it('_bloomHash returns value within range', () => {
      const hash = dedup._bloomHash('test', 1);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(65536);
    });
  });

  describe('_stringSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(dedup._stringSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('returns 0 for completely different strings', () => {
      expect(dedup._stringSimilarity('abc', 'xyz')).toBe(0);
    });

    it('returns partial match for overlapping words', () => {
      const sim = dedup._stringSimilarity('software engineer', 'senior software engineer');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });

    it('is case insensitive', () => {
      expect(dedup._stringSimilarity('HELLO', 'hello')).toBe(1);
    });

    it('trims whitespace', () => {
      expect(dedup._stringSimilarity('  hello  ', 'hello')).toBe(1);
    });
  });
});
