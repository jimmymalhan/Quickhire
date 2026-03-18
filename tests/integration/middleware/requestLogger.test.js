/**
 * Integration tests for request logger middleware.
 * Tests request ID assignment.
 */

const { assignRequestId } = require('../../../src/api/middleware/requestLogger');

describe('Integration - Request Logger Middleware', () => {
  test('assigns a UUID request ID to req.id', () => {
    const req = {};
    const res = {};
    const next = jest.fn();

    assignRequestId(req, res, next);

    expect(req.id).toBeDefined();
    expect(typeof req.id).toBe('string');
    // UUID v4 format
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(next).toHaveBeenCalled();
  });

  test('assigns unique IDs to different requests', () => {
    const req1 = {};
    const req2 = {};
    const next = jest.fn();

    assignRequestId(req1, {}, next);
    assignRequestId(req2, {}, next);

    expect(req1.id).not.toBe(req2.id);
  });

  test('calls next() exactly once', () => {
    const req = {};
    const next = jest.fn();

    assignRequestId(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
