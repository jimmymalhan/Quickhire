const rateLimit = require('express-rate-limit');
const config = require('../../utils/config');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
});

module.exports = { apiLimiter, authLimiter };
