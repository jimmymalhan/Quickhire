/**
 * Unit tests for src/utils/errorCodes.js
 * Tests error codes registry and AppError class.
 */

const { ERROR_CODES, AppError } = require('../../../src/utils/errorCodes');

// ============================================================
// ERROR_CODES registry
// ============================================================
describe('errorCodes - ERROR_CODES', () => {
  test('contains validation error codes', () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBeDefined();
    expect(ERROR_CODES.INVALID_INPUT).toBeDefined();
  });

  test('contains authentication error codes', () => {
    expect(ERROR_CODES.UNAUTHORIZED).toBeDefined();
    expect(ERROR_CODES.INVALID_TOKEN).toBeDefined();
    expect(ERROR_CODES.TOKEN_EXPIRED).toBeDefined();
    expect(ERROR_CODES.FORBIDDEN).toBeDefined();
  });

  test('contains resource error codes', () => {
    expect(ERROR_CODES.NOT_FOUND).toBeDefined();
    expect(ERROR_CODES.CONFLICT).toBeDefined();
  });

  test('contains rate limiting error codes', () => {
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBeDefined();
    expect(ERROR_CODES.APPLICATION_LIMIT_REACHED).toBeDefined();
  });

  test('contains server error codes', () => {
    expect(ERROR_CODES.INTERNAL_ERROR).toBeDefined();
    expect(ERROR_CODES.DATABASE_ERROR).toBeDefined();
    expect(ERROR_CODES.LINKEDIN_API_ERROR).toBeDefined();
    expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBeDefined();
  });

  test('all error codes have code and status properties', () => {
    for (const [_key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toHaveProperty('code');
      expect(value).toHaveProperty('status');
      expect(typeof value.code).toBe('string');
      expect(typeof value.status).toBe('number');
    }
  });

  test('validation errors have 400 status', () => {
    expect(ERROR_CODES.VALIDATION_ERROR.status).toBe(400);
    expect(ERROR_CODES.INVALID_INPUT.status).toBe(400);
  });

  test('auth errors have 401 status', () => {
    expect(ERROR_CODES.UNAUTHORIZED.status).toBe(401);
    expect(ERROR_CODES.INVALID_TOKEN.status).toBe(401);
    expect(ERROR_CODES.TOKEN_EXPIRED.status).toBe(401);
  });

  test('forbidden error has 403 status', () => {
    expect(ERROR_CODES.FORBIDDEN.status).toBe(403);
  });

  test('not-found error has 404 status', () => {
    expect(ERROR_CODES.NOT_FOUND.status).toBe(404);
  });

  test('conflict error has 409 status', () => {
    expect(ERROR_CODES.CONFLICT.status).toBe(409);
  });

  test('rate limit errors have 429 status', () => {
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED.status).toBe(429);
    expect(ERROR_CODES.APPLICATION_LIMIT_REACHED.status).toBe(429);
  });

  test('server errors have 5xx status', () => {
    expect(ERROR_CODES.INTERNAL_ERROR.status).toBe(500);
    expect(ERROR_CODES.DATABASE_ERROR.status).toBe(500);
    expect(ERROR_CODES.LINKEDIN_API_ERROR.status).toBe(502);
    expect(ERROR_CODES.SERVICE_UNAVAILABLE.status).toBe(503);
  });

  test('error code values match their keys', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value.code).toBe(key);
    }
  });
});

// ============================================================
// AppError class
// ============================================================
describe('errorCodes - AppError', () => {
  test('creates error from error code object', () => {
    const err = new AppError(ERROR_CODES.UNAUTHORIZED, 'Please log in');
    expect(err.message).toBe('Please log in');
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe('AppError');
  });

  test('creates error with details array', () => {
    const details = ['field1 is required', 'field2 is invalid'];
    const err = new AppError(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details);
    expect(err.details).toEqual(details);
  });

  test('defaults details to empty array', () => {
    const err = new AppError(ERROR_CODES.INTERNAL_ERROR, 'Server error');
    expect(err.details).toEqual([]);
  });

  test('is an instance of Error', () => {
    const err = new AppError(ERROR_CODES.NOT_FOUND, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  test('has correct stack trace', () => {
    const err = new AppError(ERROR_CODES.INTERNAL_ERROR, 'Oops');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });

  test('creates error for each error code', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      const err = new AppError(value, `Test ${key}`);
      expect(err.code).toBe(value.code);
      expect(err.statusCode).toBe(value.status);
      expect(err.message).toBe(`Test ${key}`);
    }
  });

  test('error with VALIDATION_ERROR code', () => {
    const err = new AppError(ERROR_CODES.VALIDATION_ERROR, 'Bad input', ['email missing']);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual(['email missing']);
  });

  test('error with NOT_FOUND code', () => {
    const err = new AppError(ERROR_CODES.NOT_FOUND, 'User not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  test('error with RATE_LIMIT_EXCEEDED code', () => {
    const err = new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Too many requests');
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.statusCode).toBe(429);
  });

  test('error with DATABASE_ERROR code', () => {
    const err = new AppError(ERROR_CODES.DATABASE_ERROR, 'Query failed');
    expect(err.code).toBe('DATABASE_ERROR');
    expect(err.statusCode).toBe(500);
  });

  test('error with LINKEDIN_API_ERROR code', () => {
    const err = new AppError(ERROR_CODES.LINKEDIN_API_ERROR, 'API unavailable');
    expect(err.code).toBe('LINKEDIN_API_ERROR');
    expect(err.statusCode).toBe(502);
  });

  test('error message can be serialized', () => {
    const err = new AppError(ERROR_CODES.NOT_FOUND, 'Resource missing');
    const serialized = JSON.stringify({ message: err.message, code: err.code });
    expect(serialized).toContain('Resource missing');
    expect(serialized).toContain('NOT_FOUND');
  });
});
