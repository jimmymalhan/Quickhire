/**
 * Unit Tests: Error Codes
 */
const { ErrorCodes, ScraperError } = require('../../src/utils/errorCodes');

describe('ErrorCodes', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCodes.SCRAPE_FAILED).toBeDefined();
    expect(ErrorCodes.SCRAPE_TIMEOUT).toBeDefined();
    expect(ErrorCodes.SCRAPE_BLOCKED).toBeDefined();
    expect(ErrorCodes.SCRAPE_RATE_LIMITED).toBeDefined();
    expect(ErrorCodes.PARSE_FAILED).toBeDefined();
    expect(ErrorCodes.PARSE_MISSING_FIELD).toBeDefined();
    expect(ErrorCodes.DB_INSERT_ERROR).toBeDefined();
    expect(ErrorCodes.DB_DUPLICATE).toBeDefined();
    expect(ErrorCodes.UNKNOWN_ERROR).toBeDefined();
  });

  it('should have code, message, and retryable for each error', () => {
    for (const [key, value] of Object.entries(ErrorCodes)) {
      expect(value.code).toBe(key);
      expect(typeof value.message).toBe('string');
      expect(typeof value.retryable).toBe('boolean');
    }
  });

  it('should mark scrape errors as retryable', () => {
    expect(ErrorCodes.SCRAPE_FAILED.retryable).toBe(true);
    expect(ErrorCodes.SCRAPE_TIMEOUT.retryable).toBe(true);
    expect(ErrorCodes.SCRAPE_RATE_LIMITED.retryable).toBe(true);
  });

  it('should mark parse errors as non-retryable', () => {
    expect(ErrorCodes.PARSE_FAILED.retryable).toBe(false);
    expect(ErrorCodes.PARSE_MISSING_FIELD.retryable).toBe(false);
  });
});

describe('ScraperError', () => {
  it('should create error with correct properties', () => {
    const err = new ScraperError('SCRAPE_FAILED', { url: 'test.com' });
    expect(err.name).toBe('ScraperError');
    expect(err.code).toBe('SCRAPE_FAILED');
    expect(err.message).toBe('Failed to scrape job listing');
    expect(err.retryable).toBe(true);
    expect(err.details).toEqual({ url: 'test.com' });
    expect(err.timestamp).toBeDefined();
  });

  it('should be an instance of Error', () => {
    const err = new ScraperError('PARSE_FAILED');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof ScraperError).toBe(true);
  });

  it('should default to UNKNOWN_ERROR for invalid code', () => {
    const err = new ScraperError('INVALID_CODE');
    expect(err.code).toBe('UNKNOWN_ERROR');
  });

  it('should include cause', () => {
    const cause = new Error('original error');
    const err = new ScraperError('SCRAPE_FAILED', null, cause);
    expect(err.cause).toBe(cause);
  });

  it('should serialize to JSON', () => {
    const err = new ScraperError('SCRAPE_FAILED', { url: 'test.com' });
    const json = err.toJSON();
    expect(json.name).toBe('ScraperError');
    expect(json.code).toBe('SCRAPE_FAILED');
    expect(json.retryable).toBe(true);
    expect(json.details).toEqual({ url: 'test.com' });
    expect(json.timestamp).toBeDefined();
  });
});
