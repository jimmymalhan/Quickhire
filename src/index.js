const app = require('./app');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { testConnection } = require('./database/connection');
const agentWorker = require('./automation/agentWorker');
const agentHealthMonitor = require('./automation/agentHealthMonitor');
const agentWatchdog = require('./automation/agentWatchdog');
const guardrailLoader = require('./automation/guardrailLoader');

let server = null;

const start = async () => {
  // Load guardrails FIRST — before any agent subsystem starts.
  // Enforces CLAUDE_ENABLED=false and prints banner to confirm.
  guardrailLoader.printBanner(logger);

  logger.info('Starting Quickhire API server...');

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.warn('Database not available - starting in degraded mode');
  }

  server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.env}]`);
    agentWorker.start();
    agentHealthMonitor.start();
    agentWatchdog.start();
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
