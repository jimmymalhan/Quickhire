// Jest test setup
process.env.NODE_ENV = 'test';
process.env.PORT = '8001';
process.env.DB_NAME = 'quickhire_test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-testing-only';
process.env.LOG_LEVEL = 'error';
