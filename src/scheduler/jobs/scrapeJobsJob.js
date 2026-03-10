/**
 * Scheduled job: Scrape LinkedIn jobs on a schedule
 */
const JobScraper = require('../../automation/jobScraper');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');

class ScrapeJobsJob {
  constructor(options = {}) {
    this.scraper = new JobScraper(options.scraperOptions);
    this.searchConfigs = options.searchConfigs || [];
    this.isRunning = false;
    this.lastRun = null;
    this.lastResult = null;
  }

  /**
   * Execute the scrape job
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('Scrape job already running, skipping');
      return { skipped: true };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const results = [];

    try {
      for (const searchConfig of this.searchConfigs) {
        try {
          logger.info('Starting scrape for config', { keywords: searchConfig.keywords });
          const result = await this.scraper.scrapeAndStore(searchConfig);
          results.push({ ...result, config: searchConfig });
        } catch (err) {
          logger.error('Scrape config failed', {
            config: searchConfig,
            error: err.message,
          });
          results.push({ error: err.message, config: searchConfig });
        }
      }

      const summary = {
        totalScraped: results.reduce((sum, r) => sum + (r.scraped || 0), 0),
        totalStored: results.reduce((sum, r) => sum + (r.stored || 0), 0),
        totalErrors: results.filter(r => r.error).length,
        duration: Date.now() - startTime,
        configs: results.length,
      };

      this.lastRun = new Date();
      this.lastResult = summary;

      // Cache the summary
      await cache.set('scrape:lastRun', summary, 86400);

      logger.info('Scrape job complete', summary);
      return summary;
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
      scraperMetrics: this.scraper.getMetrics(),
    };
  }
}

module.exports = ScrapeJobsJob;
