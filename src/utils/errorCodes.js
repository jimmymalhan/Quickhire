const ERROR_CODES = {
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400, message: 'Validation error', retryable: false },
  INVALID_INPUT: { code: 'INVALID_INPUT', status: 400, message: 'Invalid input provided', retryable: false },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401, message: 'Unauthorized access', retryable: false },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401, message: 'Invalid authentication token', retryable: false },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401, message: 'Authentication token has expired', retryable: true },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403, message: 'Access forbidden', retryable: false },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, message: 'Resource not found', retryable: false },
  CONFLICT: { code: 'CONFLICT', status: 409, message: 'Resource conflict', retryable: false },
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Rate limit exceeded', retryable: true },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500, message: 'Internal server error', retryable: true },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503, message: 'Service temporarily unavailable', retryable: true },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500, message: 'Database error occurred', retryable: true },
  LINKEDIN_API_ERROR: { code: 'LINKEDIN_API_ERROR', status: 502, message: 'LinkedIn API error', retryable: true },
  APPLICATION_LIMIT_REACHED: { code: 'APPLICATION_LIMIT_REACHED', status: 429, message: 'Application limit reached', retryable: false },
  SCRAPE_FAILED: { code: 'SCRAPE_FAILED', status: 502, message: 'Failed to scrape job listing', retryable: true },
  SCRAPE_TIMEOUT: { code: 'SCRAPE_TIMEOUT', status: 504, message: 'Scraping request timed out', retryable: true },
  SCRAPE_BLOCKED: { code: 'SCRAPE_BLOCKED', status: 403, message: 'Scraping was blocked by the target site', retryable: false },
  SCRAPE_RATE_LIMITED: { code: 'SCRAPE_RATE_LIMITED', status: 429, message: 'Scraping rate limit exceeded', retryable: true },
  PARSE_FAILED: { code: 'PARSE_FAILED', status: 422, message: 'Failed to parse job data', retryable: false },
  PARSE_MISSING_FIELD: { code: 'PARSE_MISSING_FIELD', status: 422, message: 'Required field missing from parsed data', retryable: false },
  DB_INSERT_ERROR: { code: 'DB_INSERT_ERROR', status: 500, message: 'Failed to insert record into database', retryable: true },
  DB_DUPLICATE: { code: 'DB_DUPLICATE', status: 409, message: 'Duplicate record detected', retryable: false },
  UNKNOWN_ERROR: { code: 'UNKNOWN_ERROR', status: 500, message: 'An unknown error occurred', retryable: true },
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
  constructor(code, details = null, cause = null) {
    const errorDef = ERROR_CODES[code] || ERROR_CODES.UNKNOWN_ERROR;
    if (!ERROR_CODES[code]) {
      code = 'UNKNOWN_ERROR';
    }
    super(errorDef.message);
    this.name = 'ScraperError';
    this.code = code;
    this.details = details;
    this.cause = cause;
    this.retryable = errorDef.retryable;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp,
    };
  }
}

const ErrorCodes = ERROR_CODES;

module.exports = { ERROR_CODES, ErrorCodes, AppError, ScraperError };
