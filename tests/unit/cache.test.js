/**
 * Unit Tests: Cache
 */
const { Cache } = require('../../src/utils/cache');

describe('Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache();
  });

  describe('memory cache (L1)', () => {
    it('should set and get values', async () => {
      await cache.set('key1', { value: 'test' });
      const result = await cache.get('key1');
      expect(result).toEqual({ value: 'test' });
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value');
      await cache.delete('key1');
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should handle multiple values', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.set('c', 3);
      expect(await cache.get('a')).toBe(1);
      expect(await cache.get('b')).toBe(2);
      expect(await cache.get('c')).toBe(3);
    });

    it('should handle complex objects', async () => {
      const obj = { nested: { deep: { value: [1, 2, 3] } } };
      await cache.set('complex', obj);
      expect(await cache.get('complex')).toEqual(obj);
    });

    it('should expire entries', async () => {
      // Set with very short TTL
      cache._setInMemory('expiring', 'value', 0);
      // Force expiration
      cache.memoryCacheTimestamps.set('expiring', Date.now() - 1000);
      const result = await cache.get('expiring');
      expect(result).toBeNull();
    });

    it('should report has() correctly', async () => {
      await cache.set('exists', 'yes');
      expect(await cache.has('exists')).toBe(true);
      expect(await cache.has('nope')).toBe(false);
    });
  });

  describe('getMultiple', () => {
    it('should get multiple values', async () => {
      await cache.set('x', 1);
      await cache.set('y', 2);
      await cache.set('z', 3);
      const results = await cache.getMultiple(['x', 'y', 'z']);
      expect(results).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should handle missing keys', async () => {
      await cache.set('a', 1);
      const results = await cache.getMultiple(['a', 'b']);
      expect(results.a).toBe(1);
      expect(results.b).toBeUndefined();
    });

    it('should handle empty keys array', async () => {
      const results = await cache.getMultiple([]);
      expect(results).toEqual({});
    });
  });

  describe('setMultiple', () => {
    it('should set multiple values', async () => {
      await cache.setMultiple({ a: 1, b: 2, c: 3 });
      expect(await cache.get('a')).toBe(1);
      expect(await cache.get('b')).toBe(2);
      expect(await cache.get('c')).toBe(3);
    });
  });

  describe('clear', () => {
    it('should clear all cached values', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.clear();
      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct stats', async () => {
      const stats = cache.getStats();
      expect(stats.memoryCacheSize).toBe(0);
      expect(stats.connected).toBe(false);

      await cache.set('a', 1);
      expect(cache.getStats().memoryCacheSize).toBe(1);
    });
  });

  describe('eviction', () => {
    it('should evict oldest entry when cache exceeds limit', () => {
      // Fill cache beyond limit
      for (let i = 0; i < 10002; i++) {
        cache._setInMemory(`key${i}`, i);
      }
      // Should have evicted some entries
      expect(cache.memoryCache.size).toBeLessThanOrEqual(10001);
    });
  });
});
