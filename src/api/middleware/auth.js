const jwt = require('jsonwebtoken');
const config = require('../../utils/config');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');

const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Token has expired'));
    }
    return next(new AppError(ERROR_CODES.INVALID_TOKEN, 'Invalid token'));
  }
};

module.exports = { authenticate };
