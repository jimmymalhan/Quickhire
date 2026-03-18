const app = require('./app');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { testConnection } = require('./database/connection');

let server = null;

const start = async () => {
  logger.info('Starting Quickhire API server...');

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.warn('Database not available - starting in degraded mode');
  }

  server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.env}]`);
  });
};

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(() => {
      process.exitCode = 0;
    });
    return;
  }

  process.exitCode = 0;
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
});

start();
