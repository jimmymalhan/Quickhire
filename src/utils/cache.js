const Redis = require('ioredis');
const config = require('./config');
const logger = require('./logger');

let redis = null;

const getRedisClient = () => {
  if (redis) {
    return redis;
  }

  redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    logger.error('Redis error', { error: err.message });
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  return redis;
};

const get = async (key) => {
  const client = getRedisClient();
  return client.get(key);
};

const set = async (key, value, ttlSeconds) => {
  const client = getRedisClient();
  if (ttlSeconds) {
    await client.set(key, value, 'EX', ttlSeconds);
  } else {
    await client.set(key, value);
  }
};

const del = async (key) => {
  const client = getRedisClient();
  await client.del(key);
};

class Cache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10000;
    this.defaultTtl = options.defaultTtl || 300000; // 5 min default
    this.memoryCache = new Map();
    this.memoryCacheTimestamps = new Map();
    this.memoryCacheTtls = new Map();
  }

  _setInMemory(key, value, ttl) {
    // Evict oldest if at capacity
    if (!this.memoryCache.has(key) && this.memoryCache.size >= this.maxSize) {
      const oldest = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldest);
      this.memoryCacheTimestamps.delete(oldest);
      this.memoryCacheTtls.delete(oldest);
    }
    this.memoryCache.set(key, value);
    this.memoryCacheTimestamps.set(key, Date.now());
    if (ttl !== undefined) {
      this.memoryCacheTtls.set(key, ttl);
    }
  }

  _isExpired(key) {
    const ts = this.memoryCacheTimestamps.get(key);
    const ttl = this.memoryCacheTtls.get(key);
    if (ts === undefined) return true;
    if (ttl !== undefined) {
      return Date.now() - ts > ttl;
    }
    return false;
  }

  async get(key) {
    if (!this.memoryCache.has(key) || this._isExpired(key)) {
      if (this.memoryCache.has(key)) {
        this.memoryCache.delete(key);
        this.memoryCacheTimestamps.delete(key);
        this.memoryCacheTtls.delete(key);
      }
      return null;
    }
    return this.memoryCache.get(key);
  }

  async set(key, value, ttl) {
    this._setInMemory(key, value, ttl);
  }

  async delete(key) {
    this.memoryCache.delete(key);
    this.memoryCacheTimestamps.delete(key);
    this.memoryCacheTtls.delete(key);
  }

  async has(key) {
    if (!this.memoryCache.has(key) || this._isExpired(key)) {
      return false;
    }
    return true;
  }

  async getMultiple(keys) {
    const result = {};
    for (const key of keys) {
      const val = await this.get(key);
      if (val !== null) {
        result[key] = val;
      }
    }
    return result;
  }

  async setMultiple(entries) {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
    }
  }

  async clear() {
    this.memoryCache.clear();
    this.memoryCacheTimestamps.clear();
    this.memoryCacheTtls.clear();
  }

  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      connected: false,
    };
  }
}

module.exports = { getRedisClient, get, set, del, Cache };
