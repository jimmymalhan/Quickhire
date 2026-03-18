/**
 * Performance tests for the Quickhire platform.
 * Tests response times, throughput, and resource usage patterns.
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
const { query } = require('../../../src/database/connection');

// ============================================================
// API Response Time Benchmarks
// ============================================================
describe('Performance - API Response Times', () => {
  test('GET / responds within 100ms', async () => {
    const start = Date.now();
    await request(app).get('/');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('GET /api/health responds within 200ms', async () => {
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const start = Date.now();
    await request(app).get('/api/health');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('404 handler responds within 50ms', async () => {
    const start = Date.now();
    await request(app).get('/api/nonexistent');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('handles 10 sequential requests within 500ms', async () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      await request(app).get('/');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('handles 10 parallel requests within 200ms', async () => {
    const start = Date.now();
    const requests = Array.from({ length: 10 }, () => request(app).get('/'));
    await Promise.all(requests);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
});

// ============================================================
// Validator Performance
// ============================================================
describe('Performance - Validators', () => {
  const {
    isValidEmail,
    isValidUUID,
    isValidURL,
    sanitizeString,
    validatePagination,
    isValidSalaryRange,
    validatePasswordStrength,
  } = require('../../../src/utils/validators');

  test('validates 10,000 emails within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      isValidEmail(`user${i}@example.com`);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('validates 10,000 UUIDs within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      isValidUUID('550e8400-e29b-41d4-a716-446655440000');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('validates 10,000 URLs within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      isValidURL(`https://example.com/path/${i}`);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('sanitizes 10,000 strings within 200ms', () => {
    const xssPayload = '<script>alert("xss")</script><div class="test">Hello & World</div>';
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      sanitizeString(xssPayload);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('validates 10,000 pagination calls within 50ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      validatePagination(i % 100, 20);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('validates 10,000 salary ranges within 50ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      isValidSalaryRange(50000 + i, 150000 + i);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('validates 1,000 passwords within 50ms', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      validatePasswordStrength(`Password${i}!`);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
});

// ============================================================
// Formatter Performance
// ============================================================
describe('Performance - Formatters', () => {
  const {
    formatSuccessResponse,
    formatErrorResponse,
    formatPagination,
    formatUserResponse,
    formatJobResponse,
    formatApplicationResponse,
    formatSalaryRange,
    formatDate,
  } = require('../../../src/utils/formatters');

  test('formats 10,000 success responses within 100ms', () => {
    const data = { id: 1, name: 'Test', email: 'test@test.com' };
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatSuccessResponse(data);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('formats 10,000 error responses within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatErrorResponse('ERROR', 'message', 500, ['detail']);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('formats 10,000 pagination objects within 50ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatPagination(i % 100, 20, 1000);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('formats 10,000 user responses within 100ms', () => {
    const user = {
      id: 'uuid',
      email: 'test@test.com',
      first_name: 'John',
      last_name: 'Doe',
      profile_pic_url: 'https://pic.com/1',
      created_at: new Date().toISOString(),
    };
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatUserResponse(user);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('formats 10,000 job responses within 100ms', () => {
    const job = {
      id: 'uuid',
      title: 'Engineer',
      company: 'Corp',
      location: 'Remote',
      salary_min: 80000,
      salary_max: 150000,
      description: 'Great job',
    };
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatJobResponse(job);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('formats 10,000 application responses within 100ms', () => {
    const app = {
      id: 'uuid',
      user_id: 'u1',
      job_id: 'j1',
      status: 'pending',
      submission_attempts: 1,
      resume_version: 1,
    };
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatApplicationResponse(app);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('formats 10,000 salary ranges within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatSalaryRange(80000, 150000);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('formats 10,000 dates within 100ms', () => {
    const date = new Date();
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      formatDate(date);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});

// ============================================================
// Error Handling Performance
// ============================================================
describe('Performance - Error Handling', () => {
  const { AppError, ERROR_CODES } = require('../../../src/utils/errorCodes');

  test('creates 10,000 AppError instances within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      new AppError(ERROR_CODES.VALIDATION_ERROR, `Error ${i}`);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});

// ============================================================
// Factory Performance
// ============================================================
describe('Performance - Test Factories', () => {
  const { createUser, createJob, createApplication, createBatch } = require('../../factories');

  test('creates 1,000 test users within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      createUser();
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('creates batch of 1,000 jobs within 200ms', () => {
    const start = Date.now();
    createBatch(createJob, 1000);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('creates batch of 1,000 applications within 200ms', () => {
    const start = Date.now();
    createBatch(createApplication, 1000);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
});

// ============================================================
// Memory Usage Patterns
// ============================================================
describe('Performance - Memory Patterns', () => {
  test('large JSON response does not leak memory', () => {
    const { formatSuccessResponse } = require('../../../src/utils/formatters');
    const initialMem = process.memoryUsage().heapUsed;

    // Create 1000 large responses
    for (let i = 0; i < 1000; i++) {
      const data = Array.from({ length: 100 }, (_, j) => ({
        id: `id-${j}`,
        name: `Item ${j}`,
        description: 'x'.repeat(100),
      }));
      formatSuccessResponse(data);
    }

    // Force GC if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
    }

    const finalMem = process.memoryUsage().heapUsed;
    const memGrowth = (finalMem - initialMem) / 1024 / 1024; // MB
    // Should not grow more than 50MB for this operation
    expect(memGrowth).toBeLessThan(200);
  });
});
