jest.mock('../../../src/scheduler/queue', () => {
  const createMockQueue = () => ({
    process: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(5),
    getFailedCount: jest.fn().mockResolvedValue(1),
  });
  return {
    jobScrapeQueue: createMockQueue(),
    applicationQueue: createMockQueue(),
    notificationQueue: createMockQueue(),
  };
});

jest.mock('../../../src/scheduler/jobs/scrapeJobsJob');
jest.mock('../../../src/scheduler/jobs/processApplications');
jest.mock('../../../src/scheduler/jobs/cleanupJob');
jest.mock('../../../src/utils/logger');

const { initScheduler, triggerScrape, triggerApplicationProcessing, getQueueStats } = require('../../../src/scheduler/schedulerInit');
const { jobScrapeQueue, applicationQueue } = require('../../../src/scheduler/queue');

describe('schedulerInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initScheduler', () => {
    it('should register job processors', () => {
      initScheduler();

      expect(jobScrapeQueue.process).toHaveBeenCalledWith('scrape', 2, expect.any(Function));
      expect(applicationQueue.process).toHaveBeenCalledWith('process-applications', 1, expect.any(Function));
    });

    it('should schedule recurring jobs', () => {
      initScheduler();

      expect(jobScrapeQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.objectContaining({ scheduled: true }),
        expect.objectContaining({ repeat: { cron: '0 */4 * * *' } }),
      );

      expect(applicationQueue.add).toHaveBeenCalledWith(
        'process-applications',
        {},
        expect.objectContaining({ repeat: { cron: '*/15 * * * *' } }),
      );
    });

    it('should return queue references', () => {
      const result = initScheduler();
      expect(result.jobScrapeQueue).toBeDefined();
      expect(result.applicationQueue).toBeDefined();
      expect(result.notificationQueue).toBeDefined();
    });
  });

  describe('triggerScrape', () => {
    it('should add a scrape job with params', async () => {
      const result = await triggerScrape({ role: 'Engineer' }, 'user-1');

      expect(jobScrapeQueue.add).toHaveBeenCalledWith('scrape', {
        searchParams: { role: 'Engineer' },
        userId: 'user-1',
      });
      expect(result.jobId).toBe('mock-job-id');
    });

    it('should use defaults when no params', async () => {
      const result = await triggerScrape();

      expect(jobScrapeQueue.add).toHaveBeenCalledWith('scrape', {
        searchParams: {},
        userId: null,
      });
      expect(result.jobId).toBe('mock-job-id');
    });
  });

  describe('triggerApplicationProcessing', () => {
    it('should add an application processing job', async () => {
      const result = await triggerApplicationProcessing();

      expect(applicationQueue.add).toHaveBeenCalledWith('process-applications', {});
      expect(result.jobId).toBe('mock-job-id');
    });
  });

  describe('getQueueStats', () => {
    it('should return stats for both queues', async () => {
      const stats = await getQueueStats();

      expect(stats.scraping).toEqual({
        waiting: 0,
        active: 0,
        completed: 5,
        failed: 1,
      });
      expect(stats.applications).toEqual({
        waiting: 0,
        active: 0,
        completed: 5,
        failed: 1,
      });
    });
  });
});
