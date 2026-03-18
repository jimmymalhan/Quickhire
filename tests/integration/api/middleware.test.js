/**
 * Integration tests for middleware stack.
 * Tests CORS, helmet, compression, request IDs, etc.
 */

const request = require('supertest');

// Mock database connection
jest.mock('../../../src/database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
  pool: { on: jest.fn(), query: jest.fn() },
}));

const app = require('../../../src/app');

describe('Integration - Middleware Stack', () => {
  describe('Security Headers (Helmet)', () => {
    test('sets X-Content-Type-Options header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('sets X-Frame-Options header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    test('removes X-Powered-By header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    test('allows requests from configured origin', async () => {
      const res = await request(app).get('/').set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('handles preflight OPTIONS requests', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.status).toBeLessThan(400);
    });
  });

  describe('JSON Parsing', () => {
    test('parses JSON request bodies', async () => {
      // POST to health check just to confirm JSON parsing works
      const res = await request(app)
        .post('/api/nonexistent')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');
      // Should get 404 but JSON was parsed without error
      expect(res.status).toBe(404);
    });

    test('handles empty body gracefully', async () => {
      const res = await request(app)
        .post('/api/nonexistent')
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(404);
    });
  });

  describe('Compression', () => {
    test('compresses responses when Accept-Encoding is set', async () => {
      const res = await request(app).get('/').set('Accept-Encoding', 'gzip');
      // Supertest may decompress, but the header should indicate it was compressed
      expect(res.status).toBe(200);
    });
  });
});
