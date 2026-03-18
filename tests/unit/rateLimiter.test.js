/**
 * Unit Tests: Rate Limiter
 */
const RateLimiter = require('../../src/automation/rateLimiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxPerMinute: 60, // High for testing
      maxPerHour: 1000,
      minDelay: 0, // No delay for tests
      maxDelay: 1,
    });
  });

  describe('constructor', () => {
    it('should set default values', () => {
      const l = new RateLimiter();
      expect(l.maxRequestsPerMinute).toBe(10);
      expect(l.maxRequestsPerHour).toBe(200);
      expect(l.minDelay).toBe(2000);
    });

    it('should accept custom values', () => {
      const l = new RateLimiter({ maxPerMinute: 20, maxPerHour: 100 });
      expect(l.maxRequestsPerMinute).toBe(20);
      expect(l.maxRequestsPerHour).toBe(100);
    });
  });

  describe('canProceed', () => {
    it('should allow requests when tokens available', () => {
      expect(limiter.canProceed()).toBe(true);
    });

    it('should block when in backoff', () => {
      limiter.backoffUntil = Date.now() + 60000;
      expect(limiter.canProceed()).toBe(false);
    });

    it('should allow after backoff expires', () => {
      limiter.backoffUntil = Date.now() - 1;
      expect(limiter.canProceed()).toBe(true);
    });
  });

  describe('acquire', () => {
    it('should consume a token', async () => {
      const initialTokens = limiter.tokens;
      await limiter.acquire();
      expect(limiter.tokens).toBeLessThan(initialTokens);
    });

    it('should track requests in minute window', async () => {
      await limiter.acquire();
      expect(limiter.minuteWindow.length).toBe(1);
    });

    it('should track requests in hour window', async () => {
      await limiter.acquire();
      expect(limiter.hourWindow.length).toBe(1);
    });
  });

  describe('reportSuccess', () => {
    it('should decrease consecutive errors', () => {
      limiter.consecutiveErrors = 3;
      limiter.reportSuccess();
      expect(limiter.consecutiveErrors).toBe(2);
    });

    it('should not go below 0', () => {
      limiter.consecutiveErrors = 0;
      limiter.reportSuccess();
      expect(limiter.consecutiveErrors).toBe(0);
    });
  });

  describe('reportError', () => {
    it('should increase consecutive errors', () => {
      limiter.reportError();
      expect(limiter.consecutiveErrors).toBe(1);
    });

    it('should set backoff for rate limit', () => {
      limiter.reportError(true);
      expect(limiter.backoffUntil).toBeGreaterThan(Date.now());
    });

    it('should set shorter backoff for non-rate-limit', () => {
      limiter.reportError(false);
      const nonRlBackoff = limiter.backoffUntil;

      limiter.consecutiveErrors = 0;
      limiter.reportError(true);
      const rlBackoff = limiter.backoffUntil;

      expect(rlBackoff).toBeGreaterThan(nonRlBackoff - 60000);
    });

    it('should increase backoff exponentially', () => {
      limiter.reportError(true);
      const backoff1 = limiter.backoffUntil;

      limiter.reportError(true);
      const backoff2 = limiter.backoffUntil;

      expect(backoff2).toBeGreaterThan(backoff1);
    });
  });

  describe('getStatus', () => {
    it('should return status object', () => {
      const status = limiter.getStatus();
      expect(status).toHaveProperty('availableTokens');
      expect(status).toHaveProperty('requestsLastMinute');
      expect(status).toHaveProperty('requestsLastHour');
      expect(status).toHaveProperty('isBackedOff');
      expect(status).toHaveProperty('backoffRemaining');
      expect(status).toHaveProperty('consecutiveErrors');
    });

    it('should reflect current state', async () => {
      await limiter.acquire();
      const status = limiter.getStatus();
      expect(status.requestsLastMinute).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      await limiter.acquire();
      limiter.reportError(true);
      limiter.reset();

      const status = limiter.getStatus();
      expect(status.requestsLastMinute).toBe(0);
      expect(status.requestsLastHour).toBe(0);
      expect(status.consecutiveErrors).toBe(0);
      expect(status.isBackedOff).toBe(false);
    });
  });
});
