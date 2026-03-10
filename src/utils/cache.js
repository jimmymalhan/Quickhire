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

module.exports = { getRedisClient, get, set, del };
