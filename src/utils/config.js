const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const defaultRuntimeStateDir = path.resolve('/tmp/local-agent-runtime-quickhire/state');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8000,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'quickhire_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:8000/auth/callback',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    expiry: process.env.JWT_EXPIRY || '7d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-in-production',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'gmail',
    from: process.env.EMAIL_FROM || 'noreply@quickhire.ai',
    gmailUser: process.env.GMAIL_USER,
    gmailPassword: process.env.GMAIL_PASSWORD,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  application: {
    maxPerDay: parseInt(process.env.MAX_APPLICATIONS_PER_DAY, 10) || 50,
    retryAttempts: parseInt(process.env.APPLICATION_RETRY_ATTEMPTS, 10) || 3,
    retryDelayMs: parseInt(process.env.APPLICATION_RETRY_DELAY_MS, 10) || 5000,
    minIntervalSeconds: parseInt(process.env.MIN_APPLICATION_INTERVAL_SECONDS, 10) || 60,
  },

  features: {
    autoApply: process.env.ENABLE_AUTO_APPLY === 'true',
    mlMatching: process.env.ENABLE_ML_MATCHING === 'true',
    notifications: process.env.ENABLE_NOTIFICATIONS === 'true',
    mockLinkedIn: process.env.ENABLE_MOCK_LINKEDIN_API === 'true',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'json',
    toFile: process.env.LOG_TO_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    encryptionKey: process.env.ENCRYPTION_KEY,
  },

  runtime: {
    stateDir: process.env.LOCAL_AGENT_RUNTIME_STATE_DIR || defaultRuntimeStateDir,
  },
};

module.exports = config;
