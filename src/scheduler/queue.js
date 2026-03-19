const Bull = require('bull');
const config = require('../utils/config');
const logger = require('../utils/logger');

function extractQueueErrorMessage(err) {
  if (!err) {
    return 'Unknown queue error';
  }

  return (
    err.message ||
    err.code ||
    err.name ||
    (typeof err.toString === 'function' ? err.toString() : '') ||
    'Unknown queue error'
  );
}

const createQueue = (name) => {
  if (process.env.DISABLE_QUEUES === 'true') {
    logger.info(`Queue "${name}" disabled (DISABLE_QUEUES=true)`);
    return {
      process: () => {},
      add: async () => ({ id: null }),
      getWaitingCount: async () => 0,
      getActiveCount: async () => 0,
      getCompletedCount: async () => 0,
      getFailedCount: async () => 0,
      on: () => {},
    };
  }

  const queue = new Bull(name, {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });

  queue.on('error', (err) => {
    logger.error(`Queue ${name} error`, {
      error: extractQueueErrorMessage(err),
      code: err?.code,
      name: err?.name,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} in ${name} failed`, {
      error: extractQueueErrorMessage(err),
      data: job.data,
    });
  });

  queue.on('completed', (job) => {
    logger.debug(`Job ${job.id} in ${name} completed`);
  });

  return queue;
};

const jobScrapeQueue = createQueue('job-scraping');
const applicationQueue = createQueue('application-processing');
const notificationQueue = createQueue('notifications');

module.exports = { createQueue, jobScrapeQueue, applicationQueue, notificationQueue };
