/**
 * Rate Limiter for LinkedIn application submissions
 * Per-company and global rate limiting with sliding window tracking
 */
const logger = require('../utils/logger');

const DEFAULT_OPTIONS = {
  maxPerHourPerCompany: 8,
  maxPerHourGlobal: 25,
  maxPerDayGlobal: 200,
  minIntervalMs: 30000,
  cooldownMs: 300000,
};

class RateLimiter {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Sliding window tracking (company-level)
    this.companyBuckets = new Map();
    this.globalBucket = [];
    this.dailyCount = 0;
    this.lastSubmissionTime = 0;
    this.cooldownUntil = 0;

    // Legacy scraper-level tracking
    this.maxRequestsPerMinute = options.maxPerMinute ?? 10;
    this.maxRequestsPerHour = options.maxPerHour ?? 200;
    this.minDelay = options.minDelay ?? 2000;
    this.maxDelay = options.maxDelay ?? 10000;
    this.minuteWindow = [];
    this.hourWindow = [];
    this.tokens = this.maxRequestsPerMinute;
    this.lastRefill = Date.now();
    this.consecutiveErrors = 0;
    this.backoffUntil = 0;
  }

  /**
   * Check if a submission can proceed for a given company
   * @param {string|null} companyId
   * @returns {{ allowed: boolean, reason?: string, retryAfterMs?: number }}
   */
  canSubmit(companyId) {
    const now = Date.now();

    // Check cooldown
    if (now < this.cooldownUntil) {
      return {
        allowed: false,
        reason: 'cooldown_active',
        retryAfterMs: this.cooldownUntil - now,
      };
    }

    // Check min interval
    if (this.lastSubmissionTime > 0) {
      const elapsed = now - this.lastSubmissionTime;
      if (elapsed < this.options.minIntervalMs) {
        return {
          allowed: false,
          reason: 'min_interval',
          retryAfterMs: this.options.minIntervalMs - elapsed,
        };
      }
    }

    // Check company hourly limit
    if (companyId) {
      const key = companyId.toLowerCase();
      const companyTimestamps = this.companyBuckets.get(key) || [];
      const hourAgo = now - 3600000;
      const recentCompany = companyTimestamps.filter((t) => t > hourAgo);
      if (recentCompany.length >= this.options.maxPerHourPerCompany) {
        return {
          allowed: false,
          reason: 'company_hourly_limit',
          retryAfterMs: recentCompany[0] + 3600000 - now,
        };
      }
    }

    // Check global hourly limit
    const hourAgo = now - 3600000;
    const recentGlobal = this.globalBucket.filter((t) => t > hourAgo);
    if (recentGlobal.length >= this.options.maxPerHourGlobal) {
      return {
        allowed: false,
        reason: 'global_hourly_limit',
        retryAfterMs: recentGlobal[0] + 3600000 - now,
      };
    }

    // Check daily limit
    if (this.dailyCount >= this.options.maxPerDayGlobal) {
      return {
        allowed: false,
        reason: 'daily_limit_reached',
        retryAfterMs: 0,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a submission for a given company
   * @param {string|null} companyId
   */
  recordSubmission(companyId) {
    const now = Date.now();
    this.lastSubmissionTime = now;
    this.dailyCount++;
    this.globalBucket.push(now);

    if (companyId) {
      const key = companyId.toLowerCase();
      if (!this.companyBuckets.has(key)) {
        this.companyBuckets.set(key, []);
      }
      this.companyBuckets.get(key).push(now);
    }

    logger.debug('Rate limiter recorded submission', {
      companyId,
      dailyCount: this.dailyCount,
      globalBucketSize: this.globalBucket.length,
    });
  }

  /**
   * Activate cooldown period
   * @param {number} [durationMs] - Duration in ms, defaults to options.cooldownMs
   */
  activateCooldown(durationMs) {
    const duration = durationMs !== undefined ? durationMs : this.options.cooldownMs;
    this.cooldownUntil = Date.now() + duration;
    logger.warn('Rate limiter cooldown activated', { durationMs: duration });
  }

  /**
   * Get the wait time before a submission can proceed
   * @param {string|null} companyId
   * @returns {number} milliseconds to wait (0 if can proceed now)
   */
  getWaitTime(companyId) {
    const result = this.canSubmit(companyId);
    if (result.allowed) {
      return 0;
    }
    return result.retryAfterMs || 0;
  }

  /**
   * Legacy: check if can proceed (scraper-level)
   */
  canProceed() {
    if (Date.now() < this.backoffUntil) {
      return false;
    }
    this._refillTokens();
    return this.tokens > 0;
  }

  /**
   * Legacy: acquire a token (scraper-level)
   */
  async acquire() {
    this._refillTokens();
    this.tokens = Math.max(0, this.tokens - 1);
    const now = Date.now();
    this.minuteWindow.push(now);
    this.hourWindow.push(now);
    // Clean old entries
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    this.minuteWindow = this.minuteWindow.filter((t) => t > oneMinuteAgo);
    this.hourWindow = this.hourWindow.filter((t) => t > oneHourAgo);
  }

  /**
   * Legacy: report a successful request
   */
  reportSuccess() {
    this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
  }

  /**
   * Legacy: report an error
   */
  reportError(isRateLimit = false) {
    this.consecutiveErrors++;
    const baseDelay = isRateLimit ? 60000 : 5000;
    const backoff = baseDelay * Math.pow(2, this.consecutiveErrors - 1);
    this.backoffUntil = Date.now() + Math.min(backoff, 300000);
  }

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
    const oneHourAgo = Date.now() - 3600000;
    const recentRequests = this.hourWindow.filter((t) => t > oneHourAgo);
    return recentRequests.length >= this.maxRequestsPerHour;
  }

  /**
   * Get comprehensive status
   */
  getStatus() {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recentGlobal = this.globalBucket.filter((t) => t > hourAgo);

    const companyStats = {};
    for (const [key, timestamps] of this.companyBuckets.entries()) {
      const recentCompany = timestamps.filter((t) => t > hourAgo);
      companyStats[key] = {
        hourlyCount: recentCompany.length,
        hourlyRemaining: Math.max(0, this.options.maxPerHourPerCompany - recentCompany.length),
      };
    }

    // Clean legacy windows
    const oneMinuteAgo = now - 60000;
    const recentMinute = this.minuteWindow.filter((t) => t > oneMinuteAgo);
    const recentHour = this.hourWindow.filter((t) => t > hourAgo);

    return {
      // New application-level fields
      dailyCount: this.dailyCount,
      dailyRemaining: Math.max(0, this.options.maxPerDayGlobal - this.dailyCount),
      globalHourlyCount: recentGlobal.length,
      globalHourlyRemaining: Math.max(0, this.options.maxPerHourGlobal - recentGlobal.length),
      inCooldown: now < this.cooldownUntil,
      cooldownRemainingMs: Math.max(0, this.cooldownUntil - now),
      companyStats,
      lastSubmissionTime: this.lastSubmissionTime > 0 ? new Date(this.lastSubmissionTime) : null,
      // Legacy scraper-level fields
      availableTokens: this.tokens,
      requestsLastMinute: recentMinute.length,
      requestsLastHour: recentHour.length,
      isBackedOff: now < this.backoffUntil,
      backoffRemaining: Math.max(0, this.backoffUntil - now),
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  /**
   * Reset all state
   */
  reset() {
    this.companyBuckets = new Map();
    this.globalBucket = [];
    this.dailyCount = 0;
    this.lastSubmissionTime = 0;
    this.cooldownUntil = 0;
    // Legacy
    this.minuteWindow = [];
    this.hourWindow = [];
    this.tokens = this.maxRequestsPerMinute;
    this.lastRefill = Date.now();
    this.consecutiveErrors = 0;
    this.backoffUntil = 0;
  }
}

module.exports = RateLimiter;
module.exports.RateLimiter = RateLimiter;
module.exports.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
