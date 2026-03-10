/**
 * Integration tests for authentication middleware.
 * Tests JWT token validation, expiry, and error handling.
 */

const jwt = require('jsonwebtoken');
const { authenticate } = require('../../../src/api/middleware/auth');
const config = require('../../../src/utils/config');

// Helper to create mock req/res/next
function createMocks(headers = {}) {
  const req = {
    headers: headers,
    user: null,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Integration - Auth Middleware', () => {
  const secret = config.jwt.secret;

  test('passes valid JWT token and sets req.user', () => {
    const payload = { userId: 'user-123', email: 'test@example.com' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const { req, res, next } = createMocks({
      authorization: `Bearer ${token}`,
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined(); // no error
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('user-123');
    expect(req.user.email).toBe('test@example.com');
  });

  test('rejects request without authorization header', () => {
    const { req, res, next } = createMocks({});

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });

  test('rejects request with empty authorization header', () => {
    const { req, res, next } = createMocks({
      authorization: '',
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('rejects request without Bearer prefix', () => {
    const token = jwt.sign({ userId: 'user-123' }, secret);
    const { req, res, next } = createMocks({
      authorization: `Token ${token}`,
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('rejects expired token', () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      secret,
      { expiresIn: '0s' } // expires immediately
    );

    // Small delay to ensure token is expired
    const { req, res, next } = createMocks({
      authorization: `Bearer ${token}`,
    });

    // Token is already expired at creation with 0s
    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('TOKEN_EXPIRED');
    expect(err.statusCode).toBe(401);
  });

  test('rejects invalid/malformed token', () => {
    const { req, res, next } = createMocks({
      authorization: 'Bearer invalid.token.here',
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('INVALID_TOKEN');
    expect(err.statusCode).toBe(401);
  });

  test('rejects token signed with wrong secret', () => {
    const token = jwt.sign({ userId: 'user-123' }, 'wrong-secret');
    const { req, res, next } = createMocks({
      authorization: `Bearer ${token}`,
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('INVALID_TOKEN');
  });

  test('sets full decoded payload on req.user', () => {
    const payload = {
      userId: 'user-456',
      email: 'admin@example.com',
      role: 'admin',
    };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const { req, res, next } = createMocks({
      authorization: `Bearer ${token}`,
    });

    authenticate(req, res, next);

    expect(req.user.userId).toBe('user-456');
    expect(req.user.email).toBe('admin@example.com');
    expect(req.user.role).toBe('admin');
    expect(req.user.iat).toBeDefined();
    expect(req.user.exp).toBeDefined();
  });

  test('handles Bearer with extra spaces', () => {
    const { req, res, next } = createMocks({
      authorization: 'Bearer  ',
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
