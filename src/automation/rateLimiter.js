/**
 * Rate Limiter for LinkedIn scraping
 * Token bucket + sliding window implementation
 */
const logger = require('../utils/logger');

class RateLimiter {
  constructor(options = {}) {
    this.maxRequestsPerMinute = options.maxPerMinute || 10;
    this.maxRequestsPerHour = options.maxPerHour || 200;
    this.minDelay = options.minDelay || 2000;
    this.maxDelay = options.maxDelay || 10000;

    // Sliding window tracking
    this.minuteWindow = [];
    this.hourWindow = [];

    // Token bucket
    this.tokens = this.maxRequestsPerMinute;
    this.lastRefill = Date.now();

    // Backoff state
    this.consecutiveErrors = 0;
    this.backoffUntil = 0;
  }

  /**
   * Wait until a request can be made
   */
  async acquire() {
    // Check backoff
    if (Date.now() < this.backoffUntil) {
      const waitTime = this.backoffUntil - Date.now();
      logger.debug('Rate limiter backoff', { waitMs: waitTime });
      await this._sleep(waitTime);
    }

    // Refill tokens
    this._refillTokens();

    // Wait for available token
    while (this.tokens <= 0 || this._isHourlyLimitReached()) {
      const waitTime = this._calculateWaitTime();
      logger.debug('Rate limiter waiting', { waitMs: waitTime, tokens: this.tokens });
      await this._sleep(waitTime);
      this._refillTokens();
    }

    // Consume token
    this.tokens--;
    const now = Date.now();
    this.minuteWindow.push(now);
    this.hourWindow.push(now);

    // Clean old entries
    this._cleanWindows();

    // Add jitter delay
    const jitter = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
    await this._sleep(jitter);
  }

  /**
   * Report a successful request
   */
  reportSuccess() {
    this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
  }

  /**
   * Report a failed request (triggers exponential backoff)
   */
  reportError(isRateLimit = false) {
    this.consecutiveErrors++;

    if (isRateLimit) {
      // Aggressive backoff for rate limit responses
      const backoff = Math.min(300000, 30000 * Math.pow(2, this.consecutiveErrors));
      this.backoffUntil = Date.now() + backoff;
      logger.warn('Rate limit detected, backing off', { backoffMs: backoff, errors: this.consecutiveErrors });
    } else {
      const backoff = Math.min(60000, 5000 * Math.pow(2, this.consecutiveErrors - 1));
      this.backoffUntil = Date.now() + backoff;
    }
  }

  /**
   * Check if we can make a request right now (non-blocking)
   */
  canProceed() {
    if (Date.now() < this.backoffUntil) {return false;}
    this._refillTokens();
    return this.tokens > 0 && !this._isHourlyLimitReached();
  }

  /**
   * Get current rate limiter status
   */
  getStatus() {
    this._cleanWindows();
    return {
      availableTokens: Math.max(0, this.tokens),
      requestsLastMinute: this.minuteWindow.length,
      requestsLastHour: this.hourWindow.length,
      isBackedOff: Date.now() < this.backoffUntil,
      backoffRemaining: Math.max(0, this.backoffUntil - Date.now()),
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  /**
   * Reset the rate limiter state
   */
  reset() {
    this.minuteWindow = [];
    this.hourWindow = [];
    this.tokens = this.maxRequestsPerMinute;
    this.lastRefill = Date.now();
    this.consecutiveErrors = 0;
    this.backoffUntil = 0;
  }

  // --- Private ---

  _refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / (60000 / this.maxRequestsPerMinute));
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxRequestsPerMinute, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  _isHourlyLimitReached() {
    this._cleanWindows();
    return this.hourWindow.length >= this.maxRequestsPerHour;
  }

  _calculateWaitTime() {
    if (this._isHourlyLimitReached()) {
      // Wait until oldest hourly request expires
      return Math.max(1000, this.hourWindow[0] + 3600000 - Date.now());
    }
    return Math.max(1000, 60000 / this.maxRequestsPerMinute);
  }

  _cleanWindows() {
    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    this.minuteWindow = this.minuteWindow.filter(t => t > minuteAgo);
    this.hourWindow = this.hourWindow.filter(t => t > hourAgo);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RateLimiter;
