jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { assignRequestId } = require('../../../../src/api/middleware/requestLogger');

describe('requestLogger middleware', () => {
  describe('assignRequestId', () => {
    it('assigns a UUID to req.id', () => {
      const req = {};
      const res = {};
      const next = jest.fn();

      assignRequestId(req, res, next);
      expect(req.id).toBeDefined();
      expect(typeof req.id).toBe('string');
      // UUID v4 format check
      expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('calls next', () => {
      const req = {};
      const next = jest.fn();

      assignRequestId(req, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('assigns unique IDs to different requests', () => {
      const req1 = {};
      const req2 = {};
      const next = jest.fn();

      assignRequestId(req1, {}, next);
      assignRequestId(req2, {}, next);
      expect(req1.id).not.toBe(req2.id);
    });
  });
});
