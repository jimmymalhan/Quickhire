/**
 * Retry Handler with exponential backoff
 */
const logger = require('../utils/logger');
const { ScraperError } = require('../utils/errorCodes');

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitterFactor = options.jitterFactor || 0.1;
  }

  /**
   * Execute a function with retry logic
   */
  async execute(fn, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        if (attempt > 0) {
          logger.info('Retry succeeded', { attempt, context });
        }
        return result;
      } catch (err) {
        lastError = err;

        // Don't retry non-retryable errors
        if (err instanceof ScraperError && !err.retryable) {
          logger.warn('Non-retryable error, not retrying', {
            code: err.code,
            message: err.message,
            context,
          });
          throw err;
        }

        if (attempt < this.maxRetries) {
          const delay = this._calculateDelay(attempt);
          logger.warn('Retrying after error', {
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delayMs: delay,
            error: err.message,
            context,
          });
          await this._sleep(delay);
        }
      }
    }

    logger.error('All retries exhausted', {
      maxRetries: this.maxRetries,
      error: lastError?.message,
      context,
    });

    throw lastError;
  }

  /**
   * Execute multiple functions with retry, collecting results
   */
  async executeBatch(fns, options = {}) {
    const concurrency = options.concurrency || 5;
    const results = [];
    const errors = [];

    for (let i = 0; i < fns.length; i += concurrency) {
      const batch = fns.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((fn, idx) =>
          this.execute(fn, { batchIndex: i + idx })
        )
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(result.reason);
        }
      }
    }

    return { results, errors };
  }

  /**
   * Wrap a function to make it retryable
   */
  wrap(fn) {
    return (...args) => this.execute(() => fn(...args));
  }

  _calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    // Add jitter
    const jitter = cappedDelay * this.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryHandler;
