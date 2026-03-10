/**
 * Unit tests for src/utils/config.js
 * Tests configuration loading from environment variables.
 */

describe('config - module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('exports a config object', () => {
    const config = require('../../../src/utils/config');
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  test('has all required top-level sections', () => {
    const config = require('../../../src/utils/config');
    expect(config).toHaveProperty('env');
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('db');
    expect(config).toHaveProperty('redis');
    expect(config).toHaveProperty('jwt');
    expect(config).toHaveProperty('linkedin');
    expect(config).toHaveProperty('email');
    expect(config).toHaveProperty('cors');
    expect(config).toHaveProperty('rateLimit');
    expect(config).toHaveProperty('application');
    expect(config).toHaveProperty('features');
    expect(config).toHaveProperty('logging');
    expect(config).toHaveProperty('security');
  });

  test('env defaults to development', () => {
    delete process.env.NODE_ENV;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.env).toBe('development');
  });

  test('port defaults to 8000', () => {
    delete process.env.PORT;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.port).toBe(8000);
  });

  test('port reads from PORT env var', () => {
    process.env.PORT = '9000';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.port).toBe(9000);
  });

  test('port defaults to 8000 for NaN env var', () => {
    process.env.PORT = 'notanumber';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.port).toBe(8000);
  });
});

describe('config - db section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('db has all required fields', () => {
    const config = require('../../../src/utils/config');
    expect(config.db).toHaveProperty('host');
    expect(config.db).toHaveProperty('port');
    expect(config.db).toHaveProperty('name');
    expect(config.db).toHaveProperty('user');
    expect(config.db).toHaveProperty('password');
  });

  test('db reads from environment variables', () => {
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'mydb';
    process.env.DB_USER = 'admin';
    process.env.DB_PASSWORD = 'secret';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.db.host).toBe('db.example.com');
    expect(config.db.port).toBe(5433);
    expect(config.db.name).toBe('mydb');
    expect(config.db.user).toBe('admin');
    expect(config.db.password).toBe('secret');
  });

  test('db uses defaults when env vars missing', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.db.host).toBe('localhost');
    expect(config.db.port).toBe(5432);
    expect(config.db.name).toBe('quickhire_dev');
    expect(config.db.user).toBe('postgres');
    expect(config.db.password).toBe('');
  });
});

describe('config - redis section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('redis reads from environment variables', () => {
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'redispass';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.redis.host).toBe('redis.example.com');
    expect(config.redis.port).toBe(6380);
    expect(config.redis.password).toBe('redispass');
  });

  test('redis uses defaults when env vars missing', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
  });
});

describe('config - jwt section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('jwt reads from environment variables', () => {
    process.env.JWT_SECRET = 'custom-jwt-secret';
    process.env.JWT_EXPIRY = '24h';
    process.env.REFRESH_TOKEN_SECRET = 'custom-refresh-secret';
    process.env.REFRESH_TOKEN_EXPIRY = '60d';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.jwt.secret).toBe('custom-jwt-secret');
    expect(config.jwt.expiry).toBe('24h');
    expect(config.jwt.refreshSecret).toBe('custom-refresh-secret');
    expect(config.jwt.refreshExpiry).toBe('60d');
  });

  test('jwt has default values', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRY;
    delete process.env.REFRESH_TOKEN_SECRET;
    delete process.env.REFRESH_TOKEN_EXPIRY;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.jwt.secret).toBeDefined();
    expect(config.jwt.expiry).toBe('7d');
    expect(config.jwt.refreshSecret).toBeDefined();
    expect(config.jwt.refreshExpiry).toBe('30d');
  });
});

describe('config - linkedin section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('linkedin reads from environment variables', () => {
    process.env.LINKEDIN_CLIENT_ID = 'li-client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'li-client-secret';
    process.env.LINKEDIN_REDIRECT_URI = 'http://custom/callback';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.linkedin.clientId).toBe('li-client-id');
    expect(config.linkedin.clientSecret).toBe('li-client-secret');
    expect(config.linkedin.redirectUri).toBe('http://custom/callback');
  });

  test('linkedin redirectUri has default', () => {
    delete process.env.LINKEDIN_REDIRECT_URI;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.linkedin.redirectUri).toBe('http://localhost:8000/auth/callback');
  });
});

