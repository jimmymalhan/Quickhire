const Bull = require('bull');
const config = require('../utils/config');
const logger = require('../utils/logger');

const createQueue = (name) => {
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
    logger.error(`Queue ${name} error`, { error: err.message });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} in ${name} failed`, { error: err.message, data: job.data });
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
