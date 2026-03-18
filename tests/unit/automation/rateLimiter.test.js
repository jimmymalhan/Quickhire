jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { RateLimiter, DEFAULT_OPTIONS } = require('../../../src/automation/rateLimiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxPerHourPerCompany: 3,
      maxPerHourGlobal: 10,
      maxPerDayGlobal: 50,
      minIntervalMs: 100,
      cooldownMs: 500,
    });
  });

  describe('constructor', () => {
    it('uses provided options', () => {
      expect(limiter.options.maxPerHourPerCompany).toBe(3);
      expect(limiter.options.maxPerHourGlobal).toBe(10);
    });

    it('uses defaults when no options provided', () => {
      const defaultLimiter = new RateLimiter();
      expect(defaultLimiter.options.maxPerHourPerCompany).toBe(
        DEFAULT_OPTIONS.maxPerHourPerCompany,
      );
      expect(defaultLimiter.options.maxPerHourGlobal).toBe(DEFAULT_OPTIONS.maxPerHourGlobal);
    });

    it('starts with empty state', () => {
      expect(limiter.companyBuckets.size).toBe(0);
      expect(limiter.globalBucket).toHaveLength(0);
      expect(limiter.dailyCount).toBe(0);
    });
  });

  describe('canSubmit', () => {
    it('allows first submission', () => {
      const result = limiter.canSubmit('TechCorp');
      expect(result.allowed).toBe(true);
    });

    it('blocks when min interval not met', () => {
      limiter.recordSubmission('TechCorp');
      const result = limiter.canSubmit('TechCorp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('min_interval');
    });

    it('blocks when company hourly limit reached', () => {
      // Bypass min interval by setting lastSubmissionTime far in the past
      for (let i = 0; i < 3; i++) {
        limiter.globalBucket.push(Date.now() - 1000);
        const companyKey = 'techcorp';
        if (!limiter.companyBuckets.has(companyKey)) {
          limiter.companyBuckets.set(companyKey, []);
        }
        limiter.companyBuckets.get(companyKey).push(Date.now() - 1000);
        limiter.dailyCount++;
      }
      limiter.lastSubmissionTime = Date.now() - 200; // past min interval

      const result = limiter.canSubmit('TechCorp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('company_hourly_limit');
    });

    it('blocks when global hourly limit reached', () => {
      for (let i = 0; i < 10; i++) {
        limiter.globalBucket.push(Date.now() - 1000);
        limiter.dailyCount++;
      }
      limiter.lastSubmissionTime = Date.now() - 200;

      const result = limiter.canSubmit('NewCompany');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('global_hourly_limit');
    });

    it('blocks when daily limit reached', () => {
      limiter.dailyCount = 50;
      limiter.lastSubmissionTime = Date.now() - 200;

      const result = limiter.canSubmit('TechCorp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit_reached');
    });

    it('blocks during cooldown', () => {
      limiter.activateCooldown(1000);
      const result = limiter.canSubmit('TechCorp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown_active');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('allows after cooldown expires', () => {
      limiter.cooldownUntil = Date.now() - 1; // expired
      const result = limiter.canSubmit('TechCorp');
      expect(result.allowed).toBe(true);
    });

    it('allows different company when one is limited', () => {
      const companyKey = 'techcorp';
      limiter.companyBuckets.set(companyKey, [
        Date.now() - 1000,
        Date.now() - 1000,
        Date.now() - 1000,
      ]);
      limiter.dailyCount = 3;
      limiter.globalBucket = [Date.now() - 1000, Date.now() - 1000, Date.now() - 1000];
      limiter.lastSubmissionTime = Date.now() - 200;

      const result = limiter.canSubmit('OtherCo');
      expect(result.allowed).toBe(true);
    });

    it('works without company parameter', () => {
      const result = limiter.canSubmit(null);
      expect(result.allowed).toBe(true);
    });

    it('returns retryAfterMs for min_interval', () => {
      limiter.recordSubmission('TechCorp');
      const result = limiter.canSubmit('TechCorp');
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(100);
    });
  });

  describe('recordSubmission', () => {
    it('increments daily count', () => {
      limiter.recordSubmission('TechCorp');
      expect(limiter.dailyCount).toBe(1);
    });

    it('adds to global bucket', () => {
      limiter.recordSubmission('TechCorp');
      expect(limiter.globalBucket).toHaveLength(1);
    });

    it('adds to company bucket', () => {
      limiter.recordSubmission('TechCorp');
      expect(limiter.companyBuckets.get('techcorp')).toHaveLength(1);
    });

    it('updates lastSubmissionTime', () => {
      const before = Date.now();
      limiter.recordSubmission('TechCorp');
      expect(limiter.lastSubmissionTime).toBeGreaterThanOrEqual(before);
    });

    it('handles null company', () => {
      limiter.recordSubmission(null);
      expect(limiter.dailyCount).toBe(1);
      expect(limiter.companyBuckets.size).toBe(0);
    });

    it('normalizes company name to lowercase', () => {
      limiter.recordSubmission('TechCorp');
      limiter.lastSubmissionTime = 0; // reset interval
      limiter.recordSubmission('TECHCORP');
      expect(limiter.companyBuckets.get('techcorp')).toHaveLength(2);
    });
  });

  describe('activateCooldown', () => {
    it('sets cooldown with default duration', () => {
      limiter.activateCooldown();
      expect(limiter.cooldownUntil).toBeGreaterThan(Date.now());
    });

    it('sets cooldown with custom duration', () => {
      const before = Date.now();
      limiter.activateCooldown(2000);
      expect(limiter.cooldownUntil).toBeGreaterThanOrEqual(before + 2000);
    });
  });

  describe('getStatus', () => {
    it('returns comprehensive status', () => {
      limiter.recordSubmission('TechCorp');
      const status = limiter.getStatus();

      expect(status.dailyCount).toBe(1);
      expect(status.dailyRemaining).toBe(49);
      expect(status.globalHourlyCount).toBe(1);
      expect(status.globalHourlyRemaining).toBe(9);
      expect(status.inCooldown).toBe(false);
      expect(status.companyStats).toHaveProperty('techcorp');
      expect(status.lastSubmissionTime).toBeInstanceOf(Date);
    });

    it('returns null lastSubmissionTime when no submissions', () => {
      const status = limiter.getStatus();
      expect(status.lastSubmissionTime).toBeNull();
    });

    it('shows company hourly stats', () => {
      limiter.recordSubmission('TechCorp');
      const status = limiter.getStatus();
      expect(status.companyStats.techcorp.hourlyCount).toBe(1);
      expect(status.companyStats.techcorp.hourlyRemaining).toBe(2);
    });
  });

  describe('getWaitTime', () => {
    it('returns 0 when can submit', () => {
      expect(limiter.getWaitTime('TechCorp')).toBe(0);
    });

    it('returns positive wait time when blocked', () => {
      limiter.recordSubmission('TechCorp');
      expect(limiter.getWaitTime('TechCorp')).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      limiter.recordSubmission('TechCorp');
      limiter.activateCooldown();
      limiter.reset();

      expect(limiter.companyBuckets.size).toBe(0);
      expect(limiter.globalBucket).toHaveLength(0);
      expect(limiter.dailyCount).toBe(0);
      expect(limiter.lastSubmissionTime).toBe(0);
      expect(limiter.cooldownUntil).toBe(0);
    });
  });

  describe('DEFAULT_OPTIONS', () => {
    it('exports default options', () => {
      expect(DEFAULT_OPTIONS).toBeDefined();
      expect(DEFAULT_OPTIONS.maxPerHourPerCompany).toBe(8);
      expect(DEFAULT_OPTIONS.maxPerHourGlobal).toBe(25);
      expect(DEFAULT_OPTIONS.maxPerDayGlobal).toBe(200);
      expect(DEFAULT_OPTIONS.minIntervalMs).toBe(30000);
      expect(DEFAULT_OPTIONS.cooldownMs).toBe(300000);
    });
  });
});
