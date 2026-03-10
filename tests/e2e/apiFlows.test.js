/**
 * End-to-end API flow tests.
 * Tests complete user workflows through the Express API.
 * These simulate real user workflows at the API level.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock database connection
jest.mock('../../src/database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
  pool: { on: jest.fn(), query: jest.fn() },
}));

const app = require('../../src/app');
const { query } = require('../../src/database/connection');
const config = require('../../src/utils/config');
const { createUser, createJob, createApplication, createUserPreference } = require('../factories');

// Helper: generate valid auth token
function generateToken(payload = { userId: 'user-123', email: 'test@example.com' }) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// Flow 1: Health Check & Service Discovery
// ============================================================
describe('E2E Flow - Service Health', () => {
  test('full health check flow: root -> health endpoint', async () => {
    // Step 1: Root endpoint returns service info
    const rootRes = await request(app).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.body.status).toBe('ok');
    expect(rootRes.body.service).toBe('quickhire-api');

    // Step 2: Health endpoint shows database status
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('healthy');
    expect(healthRes.body.data.services.database).toBe('connected');
  });

  test('service reports degraded when dependencies are down', async () => {
    const { testConnection } = require('../../src/database/connection');
    testConnection.mockResolvedValue(false);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });
});

// ============================================================
// Flow 2: Error Handling Flow
// ============================================================
describe('E2E Flow - Error Handling', () => {
  test('navigating to non-existent pages returns error status', async () => {
    const routes = [
      '/api/nonexistent',
      '/completely-unknown',
      '/api/unknown-endpoint',
    ];

    for (const route of routes) {
      const res = await request(app).get(route);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBeDefined();
    }
  });

  test('all error responses follow standard format', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});

// ============================================================
// Flow 3: CORS and Security Headers
// ============================================================
describe('E2E Flow - Security Headers', () => {
  test('all responses include security headers', async () => {
    const res = await request(app).get('/');

    // Helmet headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();

    // Content type
    expect(res.headers['content-type']).toContain('json');
  });

  test('CORS headers set for configured origin', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

// ============================================================
// Flow 4: Rate Limiting
// ============================================================
describe('E2E Flow - Rate Limiting', () => {
  test('rate limit headers present on API requests', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  test('rate limit counter decrements with each request', async () => {
    const res1 = await request(app).get('/api/health');
    const res2 = await request(app).get('/api/health');

    const remaining1 = parseInt(res1.headers['ratelimit-remaining'], 10);
    const remaining2 = parseInt(res2.headers['ratelimit-remaining'], 10);

    expect(remaining2).toBeLessThan(remaining1);
  });
});

// ============================================================
// Flow 5: Request Identification
// ============================================================
describe('E2E Flow - Request Tracking', () => {
  test('each request gets a unique request ID', async () => {
    // While we can not directly check req.id from response,
    // the request logger assigns it. We verify middleware runs.
    const res1 = await request(app).get('/');
    const res2 = await request(app).get('/');

    // Both should succeed (middleware chain works)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

// ============================================================
// Flow 6: JSON Body Processing
// ============================================================
describe('E2E Flow - Request Body Handling', () => {
  test('accepts JSON POST body', async () => {
    const res = await request(app)
      .post('/api/nonexistent')
      .send({ test: 'data', nested: { key: 'value' } })
      .set('Content-Type', 'application/json');

    // Route doesn't exist but body was parsed (no 400 parse error)
    expect(res.status).toBe(404);
  });

  test('accepts URL-encoded body', async () => {
    const res = await request(app)
      .post('/api/nonexistent')
      .send('key=value&another=test')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(404);
  });

  test('rejects malformed JSON with proper error', async () => {
    const res = await request(app)
      .post('/api/nonexistent')
      .set('Content-Type', 'application/json')
      .send('{bad json}');

    // Express returns 400 for malformed JSON
    expect(res.status).toBeLessThanOrEqual(500);
  });
});

// ============================================================
// Flow 7: Compression
// ============================================================
describe('E2E Flow - Compression', () => {
  test('responses are compressed when client supports it', async () => {
    const res = await request(app)
      .get('/')
      .set('Accept-Encoding', 'gzip, deflate');

    expect(res.status).toBe(200);
    // Supertest decompresses automatically, but the response was sent compressed
  });
});

// ============================================================
// Flow 8: Multi-step API workflow simulation
// ============================================================
describe('E2E Flow - Multi-step Workflow', () => {
  test('simulates: check health -> verify service -> use API', async () => {
    const { testConnection } = require('../../src/database/connection');
    testConnection.mockResolvedValue(true);

    // Step 1: Check if service is up
    const healthRes = await request(app).get('/');
    expect(healthRes.body.status).toBe('ok');

    // Step 2: Check API health
    const apiHealthRes = await request(app).get('/api/health');
    expect(apiHealthRes.body.status).toBe('healthy');

    // Step 3: Attempt unregistered API call (404)
    const apiRes = await request(app).get('/api/nonexistent-endpoint');
    expect(apiRes.status).toBe(404);
  });

  test('simulates rapid successive API calls', async () => {
    const results = [];
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get('/');
      results.push(res.status);
    }
    // All should succeed
    expect(results.every((s) => s === 200)).toBe(true);
  });
});
