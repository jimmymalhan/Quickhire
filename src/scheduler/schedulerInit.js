const { jobScrapeQueue, applicationQueue, notificationQueue } = require('./queue');
const ScrapeJobsJob = require('./jobs/scrapeJobsJob');
const { processApplications } = require('./jobs/processApplications');
const logger = require('../utils/logger');

let scrapeJob = null;

const initScheduler = (searchConfigs = []) => {
  if (process.env.DISABLE_QUEUES === 'true') {
    logger.info('Scheduler initialization skipped (DISABLE_QUEUES=true)');
    return { jobScrapeQueue, applicationQueue, notificationQueue };
  }

  // Create the scrape job instance
  scrapeJob = new ScrapeJobsJob({ searchConfigs });

  // Register job processors
  if (process.env.DISABLE_QUEUES !== 'true') {
    jobScrapeQueue.process('scrape', 2, async (job) => {
      const { searchParams } = job.data;
      // If manual trigger with specific params, create a one-off scrape job
      if (searchParams && Object.keys(searchParams).length > 0) {
        const oneOff = new ScrapeJobsJob({
          searchConfigs: [{ keywords: searchParams.role, location: searchParams.location }],
        });
        return oneOff.execute();
      }
      return scrapeJob.execute();
    });

    applicationQueue.process('process-applications', 1, processApplications);
  }

  // Schedule recurring jobs
  jobScrapeQueue.add(
    'scrape',
    { searchParams: {}, scheduled: true },
    {
      repeat: { cron: '0 */4 * * *' }, // Every 4 hours
      jobId: 'scheduled-scrape',
    },
  );

  applicationQueue.add(
    'process-applications',
    {},
    {
      repeat: { cron: '*/15 * * * *' }, // Every 15 minutes
      jobId: 'scheduled-applications',
    },
  );

  logger.info('Scheduler initialized with recurring jobs');

  return { jobScrapeQueue, applicationQueue, notificationQueue };
};

const triggerScrape = async (searchParams = {}, userId = null) => {
  if (process.env.DISABLE_QUEUES === 'true') {
    logger.info('triggerScrape skipped (DISABLE_QUEUES=true)');
    return { jobId: null };
  }
  const job = await jobScrapeQueue.add('scrape', { searchParams, userId });
  logger.info('Manual scrape triggered', { jobId: job.id, searchParams, userId });
  return { jobId: job.id };
};

const triggerApplicationProcessing = async () => {
  if (process.env.DISABLE_QUEUES === 'true') {
    logger.info('triggerApplicationProcessing skipped (DISABLE_QUEUES=true)');
    return { jobId: null };
  }
  const job = await applicationQueue.add('process-applications', {});
  logger.info('Manual application processing triggered', { jobId: job.id });
  return { jobId: job.id };
};

const getQueueStats = async () => {
  const [scrapeWaiting, scrapeActive, scrapeCompleted, scrapeFailed] = await Promise.all([
    jobScrapeQueue.getWaitingCount(),
    jobScrapeQueue.getActiveCount(),
    jobScrapeQueue.getCompletedCount(),
    jobScrapeQueue.getFailedCount(),
  ]);

  const [appWaiting, appActive, appCompleted, appFailed] = await Promise.all([
    applicationQueue.getWaitingCount(),
    applicationQueue.getActiveCount(),
    applicationQueue.getCompletedCount(),
    applicationQueue.getFailedCount(),
  ]);

  return {
    scraping: {
      waiting: scrapeWaiting,
      active: scrapeActive,
      completed: scrapeCompleted,
      failed: scrapeFailed,
    },
    applications: {
      waiting: appWaiting,
      active: appActive,
      completed: appCompleted,
      failed: appFailed,
    },
  };
};

const getScrapeStatus = () => {
  if (!scrapeJob) {
    return null;
  }
  return scrapeJob.getStatus();
};

module.exports = {
  initScheduler,
  triggerScrape,
  triggerApplicationProcessing,
  getQueueStats,
  getScrapeStatus,
};
