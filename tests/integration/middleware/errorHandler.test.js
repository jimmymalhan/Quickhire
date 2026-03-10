/**
 * Integration tests for error handler middleware.
 * Tests AppError handling and generic error handling.
 */

const errorHandler = require('../../../src/api/middleware/errorHandler');
const { AppError, ERROR_CODES } = require('../../../src/utils/errorCodes');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

function createMocks() {
  const req = {
    path: '/test',
    method: 'GET',
    id: 'req-123',
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Integration - Error Handler Middleware', () => {
  test('handles AppError with correct status code', () => {
    const { req, res, next } = createMocks();
    const err = new AppError(ERROR_CODES.NOT_FOUND, 'User not found');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 404,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'User not found',
        }),
      })
    );
  });

  test('handles AppError with details', () => {
    const { req, res, next } = createMocks();
    const err = new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid input', ['email required']);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error.details).toEqual(['email required']);
  });

  test('handles AppError for each error type', () => {
    const testCases = [
      { code: ERROR_CODES.UNAUTHORIZED, expectedStatus: 401 },
      { code: ERROR_CODES.FORBIDDEN, expectedStatus: 403 },
      { code: ERROR_CODES.CONFLICT, expectedStatus: 409 },
      { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, expectedStatus: 429 },
      { code: ERROR_CODES.INTERNAL_ERROR, expectedStatus: 500 },
      { code: ERROR_CODES.SERVICE_UNAVAILABLE, expectedStatus: 503 },
    ];

    for (const { code, expectedStatus } of testCases) {
      const { req, res, next } = createMocks();
      const err = new AppError(code, 'Test error');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(expectedStatus);
    }
  });

  test('handles generic Error with 500 status', () => {
    const { req, res, next } = createMocks();
    const err = new Error('Something unexpected');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 500,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
        }),
      })
    );
  });

  test('hides error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { req, res, next } = createMocks();
    const err = new Error('Sensitive internal error details');

    errorHandler(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.error.message).toBe('Internal server error');

    process.env.NODE_ENV = originalEnv;
  });

  test('shows error details in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const { req, res, next } = createMocks();
    const err = new Error('Detailed error message');

    errorHandler(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.error.message).toBe('Detailed error message');

    process.env.NODE_ENV = originalEnv;
  });

  test('includes timestamp in error response', () => {
    const { req, res, next } = createMocks();
    const err = new AppError(ERROR_CODES.INTERNAL_ERROR, 'Error');

    errorHandler(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.meta).toHaveProperty('timestamp');
    const timestamp = new Date(response.meta.timestamp);
    expect(timestamp.toISOString()).toBe(response.meta.timestamp);
  });

  test('includes request_id in error response', () => {
    const { req, res, next } = createMocks();
    const err = new AppError(ERROR_CODES.INTERNAL_ERROR, 'Error');

    errorHandler(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.meta.request_id).toBe('req-123');
  });

  test('handles error with custom statusCode property', () => {
    const { req, res, next } = createMocks();
    const err = new Error('Custom status');
    err.statusCode = 422;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  test('defaults to 500 when no statusCode', () => {
    const { req, res, next } = createMocks();
    const err = new Error('No status code');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
