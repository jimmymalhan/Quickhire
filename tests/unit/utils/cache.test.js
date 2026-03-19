/**
 * Unit tests for src/utils/cache.js
 * Tests the Redis cache wrapper with mocked dependencies.
 *
 * We disable MOCK_REDIS so cache.js exercises the real ioredis code path
 * (which is itself mocked via jest.mock('ioredis')).
 */
const _originalMockRedis = process.env.MOCK_REDIS;
process.env.MOCK_REDIS = 'false';

// Mock ioredis
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedisInstance);
});

// Mock config
jest.mock('../../../src/utils/config', () => ({
  redis: {
    host: 'localhost',
    port: 6379,
    password: undefined,
  },
  logging: {
    level: 'error',
    format: 'json',
    toFile: false,
    filePath: './logs',
  },
  env: 'test',
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('cache - module exports', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-setup mocks after reset
    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedisInstance);
    });
    jest.mock('../../../src/utils/config', () => ({
      redis: { host: 'localhost', port: 6379, password: undefined },
      logging: { level: 'error', format: 'json', toFile: false, filePath: './logs' },
      env: 'test',
    }));
    jest.mock('../../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }));

    cache = require('../../../src/utils/cache');
  });

  test('exports getRedisClient, get, set, del', () => {
    expect(cache.getRedisClient).toBeDefined();
    expect(cache.get).toBeDefined();
    expect(cache.set).toBeDefined();
    expect(cache.del).toBeDefined();
    expect(typeof cache.getRedisClient).toBe('function');
    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
    expect(typeof cache.del).toBe('function');
  });
});

describe('cache - getRedisClient', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedisInstance);
    });
    jest.mock('../../../src/utils/config', () => ({
      redis: { host: 'localhost', port: 6379, password: undefined },
      logging: { level: 'error', format: 'json', toFile: false, filePath: './logs' },
      env: 'test',
    }));
    jest.mock('../../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }));

    cache = require('../../../src/utils/cache');
  });

  test('returns a redis client', () => {
    const client = cache.getRedisClient();
    expect(client).toBeDefined();
    expect(client).toHaveProperty('get');
    expect(client).toHaveProperty('set');
    expect(client).toHaveProperty('del');
  });

  test('returns the same instance on subsequent calls', () => {
    const client1 = cache.getRedisClient();
    const client2 = cache.getRedisClient();
    expect(client1).toBe(client2);
  });

  test('registers error and connect event handlers', () => {
    cache.getRedisClient();
    expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });
});

describe('cache - get', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedisInstance);
    });
    jest.mock('../../../src/utils/config', () => ({
      redis: { host: 'localhost', port: 6379, password: undefined },
      logging: { level: 'error', format: 'json', toFile: false, filePath: './logs' },
      env: 'test',
    }));
    jest.mock('../../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }));

    cache = require('../../../src/utils/cache');
  });

  test('calls redis get with the key', async () => {
    mockRedisInstance.get.mockResolvedValue('cached-value');
    const result = await cache.get('test-key');
    expect(result).toBe('cached-value');
    expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
  });

  test('returns null for non-existing key', async () => {
    mockRedisInstance.get.mockResolvedValue(null);
    const result = await cache.get('missing-key');
    expect(result).toBeNull();
  });
});

describe('cache - set', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedisInstance);
    });
    jest.mock('../../../src/utils/config', () => ({
      redis: { host: 'localhost', port: 6379, password: undefined },
      logging: { level: 'error', format: 'json', toFile: false, filePath: './logs' },
      env: 'test',
    }));
    jest.mock('../../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }));

    cache = require('../../../src/utils/cache');
  });

  test('sets value with TTL', async () => {
    mockRedisInstance.set.mockResolvedValue('OK');
    await cache.set('key', 'value', 3600);
    expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value', 'EX', 3600);
  });

  test('sets value without TTL', async () => {
    mockRedisInstance.set.mockResolvedValue('OK');
    await cache.set('key', 'value');
    expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value');
  });

  test('sets value with 0 TTL (no expiry)', async () => {
    mockRedisInstance.set.mockResolvedValue('OK');
    await cache.set('key', 'value', 0);
    expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value');
  });
});

describe('cache - del', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedisInstance);
    });
    jest.mock('../../../src/utils/config', () => ({
      redis: { host: 'localhost', port: 6379, password: undefined },
      logging: { level: 'error', format: 'json', toFile: false, filePath: './logs' },
      env: 'test',
    }));
    jest.mock('../../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }));

    cache = require('../../../src/utils/cache');
  });

  test('deletes a key', async () => {
    mockRedisInstance.del.mockResolvedValue(1);
    await cache.del('key');
    expect(mockRedisInstance.del).toHaveBeenCalledWith('key');
  });

  test('handles deletion of non-existing key', async () => {
    mockRedisInstance.del.mockResolvedValue(0);
    await cache.del('missing-key');
    expect(mockRedisInstance.del).toHaveBeenCalledWith('missing-key');
  });
});

// Restore original MOCK_REDIS value so other tests are unaffected.
afterAll(() => {
  if (_originalMockRedis === undefined) {
    delete process.env.MOCK_REDIS;
  } else {
    process.env.MOCK_REDIS = _originalMockRedis;
  }
});
