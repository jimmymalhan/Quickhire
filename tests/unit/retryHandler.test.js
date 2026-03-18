/**
 * Unit Tests: Retry Handler
 */
const RetryHandler = require('../../src/automation/retryHandler');
const { ScraperError } = require('../../src/utils/errorCodes');

describe('RetryHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 10, // Very short for tests
      maxDelay: 50,
      jitterFactor: 0,
    });
  });

  describe('execute', () => {
    it('should return result on success', async () => {
      const result = await handler.execute(() => 'success');
      expect(result).toBe('success');
    });

    it('should retry on failure and succeed', async () => {
      let attempts = 0;
      const result = await handler.execute(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return 'ok';
      });
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      await expect(
        handler.execute(() => {
          throw new Error('always fails');
        }),
      ).rejects.toThrow('always fails');
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      await expect(
        handler.execute(() => {
          attempts++;
          throw new ScraperError('PARSE_FAILED');
        }),
      ).rejects.toThrow(ScraperError);
      expect(attempts).toBe(1);
    });

    it('should retry retryable ScraperErrors', async () => {
      let attempts = 0;
      await expect(
        handler.execute(() => {
          attempts++;
          throw new ScraperError('SCRAPE_FAILED');
        }),
      ).rejects.toThrow(ScraperError);
      expect(attempts).toBe(4); // 1 initial + 3 retries
    });

    it('should pass attempt number to function', async () => {
      const attempts = [];
      try {
        await handler.execute((attempt) => {
          attempts.push(attempt);
          throw new Error('fail');
        });
      } catch (e) {
        /* expected */
      }
      expect(attempts).toEqual([0, 1, 2, 3]);
    });

    it('should handle async functions', async () => {
      const result = await handler.execute(async () => {
        return Promise.resolve('async result');
      });
      expect(result).toBe('async result');
    });
  });

  describe('executeBatch', () => {
    it('should execute all functions', async () => {
      const fns = [
        () => Promise.resolve('a'),
        () => Promise.resolve('b'),
        () => Promise.resolve('c'),
      ];
      const { results, errors } = await handler.executeBatch(fns);
      expect(results).toEqual(['a', 'b', 'c']);
      expect(errors.length).toBe(0);
    });

    it('should collect errors for failed functions', async () => {
      const fns = [
        () => 'ok',
        () => {
          throw new ScraperError('PARSE_FAILED');
        },
      ];
      const { results, errors } = await handler.executeBatch(fns);
      expect(results.length).toBe(1);
      expect(errors.length).toBe(1);
    });

    it('should respect concurrency', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const fns = Array(10)
        .fill(null)
        .map(() => async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 10));
          concurrent--;
          return 'done';
        });
      await handler.executeBatch(fns, { concurrency: 3 });
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('wrap', () => {
    it('should create a retryable wrapper', async () => {
      let calls = 0;
      const fn = () => {
        calls++;
        if (calls < 2) {
          throw new Error('fail');
        }
        return 'wrapped result';
      };
      const wrapped = handler.wrap(fn);
      const result = await wrapped();
      expect(result).toBe('wrapped result');
    });
  });

  describe('_calculateDelay', () => {
    it('should increase delay with attempts', () => {
      const d0 = handler._calculateDelay(0);
      const d1 = handler._calculateDelay(1);
      const d2 = handler._calculateDelay(2);
      expect(d1).toBeGreaterThanOrEqual(d0);
      expect(d2).toBeGreaterThanOrEqual(d1);
    });

    it('should cap at maxDelay', () => {
      const delay = handler._calculateDelay(100);
      expect(delay).toBeLessThanOrEqual(handler.maxDelay + 10); // +10 for rounding
    });
  });
});
