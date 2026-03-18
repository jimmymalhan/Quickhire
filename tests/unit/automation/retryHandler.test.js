jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/errorCodes', () => {
  class ScraperError extends Error {
    constructor(code, context = {}, cause = null) {
      super(`Scraper error: ${code}`);
      this.name = 'ScraperError';
      this.code = code;
      this.context = context;
      this.cause = cause;
      this.retryable = !['SCRAPE_AUTH_REQUIRED', 'SCRAPE_BLOCKED'].includes(code);
    }
  }
  return { ScraperError };
});

const RetryHandler = require('../../../src/automation/retryHandler');
const { ScraperError } = require('../../../src/utils/errorCodes');

describe('RetryHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 1, // 1ms for fast tests
      maxDelay: 10,
      jitterFactor: 0,
    });
  });

  describe('constructor', () => {
    it('uses provided options', () => {
      const h = new RetryHandler({ maxRetries: 5, baseDelay: 2000, maxDelay: 60000 });
      expect(h.maxRetries).toBe(5);
      expect(h.baseDelay).toBe(2000);
      expect(h.maxDelay).toBe(60000);
    });

    it('uses defaults when no options', () => {
      const h = new RetryHandler();
      expect(h.maxRetries).toBe(3);
      expect(h.baseDelay).toBe(1000);
      expect(h.maxDelay).toBe(30000);
      expect(h.backoffMultiplier).toBe(2);
    });
  });

  describe('execute', () => {
    it('returns result on first try success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await handler.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes attempt number to function', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      await handler.execute(fn);
      expect(fn).toHaveBeenCalledWith(0); // 0-indexed
    });

    it('retries on failure and succeeds', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

      const result = await handler.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

      await expect(handler.execute(fn)).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
    });

    it('does not retry non-retryable ScraperError', async () => {
      const fn = jest.fn().mockRejectedValue(new ScraperError('SCRAPE_AUTH_REQUIRED', {}));

      await expect(handler.execute(fn)).rejects.toThrow('Scraper error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries retryable ScraperError', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new ScraperError('SCRAPE_FAILED', {}))
        .mockResolvedValue('ok');

      const result = await handler.execute(fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws last error when all retries fail', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('error1'))
        .mockRejectedValueOnce(new Error('error2'))
        .mockRejectedValueOnce(new Error('error3'))
        .mockRejectedValue(new Error('error4'));

      await expect(handler.execute(fn)).rejects.toThrow('error4');
    });

    it('succeeds on last possible attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('finally');

      const result = await handler.execute(fn);
      expect(result).toBe('finally');
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('passes context to logging', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      await handler.execute(fn, { url: 'test.com' });
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('executeBatch', () => {
    it('executes multiple functions', async () => {
      const fns = [jest.fn().mockResolvedValue('a'), jest.fn().mockResolvedValue('b')];

      const { results, errors } = await handler.executeBatch(fns);
      expect(results).toEqual(['a', 'b']);
      expect(errors).toHaveLength(0);
    });

    it('collects errors from failed functions', async () => {
      const fns = [
        jest.fn().mockResolvedValue('a'),
        jest.fn().mockRejectedValue(new Error('fail')),
      ];

      const { results, errors } = await handler.executeBatch(fns);
      expect(results).toHaveLength(1);
      expect(errors).toHaveLength(1);
    });

    it('handles empty batch', async () => {
      const { results, errors } = await handler.executeBatch([]);
      expect(results).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('respects concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const makeFn = () =>
        jest.fn(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 5));
          concurrent--;
          return 'ok';
        });

      const fns = Array.from({ length: 10 }, makeFn);
      await handler.executeBatch(fns, { concurrency: 3 });
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('wrap', () => {
    it('wraps a function to be retryable', async () => {
      const fn = jest.fn().mockResolvedValue('wrapped result');
      const wrapped = handler.wrap(fn);

      const result = await wrapped('arg1', 'arg2');
      expect(result).toBe('wrapped result');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('retries wrapped function on failure', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

      const wrapped = handler.wrap(fn);
      const result = await wrapped();
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('_calculateDelay', () => {
    it('increases delay exponentially', () => {
      const h = new RetryHandler({
        baseDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 100000,
        jitterFactor: 0,
      });
      const delay0 = h._calculateDelay(0);
      const delay1 = h._calculateDelay(1);
      const delay2 = h._calculateDelay(2);
      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('caps at maxDelay', () => {
      const h = new RetryHandler({
        baseDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 5000,
        jitterFactor: 0,
      });
      const delay = h._calculateDelay(10);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('returns non-negative value', () => {
      const delay = handler._calculateDelay(0);
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});
