// Jest test setup
process.env.NODE_ENV = 'test';
process.env.PORT = '8001';
process.env.DB_NAME = 'quickhire_test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-testing-only';
process.env.LOG_LEVEL = 'error';
process.env.DISABLE_QUEUES = 'true';

// Prevent real database connections in unit tests.
// Integration tests that need a live DB should set MOCK_DB=false explicitly.
if (!process.env.MOCK_DB) {
  process.env.MOCK_DB = 'true';
}

// Prevent real Redis connections in tests.
// ioredis and bull will not be instantiated when DISABLE_QUEUES is true,
// but any direct cache.js import would still open a connection without this.
if (!process.env.MOCK_REDIS) {
  process.env.MOCK_REDIS = 'true';
}
