const config = require('../../utils/config');
const { testConnection } = require('../../database/connection');

const healthCheck = async (_req, res) => {
  let dbHealthy = false;

  try {
    dbHealthy = await testConnection(
      config.env === 'test' ? { logSuccess: false, logFailure: false } : undefined,
    );
  } catch (_err) {
    dbHealthy = false;
  }

  const status = dbHealthy ? 'healthy' : 'degraded';
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    code: statusCode,
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
      },
    },
  });
};

module.exports = { healthCheck };
