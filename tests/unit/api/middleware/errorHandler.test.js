jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../src/utils/errorCodes', () => {
  class AppError extends Error {
    constructor(errorCode, message, details = []) {
      super(message);
      this.name = 'AppError';
      this.code = errorCode.code;
      this.statusCode = errorCode.status;
      this.details = details;
    }
  }
  return { AppError };
});

const errorHandler = require('../../../../src/api/middleware/errorHandler');
const { AppError } = require('../../../../src/utils/errorCodes');

describe('errorHandler middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { path: '/test', method: 'GET', id: 'req-123' };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('handles AppError with correct status and body', () => {
    const err = new AppError({ code: 'NOT_FOUND', status: 404 }, 'Resource not found');

    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 404,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Resource not found',
        }),
      }),
    );
  });

  it('includes request_id in meta', () => {
    const err = new AppError({ code: 'NOT_FOUND', status: 404 }, 'Not found');

    errorHandler(err, req, res, next);
    const response = res.json.mock.calls[0][0];
    expect(response.meta.request_id).toBe('req-123');
  });

  it('includes timestamp in meta', () => {
    const err = new AppError({ code: 'NOT_FOUND', status: 404 }, 'Not found');

    errorHandler(err, req, res, next);
    const response = res.json.mock.calls[0][0];
    expect(response.meta.timestamp).toBeTruthy();
  });

  it('includes details for AppError', () => {
    const err = new AppError({ code: 'VALIDATION_ERROR', status: 400 }, 'Invalid', [
      'field1 required',
    ]);

    errorHandler(err, req, res, next);
    const response = res.json.mock.calls[0][0];
    expect(response.error.details).toContain('field1 required');
  });

  it('handles generic Error with 500 status', () => {
    const err = new Error('Something broke');

    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 500,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
        }),
      }),
    );
  });

  it('uses error statusCode if set on generic error', () => {
    const err = new Error('Bad Gateway');
    err.statusCode = 502;

    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('hides error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Sensitive internal error');

    errorHandler(err, req, res, next);
    const response = res.json.mock.calls[0][0];
    expect(response.error.message).toBe('Internal server error');

    process.env.NODE_ENV = originalEnv;
  });

  it('shows error details in non-production', () => {
    process.env.NODE_ENV = 'test';

    const err = new Error('Detailed error message');

    errorHandler(err, req, res, next);
    const response = res.json.mock.calls[0][0];
    expect(response.error.message).toBe('Detailed error message');
  });
});
