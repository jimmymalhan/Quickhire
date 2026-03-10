const jwt = require('jsonwebtoken');
const config = require('../../utils/config');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');
const User = require('../../database/models/User');
const UserPreference = require('../../database/models/UserPreference');
const cache = require('../../utils/cache');

const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });

  return { accessToken, refreshToken };
};

const getLinkedInAuthUrl = (_req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.linkedin.clientId,
    redirect_uri: config.linkedin.redirectUri,
    scope: 'openid profile email',
    state: Buffer.from(Date.now().toString()).toString('base64'),
  });

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  res.json({
    status: 'success',
    code: 200,
    data: { authUrl },
  });
};

const handleOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, 'Authorization code is required');
    }

    // Exchange code for access token (in production, this calls LinkedIn API)
    // For now, support mock mode for development/testing
    let linkedInProfile;
    if (config.features.mockLinkedIn) {
      linkedInProfile = {
        id: `mock_${Date.now()}`,
        email: `user_${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        profilePicUrl: null,
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 3600,
      };
    } else {
      // Real LinkedIn OAuth token exchange would go here
      throw new AppError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'LinkedIn OAuth not configured. Enable ENABLE_MOCK_LINKEDIN_API for development.',
      );
    }

    // Find or create user
    let user = await User.findByLinkedInId(linkedInProfile.id);
    if (!user) {
      user = await User.create({
        email: linkedInProfile.email,
        linkedinId: linkedInProfile.id,
        firstName: linkedInProfile.firstName,
        lastName: linkedInProfile.lastName,
        profilePicUrl: linkedInProfile.profilePicUrl,
        accessToken: linkedInProfile.accessToken,
        refreshToken: linkedInProfile.refreshToken,
        tokenExpiresAt: new Date(Date.now() + linkedInProfile.expiresIn * 1000),
      });

      // Create default preferences
      await UserPreference.createOrUpdate(user.id, {
        autoApplyEnabled: true,
        notificationEnabled: true,
        emailNotifications: true,
        pushNotifications: false,
        dailyLimit: 20,
        applyIntervalMinutes: 60,
      });
    } else {
      // Update tokens
      await User.update(user.id, {
        access_token: linkedInProfile.accessToken,
        refresh_token: linkedInProfile.refreshToken,
        token_expires_at: new Date(Date.now() + linkedInProfile.expiresIn * 1000),
      });
    }

    const tokens = generateTokens(user);

    // Store refresh token in Redis for validation
    await cache.set(`refresh:${user.id}`, tokens.refreshToken, 30 * 24 * 60 * 60);

    res.json({
      status: 'success',
      code: 200,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          profilePicUrl: user.profile_pic_url,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, 'Refresh token is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Refresh token has expired');
      }
      throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Invalid refresh token');
    }

    // Verify token exists in Redis
    const storedToken = await cache.get(`refresh:${decoded.id}`);
    if (!storedToken || storedToken !== token) {
      throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Refresh token has been revoked');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found');
    }

    const tokens = generateTokens(user);
    await cache.set(`refresh:${user.id}`, tokens.refreshToken, 30 * 24 * 60 * 60);

    res.json({
      status: 'success',
      code: 200,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found');
    }

    res.json({
      status: 'success',
      code: 200,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePicUrl: user.profile_pic_url,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    // Remove refresh token from Redis
    await cache.del(`refresh:${req.user.id}`);

    res.json({
      status: 'success',
      code: 200,
      data: { message: 'Logged out successfully' },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateTokens,
  getLinkedInAuthUrl,
  handleOAuthCallback,
  refreshToken,
  getProfile,
  logout,
};
