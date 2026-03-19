/**
 * Integration tests for health check endpoints.
 * Tests the full request/response cycle through Express.
 */

const request = require('supertest');

// Mock database connection before loading app
jest.mock('../../../src/database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  testConnection: jest.fn(),
  pool: { on: jest.fn(), query: jest.fn() },
}));

const app = require('../../../src/app');
const { testConnection } = require('../../../src/database/connection');

describe('Integration - Health Check', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET / returns service info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('quickhire-api');
    expect(res.body.version).toBeDefined();
  });

  test('GET /api/health returns healthy when DB is connected', async () => {
    testConnection.mockResolvedValue(true);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.data.services.database).toBe('connected');
    expect(res.body.data.uptime).toBeDefined();
    expect(res.body.data.timestamp).toBeDefined();
  });

  test('GET /api/health returns degraded when DB is disconnected', async () => {
    testConnection.mockResolvedValue(false);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.data.services.database).toBe('disconnected');
  });

  test('GET /api/health handles DB check errors gracefully', async () => {
    testConnection.mockRejectedValue(new Error('db exploded'));

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.data.services.database).toBe('disconnected');
  });
});
