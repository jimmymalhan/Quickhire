const ERROR_CODES = {
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400 },
  INVALID_INPUT: { code: 'INVALID_INPUT', status: 400 },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401 },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
  CONFLICT: { code: 'CONFLICT', status: 409 },
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500 },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503 },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500 },
  LINKEDIN_API_ERROR: { code: 'LINKEDIN_API_ERROR', status: 502 },
  APPLICATION_LIMIT_REACHED: { code: 'APPLICATION_LIMIT_REACHED', status: 429 },
};

class AppError extends Error {
  constructor(errorCode, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.code = errorCode.code;
    this.statusCode = errorCode.status;
    this.details = details;
  }
}

class ScraperError extends Error {
  constructor(code, context = {}, cause = null) {
    super(`Scraper error: ${code}`);
    this.name = 'ScraperError';
    this.code = code;
    this.context = context;
    this.cause = cause;
    this.retryable = !['SCRAPE_AUTH_REQUIRED', 'SCRAPE_BLOCKED'].includes(code);
  }
}

module.exports = { ERROR_CODES, AppError, ScraperError };
