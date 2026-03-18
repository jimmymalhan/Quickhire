jest.mock('../../../../src/database/connection', () => ({
  testConnection: jest.fn(),
}));

const { healthCheck } = require('../../../../src/api/controllers/healthController');
const { testConnection } = require('../../../../src/database/connection');

describe('healthController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('healthCheck', () => {
    it('returns healthy status when database is connected', async () => {
      testConnection.mockResolvedValue(true);

      await healthCheck(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          code: 200,
          data: expect.objectContaining({
            services: { database: 'connected' },
          }),
        }),
      );
    });

    it('returns degraded status when database is disconnected', async () => {
      testConnection.mockResolvedValue(false);

      await healthCheck(req, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          code: 503,
          data: expect.objectContaining({
            services: { database: 'disconnected' },
          }),
        }),
      );
    });

    it('includes uptime in response', async () => {
      testConnection.mockResolvedValue(true);

      await healthCheck(req, res);
      const response = res.json.mock.calls[0][0];
      expect(response.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes timestamp in response', async () => {
      testConnection.mockResolvedValue(true);

      await healthCheck(req, res);
      const response = res.json.mock.calls[0][0];
      expect(response.data.timestamp).toBeTruthy();
    });
  });
});
