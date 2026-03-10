const logger = require('../../utils/logger');
const { AppError } = require('../../utils/errorCodes');

const errorHandler = (err, req, res, _next) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.statusCode,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.id,
      },
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    status: 'error',
    code: statusCode,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.id,
    },
  });
};

module.exports = errorHandler;
