const jwt = require('jsonwebtoken');

jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../src/utils/config', () => ({
  jwt: {
    secret: 'test-secret',
    expiry: '1h',
    refreshSecret: 'test-refresh-secret',
    refreshExpiry: '7d',
  },
  linkedin: {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:8000/auth/callback',
  },
  features: { mockLinkedIn: true },
}));

jest.mock('../../../../src/utils/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../../../src/database/models/User', () => ({
  findByLinkedInId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../../../src/database/models/UserPreference', () => ({
  createOrUpdate: jest.fn(),
  findByUserId: jest.fn(),
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
      INVALID_INPUT: { code: 'INVALID_INPUT', status: 400 },
      INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401 },
      TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401 },
      NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
      SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503 },
    },
  };
});

const { generateTokens, getLinkedInAuthUrl, handleOAuthCallback, refreshToken, getProfile, logout } = require('../../../../src/api/controllers/authController');
const User = require('../../../../src/database/models/User');
const UserPreference = require('../../../../src/database/models/UserPreference');
const cache = require('../../../../src/utils/cache');

describe('authController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {}, body: {}, user: { id: 'user-1', email: 'test@test.com' } };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('generateTokens', () => {
    it('returns accessToken and refreshToken', () => {
      const tokens = generateTokens({ id: 'user-1', email: 'test@test.com' });
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('generates valid JWT access token', () => {
      const tokens = generateTokens({ id: 'user-1', email: 'test@test.com' });
      const decoded = jwt.verify(tokens.accessToken, 'test-secret');
      expect(decoded.id).toBe('user-1');
      expect(decoded.email).toBe('test@test.com');
    });

    it('generates valid JWT refresh token', () => {
      const tokens = generateTokens({ id: 'user-1', email: 'test@test.com' });
      const decoded = jwt.verify(tokens.refreshToken, 'test-refresh-secret');
      expect(decoded.id).toBe('user-1');
    });

    it('generates different tokens for different users', () => {
      const tokens1 = generateTokens({ id: 'user-1', email: 'a@a.com' });
      const tokens2 = generateTokens({ id: 'user-2', email: 'b@b.com' });
      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
    });
  });

  describe('getLinkedInAuthUrl', () => {
    it('returns auth URL in response', () => {
      getLinkedInAuthUrl(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            authUrl: expect.stringContaining('linkedin.com/oauth'),
          }),
        })
      );
    });

    it('includes required OAuth params', () => {
      getLinkedInAuthUrl(req, res);
      const authUrl = res.json.mock.calls[0][0].data.authUrl;
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('scope=');
    });
  });

  describe('handleOAuthCallback', () => {
    it('calls next with error when no code provided', async () => {
      req.query = {};
      await handleOAuthCallback(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' })
      );
    });

    it('creates new user on first login', async () => {
      req.query = { code: 'auth_code_123' };
      User.findByLinkedInId.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 'new-user', email: 'new@test.com', first_name: 'Test', last_name: 'User' });
      UserPreference.createOrUpdate.mockResolvedValue({});
      cache.set.mockResolvedValue(true);

      await handleOAuthCallback(req, res, next);
      expect(User.create).toHaveBeenCalled();
      expect(UserPreference.createOrUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          }),
        })
      );
    });

    it('updates existing user tokens on subsequent login', async () => {
      req.query = { code: 'auth_code_123' };
      User.findByLinkedInId.mockResolvedValue({ id: 'existing-user', email: 'old@test.com', first_name: 'Old', last_name: 'User' });
      User.update.mockResolvedValue({});
      cache.set.mockResolvedValue(true);

      await handleOAuthCallback(req, res, next);
      expect(User.create).not.toHaveBeenCalled();
      expect(User.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('stores refresh token in cache', async () => {
      req.query = { code: 'auth_code_123' };
      User.findByLinkedInId.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 'u1', email: 't@t.com', first_name: 'T', last_name: 'U' });
      UserPreference.createOrUpdate.mockResolvedValue({});
      cache.set.mockResolvedValue(true);

      await handleOAuthCallback(req, res, next);
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('refresh:'),
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('refreshToken', () => {
    it('calls next with error when no token provided', async () => {
      req.body = {};
      await refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' })
      );
    });

    it('refreshes tokens with valid refresh token', async () => {
      const validToken = jwt.sign({ id: 'user-1', email: 'test@test.com' }, 'test-refresh-secret', { expiresIn: '7d' });
      req.body = { refreshToken: validToken };
      cache.get.mockResolvedValue(validToken);
      User.findById.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });
      cache.set.mockResolvedValue(true);

      await refreshToken(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          }),
        })
      );
    });

    it('rejects expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { id: 'user-1', email: 'test@test.com' },
        'test-refresh-secret',
        { expiresIn: '0s' }
      );
      // Wait a moment for token to expire
      await new Promise(r => setTimeout(r, 10));
      req.body = { refreshToken: expiredToken };

      await refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TOKEN_EXPIRED' })
      );
    });

    it('rejects invalid refresh token', async () => {
      req.body = { refreshToken: 'invalid.token.here' };

      await refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_TOKEN' })
      );
    });

    it('rejects revoked token (not in cache)', async () => {
      const validToken = jwt.sign({ id: 'user-1', email: 'test@test.com' }, 'test-refresh-secret', { expiresIn: '7d' });
      req.body = { refreshToken: validToken };
      cache.get.mockResolvedValue(null);

      await refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_TOKEN' })
      );
    });

    it('rejects when user not found', async () => {
      const validToken = jwt.sign({ id: 'user-1', email: 'test@test.com' }, 'test-refresh-secret', { expiresIn: '7d' });
      req.body = { refreshToken: validToken };
      cache.get.mockResolvedValue(validToken);
      User.findById.mockResolvedValue(null);

      await refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('getProfile', () => {
    it('returns user profile', async () => {
      User.findById.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        profile_pic_url: null,
        created_at: '2024-01-01',
      });

      await getProfile(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            id: 'user-1',
            email: 'test@test.com',
          }),
        })
      );
    });

    it('calls next with NOT_FOUND when user missing', async () => {
      User.findById.mockResolvedValue(null);

      await getProfile(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });

  describe('logout', () => {
    it('removes refresh token from cache', async () => {
      cache.del.mockResolvedValue(true);

      await logout(req, res, next);
      expect(cache.del).toHaveBeenCalledWith('refresh:user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({ message: 'Logged out successfully' }),
        })
      );
    });

    it('calls next on error', async () => {
      cache.del.mockRejectedValue(new Error('cache error'));

      await logout(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
