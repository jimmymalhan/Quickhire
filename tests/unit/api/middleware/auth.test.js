const jwt = require('jsonwebtoken');

jest.mock('../../../../src/utils/config', () => ({
  jwt: {
    secret: 'test-jwt-secret',
  },
}));

jest.mock('../../../../src/utils/errorCodes', () => {
  class AppError extends Error {
    constructor(errorCode, message) {
      super(message);
      this.name = 'AppError';
      this.code = errorCode.code;
      this.statusCode = errorCode.status;
    }
  }
  return {
    AppError,
    ERROR_CODES: {
      UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
      INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401 },
      TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401 },
    },
  };
});

const { authenticate } = require('../../../../src/api/middleware/auth');

describe('auth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = jest.fn();
  });

  it('calls next with UNAUTHORIZED when no auth header', () => {
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('calls next with UNAUTHORIZED when auth header missing Bearer', () => {
    req.headers.authorization = 'Basic token123';
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('calls next with UNAUTHORIZED for empty auth header', () => {
    req.headers.authorization = '';
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('sets req.user and calls next for valid token', () => {
    const token = jwt.sign({ id: 'user-1', email: 'test@test.com' }, 'test-jwt-secret', {
      expiresIn: '1h',
    });
    req.headers.authorization = `Bearer ${token}`;

    authenticate(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-1');
    expect(req.user.email).toBe('test@test.com');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with TOKEN_EXPIRED for expired token', () => {
    const token = jwt.sign({ id: 'user-1' }, 'test-jwt-secret', { expiresIn: '0s' });
    req.headers.authorization = `Bearer ${token}`;

    // Token expires immediately
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
  });

  it('calls next with INVALID_TOKEN for invalid token', () => {
    req.headers.authorization = 'Bearer invalid.token.here';

    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('calls next with INVALID_TOKEN for token with wrong secret', () => {
    const token = jwt.sign({ id: 'user-1' }, 'wrong-secret');
    req.headers.authorization = `Bearer ${token}`;

    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('handles Bearer with no token', () => {
    req.headers.authorization = 'Bearer ';

    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });
});