describe('config - rateLimit section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('rateLimit parses integer env vars', () => {
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '200';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.rateLimit.windowMs).toBe(60000);
    expect(config.rateLimit.maxRequests).toBe(200);
  });

  test('rateLimit uses defaults', () => {
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.rateLimit.windowMs).toBe(900000);
    expect(config.rateLimit.maxRequests).toBe(100);
  });
});

describe('config - application section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('application parses integer env vars', () => {
    process.env.MAX_APPLICATIONS_PER_DAY = '25';
    process.env.APPLICATION_RETRY_ATTEMPTS = '5';
    process.env.APPLICATION_RETRY_DELAY_MS = '10000';
    process.env.MIN_APPLICATION_INTERVAL_SECONDS = '120';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.application.maxPerDay).toBe(25);
    expect(config.application.retryAttempts).toBe(5);
    expect(config.application.retryDelayMs).toBe(10000);
    expect(config.application.minIntervalSeconds).toBe(120);
  });

  test('application uses defaults', () => {
    delete process.env.MAX_APPLICATIONS_PER_DAY;
    delete process.env.APPLICATION_RETRY_ATTEMPTS;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.application.maxPerDay).toBe(50);
    expect(config.application.retryAttempts).toBe(3);
  });
});

describe('config - features section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('features read boolean strings', () => {
    process.env.ENABLE_AUTO_APPLY = 'true';
    process.env.ENABLE_ML_MATCHING = 'false';
    process.env.ENABLE_NOTIFICATIONS = 'true';
    process.env.ENABLE_MOCK_LINKEDIN_API = 'false';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.features.autoApply).toBe(true);
    expect(config.features.mlMatching).toBe(false);
    expect(config.features.notifications).toBe(true);
    expect(config.features.mockLinkedIn).toBe(false);
  });

  test('features default to false when not set', () => {
    delete process.env.ENABLE_AUTO_APPLY;
    delete process.env.ENABLE_ML_MATCHING;
    delete process.env.ENABLE_NOTIFICATIONS;
    delete process.env.ENABLE_MOCK_LINKEDIN_API;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.features.autoApply).toBe(false);
    expect(config.features.mlMatching).toBe(false);
    expect(config.features.notifications).toBe(false);
    expect(config.features.mockLinkedIn).toBe(false);
  });
});

describe('config - logging section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('logging reads from environment variables', () => {
    process.env.LOG_LEVEL = 'info';
    process.env.LOG_FORMAT = 'text';
    process.env.LOG_TO_FILE = 'true';
    process.env.LOG_FILE_PATH = '/var/log/app';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.logging.level).toBe('info');
    expect(config.logging.format).toBe('text');
    expect(config.logging.toFile).toBe(true);
    expect(config.logging.filePath).toBe('/var/log/app');
  });

  test('logging uses defaults', () => {
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
    delete process.env.LOG_TO_FILE;
    delete process.env.LOG_FILE_PATH;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.logging.level).toBe('debug');
    expect(config.logging.format).toBe('json');
    expect(config.logging.toFile).toBe(false);
    expect(config.logging.filePath).toBe('./logs');
  });
});

describe('config - security section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('security reads from environment variables', () => {
    process.env.SESSION_SECRET = 'custom-session-secret';
    process.env.BCRYPT_ROUNDS = '14';
    process.env.ENCRYPTION_KEY = 'my-encryption-key-32-chars-long!';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.security.sessionSecret).toBe('custom-session-secret');
    expect(config.security.bcryptRounds).toBe(14);
    expect(config.security.encryptionKey).toBe('my-encryption-key-32-chars-long!');
  });

  test('security uses defaults', () => {
    delete process.env.SESSION_SECRET;
    delete process.env.BCRYPT_ROUNDS;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.security.sessionSecret).toBeDefined();
    expect(config.security.bcryptRounds).toBe(12);
  });
});

describe('config - cors section', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('cors reads from CORS_ORIGIN env var', () => {
    process.env.CORS_ORIGIN = 'https://app.example.com';
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.cors.origin).toBe('https://app.example.com');
  });

  test('cors defaults to localhost:3000', () => {
    delete process.env.CORS_ORIGIN;
    jest.resetModules();
    const config = require('../../../src/utils/config');
    expect(config.cors.origin).toBe('http://localhost:3000');
  });
});
