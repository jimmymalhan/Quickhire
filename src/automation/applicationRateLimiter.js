/**
 * Application Rate Limiter
 * Enforces per-company and global rate limits for job application submissions
 * Complements the scraping RateLimiter with application-specific controls
 */
const logger = require('../utils/logger');

const DEFAULT_OPTIONS = {
  maxPerHourPerCompany: 8,
  maxPerHourGlobal: 25,
  maxPerDayGlobal: 200,
  minIntervalMs: 30000,
  cooldownMs: 300000,
};

class ApplicationRateLimiter {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.companyBuckets = new Map();
    this.globalBucket = [];
    this.dailyCount = 0;
    this.dailyResetTime = this._getNextMidnight();
    this.lastSubmissionTime = 0;
    this.cooldownUntil = 0;
  }

  canSubmit(company) {
    const now = Date.now();
    this._resetDailyIfNeeded(now);

    if (now < this.cooldownUntil) {
      return {
        allowed: false,
        reason: 'cooldown_active',
        retryAfterMs: this.cooldownUntil - now,
      };
    }

    const timeSinceLast = now - this.lastSubmissionTime;
    if (this.lastSubmissionTime > 0 && timeSinceLast < this.options.minIntervalMs) {
      return {
        allowed: false,
        reason: 'min_interval',
        retryAfterMs: this.options.minIntervalMs - timeSinceLast,
      };
    }

    if (this.dailyCount >= this.options.maxPerDayGlobal) {
      return {
        allowed: false,
        reason: 'daily_limit_reached',
        retryAfterMs: this.dailyResetTime - now,
      };
    }

    this._cleanBucket(this.globalBucket, now, 3600000);

    if (this.globalBucket.length >= this.options.maxPerHourGlobal) {
      const oldestInWindow = this.globalBucket[0];
      return {
        allowed: false,
        reason: 'global_hourly_limit',
        retryAfterMs: Math.max(oldestInWindow + 3600000 - now, 0),
      };
    }

    if (company) {
      const companyKey = company.toLowerCase().trim();
      if (!this.companyBuckets.has(companyKey)) {
        this.companyBuckets.set(companyKey, []);
      }
      const companyBucket = this.companyBuckets.get(companyKey);
      this._cleanBucket(companyBucket, now, 3600000);

      if (companyBucket.length >= this.options.maxPerHourPerCompany) {
        const oldestInWindow = companyBucket[0];
        return {
          allowed: false,
          reason: 'company_hourly_limit',
          retryAfterMs: Math.max(oldestInWindow + 3600000 - now, 0),
          company: companyKey,
        };
      }
    }

    return { allowed: true };
  }

  recordSubmission(company) {
    const now = Date.now();
    this._resetDailyIfNeeded(now);

    this.globalBucket.push(now);
    this.dailyCount++;
    this.lastSubmissionTime = now;

    if (company) {
      const companyKey = company.toLowerCase().trim();
      if (!this.companyBuckets.has(companyKey)) {
        this.companyBuckets.set(companyKey, []);
      }
      this.companyBuckets.get(companyKey).push(now);
    }

    logger.debug('Submission recorded', {
      company,
      dailyCount: this.dailyCount,
      globalHourly: this.globalBucket.length,
    });
  }

  activateCooldown(durationMs) {
    const duration = durationMs || this.options.cooldownMs;
    this.cooldownUntil = Date.now() + duration;
    logger.warn('Rate limiter cooldown activated', { durationMs: duration });
  }

  getStatus() {
    const now = Date.now();
    this._resetDailyIfNeeded(now);
    this._cleanBucket(this.globalBucket, now, 3600000);

    const companyStats = {};
    for (const [company, bucket] of this.companyBuckets.entries()) {
      this._cleanBucket(bucket, now, 3600000);
      companyStats[company] = {
        hourlyCount: bucket.length,
        hourlyRemaining: Math.max(0, this.options.maxPerHourPerCompany - bucket.length),
      };
    }

    return {
      dailyCount: this.dailyCount,
      dailyRemaining: Math.max(0, this.options.maxPerDayGlobal - this.dailyCount),
      globalHourlyCount: this.globalBucket.length,
      globalHourlyRemaining: Math.max(0, this.options.maxPerHourGlobal - this.globalBucket.length),
      inCooldown: now < this.cooldownUntil,
      cooldownRemainingMs: Math.max(0, this.cooldownUntil - now),
      companyStats,
      lastSubmissionTime: this.lastSubmissionTime > 0 ? new Date(this.lastSubmissionTime) : null,
    };
  }

  getWaitTime(company) {
    const check = this.canSubmit(company);
    return check.allowed ? 0 : check.retryAfterMs || 0;
  }

  reset() {
    this.companyBuckets.clear();
    this.globalBucket = [];
    this.dailyCount = 0;
    this.dailyResetTime = this._getNextMidnight();
    this.lastSubmissionTime = 0;
    this.cooldownUntil = 0;
  }

  _cleanBucket(bucket, now, windowMs) {
    const cutoff = now - windowMs;
    while (bucket.length > 0 && bucket[0] < cutoff) {
      bucket.shift();
    }
  }

  _resetDailyIfNeeded(now) {
    if (now >= this.dailyResetTime) {
      this.dailyCount = 0;
      this.dailyResetTime = this._getNextMidnight();
    }
  }

  _getNextMidnight() {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    return tomorrow.getTime();
  }
}

module.exports = { ApplicationRateLimiter, DEFAULT_OPTIONS };
