/**
 * LinkedIn Job Scraper
 * Fetches, parses, deduplicates, and stores job listings
 */
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../utils/config');
const cache = require('../utils/cache');
const jobParser = require('./jobParser');
const deduplicator = require('./deduplicator');
const RateLimiter = require('./rateLimiter');
const RetryHandler = require('./retryHandler');
const { ScraperError } = require('../utils/errorCodes');
const JobModel = require('../database/models/Job');

class JobScraper {
  constructor(options = {}) {
    this.rateLimiter = new RateLimiter({
      maxPerMinute: options.maxPerMinute || config.rateLimit?.maxRequests || 10,
      maxPerHour: options.maxPerHour || 200,
      minDelay: options.minDelay || 2000,
      maxDelay: options.maxDelay || 8000,
    });

    this.retryHandler = new RetryHandler({
      maxRetries: options.maxRetries || config.application?.retryAttempts || 3,
      baseDelay: options.retryDelay || config.application?.retryDelayMs || 5000,
      maxDelay: 30000,
    });

    this.timeout = options.timeout || 30000;
    this.maxJobsPerSearch = options.maxJobsPerSearch || 100;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalJobsScraped: 0,
      totalJobsStored: 0,
      duplicatesSkipped: 0,
      startTime: null,
    };
  }

  /**
   * Main entry: scrape jobs based on search criteria
   */
  async scrapeJobs(searchParams) {
    this.metrics.startTime = Date.now();
    const { keywords, location, jobType, experienceLevel, datePosted } = searchParams;

    logger.info('Starting job scrape', { keywords, location });

    // Check cache first
    const cacheKey = `scrape:${keywords}:${location}:${datePosted || 'any'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached scrape results', { count: cached.length });
      return cached;
    }

    const allJobs = [];
    let page = 0;
    const maxPages = Math.ceil(this.maxJobsPerSearch / 25);

    while (page < maxPages) {
      try {
        const pageJobs = await this._scrapePage(searchParams, page);
        if (!pageJobs || pageJobs.length === 0) {break;}

        allJobs.push(...pageJobs);
        page++;

        if (allJobs.length >= this.maxJobsPerSearch) {break;}
      } catch (err) {
        logger.error('Page scrape failed, stopping pagination', { page, error: err.message });
        break;
      }
    }

    // Deduplicate
    const uniqueJobs = deduplicator.deduplicateBatch(allJobs);
    this.metrics.duplicatesSkipped = allJobs.length - uniqueJobs.length;

    // Normalize all jobs
    const normalizedJobs = uniqueJobs.map(j => jobParser.normalizeJob(j));

    // Cache results
    await cache.set(cacheKey, normalizedJobs, 1800); // 30 min cache

    this.metrics.totalJobsScraped = normalizedJobs.length;
    logger.info('Scrape complete', this.getMetrics());

    return normalizedJobs;
  }

  /**
   * Scrape and store jobs into database
   */
  async scrapeAndStore(searchParams) {
    const jobs = await this.scrapeJobs(searchParams);

    if (jobs.length === 0) {
      logger.info('No jobs to store');
      return { scraped: 0, stored: 0 };
    }

    // Check existing hashes in DB
    try {
      const existingHashes = await JobModel.getExistingHashes();
      const newJobs = deduplicator.deduplicateAgainstDb(jobs, existingHashes);

      if (newJobs.length > 0) {
        const result = await JobModel.bulkInsert(newJobs);
        this.metrics.totalJobsStored = result.inserted;
        return { scraped: jobs.length, stored: result.inserted, updated: result.updated };
      }

      return { scraped: jobs.length, stored: 0 };
    } catch (err) {
      logger.error('Store failed, returning scraped jobs only', { error: err.message });
      return { scraped: jobs.length, stored: 0, error: err.message };
    }
  }

  /**
   * Scrape a single job listing page
   */
  async scrapeJobDetail(url) {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();
      this.metrics.totalRequests++;

      try {
        const html = await this._fetchPage(url);
        const job = jobParser.parseJobListing(html, url);
        this.rateLimiter.reportSuccess();
        this.metrics.successfulRequests++;
        return jobParser.normalizeJob(job);
      } catch (err) {
        this.metrics.failedRequests++;
        const isRateLimit = err.response?.status === 429;
        this.rateLimiter.reportError(isRateLimit);
        throw err;
      }
    }, { url });
  }

  /**
   * Get scraper metrics
   */
  getMetrics() {
    const elapsed = this.metrics.startTime
      ? (Date.now() - this.metrics.startTime) / 1000
      : 0;

    return {
      ...this.metrics,
      elapsedSeconds: elapsed,
      requestsPerSecond: elapsed > 0 ? this.metrics.totalRequests / elapsed : 0,
      successRate: this.metrics.totalRequests > 0
        ? this.metrics.successfulRequests / this.metrics.totalRequests
        : 0,
      rateLimiter: this.rateLimiter.getStatus(),
      deduplicator: deduplicator.getStats(),
    };
  }

  /**
   * Reset scraper state
   */
  reset() {
    this.rateLimiter.reset();
    deduplicator.reset();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalJobsScraped: 0,
      totalJobsStored: 0,
      duplicatesSkipped: 0,
      startTime: null,
    };
  }

  // --- Private ---

  async _scrapePage(searchParams, page) {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();
      this.metrics.totalRequests++;

      const url = this._buildSearchUrl(searchParams, page);

      try {
        const html = await this._fetchPage(url);
        const jobs = jobParser.parseSearchResults(html);
        this.rateLimiter.reportSuccess();
        this.metrics.successfulRequests++;
        return jobs;
      } catch (err) {
        this.metrics.failedRequests++;
        const isRateLimit = err.response?.status === 429;
        this.rateLimiter.reportError(isRateLimit);
        throw new ScraperError(
          isRateLimit ? 'SCRAPE_RATE_LIMITED' : 'SCRAPE_FAILED',
          { url, page },
          err
        );
      }
    }, { page });
  }

  async _fetchPage(url) {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent': this._getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      },
      maxRedirects: 3,
    });

    if (response.status === 429) {
      throw new ScraperError('SCRAPE_RATE_LIMITED', { url });
    }

    if (response.status !== 200) {
      throw new ScraperError('SCRAPE_FAILED', { url, status: response.status });
    }

    return response.data;
  }

  _buildSearchUrl(params, page) {
    const base = 'https://www.linkedin.com/jobs/search/';
    const queryParams = new URLSearchParams();

    if (params.keywords) {queryParams.set('keywords', params.keywords);}
    if (params.location) {queryParams.set('location', params.location);}
    if (params.jobType) {queryParams.set('f_JT', params.jobType);}
    if (params.experienceLevel) {queryParams.set('f_E', params.experienceLevel);}
    if (params.datePosted) {queryParams.set('f_TPR', params.datePosted);}
    if (page > 0) {queryParams.set('start', String(page * 25));}

    return `${base}?${queryParams.toString()}`;
  }

  _getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }
}

module.exports = JobScraper;
