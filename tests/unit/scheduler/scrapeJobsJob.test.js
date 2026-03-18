jest.mock('../../../src/automation/jobScraper');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  has: jest.fn().mockResolvedValue(false),
}));

const ScrapeJobsJob = require('../../../src/scheduler/jobs/scrapeJobsJob');
const JobScraper = require('../../../src/automation/jobScraper');

describe('ScrapeJobsJob', () => {
  let mockScraper;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScraper = {
      scrapeAndStore: jest.fn().mockResolvedValue({ scraped: 10, stored: 8 }),
      getMetrics: jest.fn().mockReturnValue({ totalRequests: 5 }),
    };
    JobScraper.mockImplementation(() => mockScraper);
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const job = new ScrapeJobsJob();
      expect(job.isRunning).toBe(false);
      expect(job.lastRun).toBeNull();
      expect(job.lastResult).toBeNull();
      expect(job.searchConfigs).toEqual([]);
    });

    it('should accept search configs', () => {
      const configs = [{ keywords: 'Engineer', location: 'SF' }];
      const job = new ScrapeJobsJob({ searchConfigs: configs });
      expect(job.searchConfigs).toEqual(configs);
    });
  });

  describe('execute', () => {
    it('should scrape for each config', async () => {
      const configs = [{ keywords: 'Engineer' }, { keywords: 'Developer' }];
      const job = new ScrapeJobsJob({ searchConfigs: configs });

      const result = await job.execute();

      expect(mockScraper.scrapeAndStore).toHaveBeenCalledTimes(2);
      expect(result.totalScraped).toBe(20);
      expect(result.totalStored).toBe(16);
      expect(result.configs).toBe(2);
    });

    it('should skip when already running', async () => {
      const job = new ScrapeJobsJob({ searchConfigs: [{ keywords: 'Eng' }] });
      job.isRunning = true;

      const result = await job.execute();

      expect(result.skipped).toBe(true);
      expect(mockScraper.scrapeAndStore).not.toHaveBeenCalled();
    });

    it('should handle config failures gracefully', async () => {
      mockScraper.scrapeAndStore
        .mockResolvedValueOnce({ scraped: 5, stored: 3 })
        .mockRejectedValueOnce(new Error('Scrape failed'));

      const job = new ScrapeJobsJob({
        searchConfigs: [{ keywords: 'A' }, { keywords: 'B' }],
      });

      const result = await job.execute();

      expect(result.totalErrors).toBe(1);
      expect(result.totalScraped).toBe(5);
    });

    it('should reset isRunning after execution', async () => {
      const job = new ScrapeJobsJob({ searchConfigs: [{ keywords: 'Eng' }] });

      await job.execute();

      expect(job.isRunning).toBe(false);
    });

    it('should reset isRunning even on error', async () => {
      mockScraper.scrapeAndStore.mockRejectedValue(new Error('fail'));
      const job = new ScrapeJobsJob({ searchConfigs: [{ keywords: 'Eng' }] });

      await job.execute();

      expect(job.isRunning).toBe(false);
    });

    it('should set lastRun and lastResult', async () => {
      const job = new ScrapeJobsJob({ searchConfigs: [{ keywords: 'Eng' }] });

      await job.execute();

      expect(job.lastRun).toBeInstanceOf(Date);
      expect(job.lastResult).toBeDefined();
      expect(job.lastResult.totalScraped).toBe(10);
    });

    it('should track duration', async () => {
      const job = new ScrapeJobsJob({ searchConfigs: [{ keywords: 'Eng' }] });

      const result = await job.execute();

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty search configs', async () => {
      const job = new ScrapeJobsJob({ searchConfigs: [] });

      const result = await job.execute();

      expect(result.totalScraped).toBe(0);
      expect(result.configs).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const job = new ScrapeJobsJob({ searchConfigs: [] });
      const status = job.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('lastRun');
      expect(status).toHaveProperty('lastResult');
      expect(status).toHaveProperty('scraperMetrics');
    });
  });
});
