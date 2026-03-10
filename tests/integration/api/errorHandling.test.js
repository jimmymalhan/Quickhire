/**
 * Integration tests for error handling middleware.
 * Tests 404 handling and error response format.
 */

const request = require('supertest');

// Mock database connection
jest.mock('../../../src/database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  testConnection: jest.fn(),
  pool: { on: jest.fn(), query: jest.fn() },
}));

const app = require('../../../src/app');

describe('Integration - Error Handling', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 404 for unknown root routes', async () => {
    const res = await request(app).get('/completely-unknown');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 404 for POST to unknown routes', async () => {
    const res = await request(app).post('/api/nonexistent').send({ data: 'test' });
    expect(res.status).toBe(404);
  });

  test('returns 404 for PUT to unknown routes', async () => {
    const res = await request(app).put('/api/nonexistent').send({ data: 'test' });
    expect(res.status).toBe(404);
  });

  test('returns 404 for DELETE to unknown routes', async () => {
    const res = await request(app).delete('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  test('response format includes error object', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});
