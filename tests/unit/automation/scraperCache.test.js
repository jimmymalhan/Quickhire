/**
 * Unit tests for ScraperCache
 */
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const ScraperCache = require('../../../src/automation/scraperCache');
const { DEFAULT_TTL_MS } = require('../../../src/automation/scraperCache');

describe('ScraperCache', () => {
  let cache;

  beforeEach(() => {
    cache = new ScraperCache({ ttlMs: 1000, maxSize: 5 });
  });

  describe('constructor', () => {
    it('should use default TTL', () => {
      const c = new ScraperCache();
      expect(c.ttlMs).toBe(DEFAULT_TTL_MS);
    });

    it('should use custom TTL', () => {
      expect(cache.ttlMs).toBe(1000);
    });

    it('should use custom maxSize', () => {
      expect(cache.maxSize).toBe(5);
    });

    it('should default maxSize to 1000', () => {
      const c = new ScraperCache();
      expect(c.maxSize).toBe(1000);
    });

    it('should start with empty store', () => {
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve data', async () => {
      const params = { keywords: 'dev', location: 'NYC' };
      const data = [{ title: 'Job1' }];

      await cache.set(params, data);
      const result = await cache.get(params);
      expect(result).toEqual(data);
    });

    it('should return null for missing key', async () => {
      const result = await cache.get({ keywords: 'nonexistent' });
      expect(result).toBeNull();
    });

    it('should return null for expired entry', async () => {
      const shortCache = new ScraperCache({ ttlMs: 10 });
      await shortCache.set({ keywords: 'test' }, [{ data: true }]);

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 50));
      const result = await shortCache.get({ keywords: 'test' });
      expect(result).toBeNull();
    });

    it('should overwrite existing entry', async () => {
      const params = { keywords: 'dev' };
      await cache.set(params, [{ v: 1 }]);
      await cache.set(params, [{ v: 2 }]);

      const result = await cache.get(params);
      expect(result).toEqual([{ v: 2 }]);
    });

    it('should distinguish different search params', async () => {
      await cache.set({ keywords: 'a' }, [{ k: 'a' }]);
      await cache.set({ keywords: 'b' }, [{ k: 'b' }]);

      expect(await cache.get({ keywords: 'a' })).toEqual([{ k: 'a' }]);
      expect(await cache.get({ keywords: 'b' })).toEqual([{ k: 'b' }]);
    });
  });

  describe('_makeKey', () => {
    it('should generate key from params', () => {
      const key = cache._makeKey({ keywords: 'dev', location: 'NYC' });
      expect(key).toContain('scraper:');
      expect(key).toContain('dev');
      expect(key).toContain('NYC');
    });

    it('should include page in key', () => {
      const key1 = cache._makeKey({ keywords: 'dev', page: 1 });
      const key2 = cache._makeKey({ keywords: 'dev', page: 2 });
      expect(key1).not.toBe(key2);
    });

    it('should handle missing params', () => {
      const key = cache._makeKey({});
      expect(key).toContain('scraper:');
    });

    it('should include jobType', () => {
      const key = cache._makeKey({ jobType: 'F' });
      expect(key).toContain('F');
    });
  });

  describe('invalidate', () => {
    it('should remove cached entry', async () => {
      const params = { keywords: 'dev' };
      await cache.set(params, [{ data: true }]);
      await cache.invalidate(params);

      const result = await cache.get(params);
      expect(result).toBeNull();
    });

    it('should not affect other entries', async () => {
      await cache.set({ keywords: 'a' }, [{ k: 'a' }]);
      await cache.set({ keywords: 'b' }, [{ k: 'b' }]);
      await cache.invalidate({ keywords: 'a' });

      expect(await cache.get({ keywords: 'a' })).toBeNull();
      expect(await cache.get({ keywords: 'b' })).toEqual([{ k: 'b' }]);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set({ keywords: 'a' }, [1]);
      await cache.set({ keywords: 'b' }, [2]);
      await cache.clear();

      expect(await cache.get({ keywords: 'a' })).toBeNull();
      expect(await cache.get({ keywords: 'b' })).toBeNull();
    });

    it('should reset stats', async () => {
      await cache.set({ keywords: 'a' }, [1]);
      await cache.clear();

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct total entries', async () => {
      await cache.set({ keywords: 'a' }, [1]);
      await cache.set({ keywords: 'b' }, [2]);

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
    });

    it('should track active vs stale entries', async () => {
      const shortCache = new ScraperCache({ ttlMs: 20 });
      await shortCache.set({ keywords: 'a' }, [1]);
      await new Promise((r) => setTimeout(r, 50));
      await shortCache.set({ keywords: 'b' }, [2]);

      const stats = shortCache.getStats();
      expect(stats.activeEntries).toBe(1);
      expect(stats.staleEntries).toBe(1);
    });

    it('should report maxSize', () => {
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(5);
    });

    it('should report ttlMs', () => {
      const stats = cache.getStats();
      expect(stats.ttlMs).toBe(1000);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', async () => {
      for (let i = 0; i < 6; i++) {
        await cache.set({ keywords: `key${i}` }, [i]);
      }

      // First entry should be evicted
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(5);
    });
  });

  describe('Redis integration', () => {
    it('should work without Redis', async () => {
      await cache.set({ keywords: 'test' }, [{ data: true }]);
      const result = await cache.get({ keywords: 'test' });
      expect(result).toEqual([{ data: true }]);
    });

    it('should accept Redis client', () => {
      const mockRedis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
      cache.setRedisClient(mockRedis);
      expect(cache._redis).toBe(mockRedis);
    });

    it('should read from Redis when memory misses', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(JSON.stringify([{ fromRedis: true }])),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      };
      cache.setRedisClient(mockRedis);

      const result = await cache.get({ keywords: 'test' });
      expect(result).toEqual([{ fromRedis: true }]);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should write to Redis on set', async () => {
      const mockRedis = {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn(),
      };
      cache.setRedisClient(mockRedis);

      await cache.set({ keywords: 'test' }, [{ data: true }]);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should handle Redis read errors gracefully', async () => {
      const mockRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis down')),
        set: jest.fn(),
        del: jest.fn(),
      };
      cache.setRedisClient(mockRedis);

      const result = await cache.get({ keywords: 'fail' });
      expect(result).toBeNull(); // Should not throw
    });

    it('should handle Redis write errors gracefully', async () => {
      const mockRedis = {
        get: jest.fn(),
        set: jest.fn().mockRejectedValue(new Error('Redis down')),
        del: jest.fn(),
      };
      cache.setRedisClient(mockRedis);

      // Should not throw
      await expect(cache.set({ keywords: 'test' }, [1])).resolves.toBeUndefined();
    });

    it('should delete from Redis on invalidate', async () => {
      const mockRedis = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn().mockResolvedValue(1),
      };
      cache.setRedisClient(mockRedis);

      await cache.invalidate({ keywords: 'test' });
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('DEFAULT_TTL_MS', () => {
    it('should be 5 minutes', () => {
      expect(DEFAULT_TTL_MS).toBe(5 * 60 * 1000);
    });
  });
});
