/**
 * Unit tests for JobScraper class
 */

jest.mock('axios');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../../src/utils/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/automation/jobParser', () => ({
  parseSearchResults: jest.fn().mockReturnValue([]),
  parseJobListing: jest.fn().mockReturnValue({}),
  normalizeJob: jest.fn((j) => ({ ...j, normalized: true })),
}));
jest.mock('../../../src/automation/deduplicator', () => ({
  deduplicateBatch: jest.fn((jobs) => jobs),
  deduplicateAgainstDb: jest.fn((jobs) => jobs),
  getStats: jest.fn().mockReturnValue({ totalSeen: 0 }),
  reset: jest.fn(),
}));
jest.mock('../../../src/database/models/Job', () => ({
  getExistingHashes: jest.fn().mockResolvedValue([]),
  bulkInsert: jest.fn().mockResolvedValue({ inserted: 0, updated: 0 }),
}));

const axios = require('axios');
const cache = require('../../../src/utils/cache');
const jobParser = require('../../../src/automation/jobParser');
const deduplicator = require('../../../src/automation/deduplicator');
const JobModel = require('../../../src/database/models/Job');
const JobScraper = require('../../../src/automation/jobScraper');

describe('JobScraper', () => {
  let scraper;

  beforeEach(() => {
    jest.clearAllMocks();
    scraper = new JobScraper({
      maxPerMinute: 100,
      maxPerHour: 1000,
      minDelay: 0,
      maxDelay: 0,
      maxRetries: 1,
      retryDelay: 0,
      timeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const s = new JobScraper();
      expect(s.timeout).toBe(30000);
      expect(s.maxJobsPerSearch).toBe(100);
      expect(s.metrics.totalRequests).toBe(0);
    });

    it('should accept custom options', () => {
      const s = new JobScraper({ timeout: 15000, maxJobsPerSearch: 50 });
      expect(s.timeout).toBe(15000);
      expect(s.maxJobsPerSearch).toBe(50);
    });

    it('should have user agents list', () => {
      expect(scraper.userAgents.length).toBeGreaterThan(0);
    });

    it('should initialize metrics to zero', () => {
      expect(scraper.metrics).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalJobsScraped: 0,
        totalJobsStored: 0,
        duplicatesSkipped: 0,
        startTime: null,
      });
    });

    it('should create a rate limiter', () => {
      expect(scraper.rateLimiter).toBeDefined();
      expect(typeof scraper.rateLimiter.acquire).toBe('function');
    });

    it('should create a retry handler', () => {
      expect(scraper.retryHandler).toBeDefined();
      expect(typeof scraper.retryHandler.execute).toBe('function');
    });
  });

  describe('scrapeJobs', () => {
    const searchParams = { keywords: 'developer', location: 'NYC' };

    it('should return cached results if available', async () => {
      const cachedJobs = [{ title: 'Cached Job' }];
      cache.get.mockResolvedValueOnce(cachedJobs);

      const result = await scraper.scrapeJobs(searchParams);
      expect(result).toEqual(cachedJobs);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should scrape and parse jobs when no cache', async () => {
      const mockJobs = [
        { title: 'Engineer', company: 'Co' },
        { title: 'Dev', company: 'Corp' },
      ];
      jobParser.parseSearchResults.mockReturnValueOnce(mockJobs);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });

      await scraper.scrapeJobs(searchParams);
      expect(jobParser.parseSearchResults).toHaveBeenCalled();
      expect(deduplicator.deduplicateBatch).toHaveBeenCalled();
    });

    it('should cache results after scraping', async () => {
      const mockJobs = [{ title: 'Job1' }];
      jobParser.parseSearchResults.mockReturnValueOnce(mockJobs);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });

      await scraper.scrapeJobs(searchParams);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should stop pagination when no jobs returned', async () => {
      jobParser.parseSearchResults.mockReturnValue([]);
      axios.get.mockResolvedValue({ status: 200, data: '<html></html>' });

      const result = await scraper.scrapeJobs(searchParams);
      expect(result).toEqual([]);
    });

    it('should handle scrape page errors gracefully', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await scraper.scrapeJobs(searchParams);
      expect(result).toEqual([]);
    });

    it('should set startTime metric', async () => {
      jobParser.parseSearchResults.mockReturnValueOnce([{ title: 'Job1' }]);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });

      await scraper.scrapeJobs(searchParams);
      expect(scraper.metrics.startTime).toBeTruthy();
    });

    it('should normalize jobs via jobParser', async () => {
      jobParser.parseSearchResults.mockReturnValueOnce([{ title: 'Job1' }]);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });

      await scraper.scrapeJobs(searchParams);
      expect(jobParser.normalizeJob).toHaveBeenCalled();
    });

    it('should track duplicates skipped count', async () => {
      const allJobs = [{ title: 'A' }, { title: 'B' }, { title: 'A' }];
      jobParser.parseSearchResults.mockReturnValueOnce(allJobs);
      deduplicator.deduplicateBatch.mockReturnValueOnce([allJobs[0], allJobs[1]]);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });

      await scraper.scrapeJobs(searchParams);
      expect(scraper.metrics.duplicatesSkipped).toBe(1);
    });

    it('should construct cache key from search params', async () => {
      await scraper.scrapeJobs({ keywords: 'test', location: 'LA', datePosted: 'r86400' });
      expect(cache.get).toHaveBeenCalledWith('scrape:test:LA:r86400');
    });

    it('should use "any" for missing datePosted in cache key', async () => {
      await scraper.scrapeJobs({ keywords: 'dev', location: 'NYC' });
      expect(cache.get).toHaveBeenCalledWith('scrape:dev:NYC:any');
    });

    it('should cache with 30 minute TTL', async () => {
      jobParser.parseSearchResults.mockReturnValueOnce([{ title: 'Job1' }]);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });

      await scraper.scrapeJobs(searchParams);
      expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 1800);
    });
  });

  describe('scrapeAndStore', () => {
    const searchParams = { keywords: 'engineer', location: 'SF' };

    it('should return zero counts when no jobs found', async () => {
      jobParser.parseSearchResults.mockReturnValue([]);
      axios.get.mockResolvedValue({ status: 200, data: '' });

      const result = await scraper.scrapeAndStore(searchParams);
      expect(result).toEqual({ scraped: 0, stored: 0 });
    });

    it('should store new jobs in database', async () => {
      const jobs = [{ title: 'Job1', hash: 'h1' }];
      jobParser.parseSearchResults.mockReturnValueOnce(jobs);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
      JobModel.getExistingHashes.mockResolvedValueOnce([]);
      JobModel.bulkInsert.mockResolvedValueOnce({ inserted: 1, updated: 0 });

      const result = await scraper.scrapeAndStore(searchParams);
      expect(result.stored).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      const jobs = [{ title: 'Job1' }];
      jobParser.parseSearchResults.mockReturnValueOnce(jobs);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
      JobModel.getExistingHashes.mockRejectedValueOnce(new Error('DB error'));

      const result = await scraper.scrapeAndStore(searchParams);
      expect(result.error).toBe('DB error');
      expect(result.stored).toBe(0);
    });

    it('should skip already existing jobs', async () => {
      const jobs = [{ title: 'Job1', hash: 'existing' }];
      jobParser.parseSearchResults.mockReturnValueOnce(jobs);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
      JobModel.getExistingHashes.mockResolvedValueOnce(['existing']);
      deduplicator.deduplicateAgainstDb.mockReturnValueOnce([]);

      const result = await scraper.scrapeAndStore(searchParams);
      expect(result.stored).toBe(0);
    });

    it('should call deduplicateAgainstDb with existing hashes', async () => {
      const jobs = [{ title: 'Job1' }];
      jobParser.parseSearchResults.mockReturnValueOnce(jobs);
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
      JobModel.getExistingHashes.mockResolvedValueOnce(['hash1', 'hash2']);

      await scraper.scrapeAndStore(searchParams);
      expect(deduplicator.deduplicateAgainstDb).toHaveBeenCalledWith(expect.any(Array), [
        'hash1',
        'hash2',
      ]);
    });
  });

  describe('scrapeJobDetail', () => {
    it('should fetch and parse a single job page', async () => {
      const html = '<html><h1>Senior Dev</h1></html>';
      axios.get.mockResolvedValueOnce({ status: 200, data: html });
      jobParser.parseJobListing.mockReturnValueOnce({ title: 'Senior Dev' });

      const result = await scraper.scrapeJobDetail('https://linkedin.com/jobs/view/123');
      expect(jobParser.parseJobListing).toHaveBeenCalledWith(
        html,
        'https://linkedin.com/jobs/view/123',
      );
      expect(result.normalized).toBe(true);
    });

    it('should increment successfulRequests on success', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
      jobParser.parseJobListing.mockReturnValueOnce({ title: 'Dev' });

      await scraper.scrapeJobDetail('https://linkedin.com/jobs/view/123');
      expect(scraper.metrics.successfulRequests).toBe(1);
    });

    it('should throw on persistent failure', async () => {
      axios.get.mockRejectedValue(new Error('Timeout'));

      await expect(scraper.scrapeJobDetail('https://linkedin.com/jobs/view/123')).rejects.toThrow();
    });

    it('should normalize the parsed job', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
      jobParser.parseJobListing.mockReturnValueOnce({ title: 'Dev' });

      await scraper.scrapeJobDetail('https://linkedin.com/jobs/view/1');
      expect(jobParser.normalizeJob).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should calculate elapsed time', () => {
      scraper.metrics.startTime = Date.now() - 5000;
      scraper.metrics.totalRequests = 10;
      scraper.metrics.successfulRequests = 8;

      const metrics = scraper.getMetrics();
      expect(metrics.elapsedSeconds).toBeGreaterThan(4);
      expect(metrics.successRate).toBe(0.8);
    });

    it('should return zero elapsed when not started', () => {
      const metrics = scraper.getMetrics();
      expect(metrics.elapsedSeconds).toBe(0);
      expect(metrics.requestsPerSecond).toBe(0);
    });

    it('should include rate limiter status', () => {
      const metrics = scraper.getMetrics();
      expect(metrics.rateLimiter).toBeDefined();
    });

    it('should include deduplicator stats', () => {
      const metrics = scraper.getMetrics();
      expect(metrics.deduplicator).toBeDefined();
    });

    it('should calculate requests per second', () => {
      scraper.metrics.startTime = Date.now() - 10000;
      scraper.metrics.totalRequests = 20;
      const metrics = scraper.getMetrics();
      expect(metrics.requestsPerSecond).toBeCloseTo(2, 0);
    });

    it('should calculate zero success rate when no requests', () => {
      const metrics = scraper.getMetrics();
      expect(metrics.successRate).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to initial state', () => {
      scraper.metrics.totalRequests = 100;
      scraper.metrics.successfulRequests = 80;
      scraper.metrics.startTime = Date.now();
      scraper.reset();

      expect(scraper.metrics.totalRequests).toBe(0);
      expect(scraper.metrics.successfulRequests).toBe(0);
      expect(scraper.metrics.startTime).toBeNull();
    });

    it('should reset deduplicator', () => {
      scraper.reset();
      expect(deduplicator.reset).toHaveBeenCalled();
    });

    it('should reset failedRequests', () => {
      scraper.metrics.failedRequests = 5;
      scraper.reset();
      expect(scraper.metrics.failedRequests).toBe(0);
    });

    it('should reset totalJobsStored', () => {
      scraper.metrics.totalJobsStored = 50;
      scraper.reset();
      expect(scraper.metrics.totalJobsStored).toBe(0);
    });
  });

  describe('_buildSearchUrl', () => {
    it('should build URL with keywords', () => {
      const url = scraper._buildSearchUrl({ keywords: 'developer' }, 0);
      expect(url).toContain('keywords=developer');
    });

    it('should build URL with location', () => {
      const url = scraper._buildSearchUrl({ location: 'San Francisco' }, 0);
      expect(url).toContain('location=');
    });

    it('should include pagination for page > 0', () => {
      const url = scraper._buildSearchUrl({ keywords: 'dev' }, 2);
      expect(url).toContain('start=50');
    });

    it('should not include start for page 0', () => {
      const url = scraper._buildSearchUrl({ keywords: 'dev' }, 0);
      expect(url).not.toContain('start=');
    });

    it('should include job type filter', () => {
      const url = scraper._buildSearchUrl({ jobType: 'F' }, 0);
      expect(url).toContain('f_JT=F');
    });

    it('should include experience level filter', () => {
      const url = scraper._buildSearchUrl({ experienceLevel: '4' }, 0);
      expect(url).toContain('f_E=4');
    });

    it('should include date posted filter', () => {
      const url = scraper._buildSearchUrl({ datePosted: 'r86400' }, 0);
      expect(url).toContain('f_TPR=r86400');
    });

    it('should use linkedin base URL', () => {
      const url = scraper._buildSearchUrl({}, 0);
      expect(url).toContain('https://www.linkedin.com/jobs/search/');
    });

    it('should handle all params together', () => {
      const url = scraper._buildSearchUrl(
        {
          keywords: 'dev',
          location: 'NYC',
          jobType: 'F',
          experienceLevel: '4',
          datePosted: 'r86400',
        },
        1,
      );
      expect(url).toContain('keywords=dev');
      expect(url).toContain('start=25');
    });
  });

  describe('_getRandomUserAgent', () => {
    it('should return a string', () => {
      const ua = scraper._getRandomUserAgent();
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(0);
    });

    it('should return one of the configured user agents', () => {
      const ua = scraper._getRandomUserAgent();
      expect(scraper.userAgents).toContain(ua);
    });

    it('should contain browser identifier', () => {
      const ua = scraper._getRandomUserAgent();
      expect(ua).toContain('Chrome');
    });
  });
});
