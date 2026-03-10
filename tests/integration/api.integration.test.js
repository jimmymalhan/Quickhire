const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

// Mock all database and external dependencies
jest.mock('../../src/database/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  getClient: jest.fn(),
  pool: { query: jest.fn() },
}));

jest.mock('../../src/database/models/Job', () => ({
  findById: jest.fn(),
  search: jest.fn(),
  bulkCreate: jest.fn(),
}));

jest.mock('../../src/database/models/Application', () => ({
  findById: jest.fn(),
  findByUserId: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  countTodayByUser: jest.fn(),
}));

jest.mock('../../src/database/models/ApplicationLog', () => ({
  findByApplicationId: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/database/models/UserPreference', () => ({
  findByUserId: jest.fn(),
  createOrUpdate: jest.fn(),
}));

jest.mock('../../src/automation/applicationSubmitter', () => ({
  submitApplication: jest.fn(),
}));

jest.mock('../../src/automation/jobMatcher', () => ({
  calculateMatchScore: jest.fn(),
  matchJobsForUser: jest.fn().mockReturnValue([]),
}));

jest.mock('../../src/scheduler/schedulerInit', () => ({
  triggerScrape: jest.fn().mockResolvedValue({ jobId: 'test-job-id' }),
  triggerApplicationProcessing: jest.fn(),
  getQueueStats: jest.fn(),
  initScheduler: jest.fn(),
}));

jest.mock('../../src/utils/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  has: jest.fn().mockResolvedValue(false),
  del: jest.fn().mockResolvedValue(true),
}));

const Job = require('../../src/database/models/Job');
const Application = require('../../src/database/models/Application');
const UserPreference = require('../../src/database/models/UserPreference');
const { submitApplication } = require('../../src/automation/applicationSubmitter');
const { matchJobsForUser } = require('../../src/automation/jobMatcher');
const { triggerScrape } = require('../../src/scheduler/schedulerInit');
const { query } = require('../../src/database/connection');

const generateToken = (userId = 'test-user-1') => {
  return jwt.sign({ id: userId, email: 'test@example.com' }, 'test-jwt-secret-for-testing-only', { expiresIn: '1h' });
};

describe('API Integration Tests', () => {
  let authToken;

  beforeAll(() => {
    authToken = generateToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== JOBS API ====================

  describe('GET /api/jobs/search', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/jobs/search');
      expect(res.status).toBe(401);
    });

    it('should return search results', async () => {
      Job.search.mockResolvedValue({ jobs: [{ id: '1', title: 'Engineer' }], total: 1, page: 1, limit: 20 });

      const res = await request(app)
        .get('/api/jobs/search?role=Engineer')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should support pagination', async () => {
      Job.search.mockResolvedValue({ jobs: [], total: 50, page: 3, limit: 10 });

      const res = await request(app)
        .get('/api/jobs/search?page=3&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(3);
    });

    it('should support filtering by location', async () => {
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 20 });

      const res = await request(app)
        .get('/api/jobs/search?location=Remote')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Job.search).toHaveBeenCalledWith(expect.objectContaining({ location: 'Remote' }));
    });
  });

  describe('GET /api/jobs/scrape', () => {
    it('should trigger a scrape job', async () => {
      const res = await request(app)
        .get('/api/jobs/scrape?role=Engineer')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBe('test-job-id');
      expect(triggerScrape).toHaveBeenCalled();
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/jobs/scrape');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/jobs/recommendations', () => {
    it('should return recommendations', async () => {
      UserPreference.findByUserId.mockResolvedValue({ target_roles: ['Engineer'] });
      Job.search.mockResolvedValue({ jobs: [{ id: '1', title: 'Engineer' }], total: 1, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue([
        { job: { id: '1', title: 'Engineer' }, match: { score: 85, reason: 'Good match' } },
      ]);

      const res = await request(app)
        .get('/api/jobs/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].matchScore).toBe(85);
    });

    it('should return error when no preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/jobs/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return a job by id', async () => {
      Job.findById.mockResolvedValue({ id: '1', title: 'Engineer', company: 'TechCo' });

      const res = await request(app)
        .get('/api/jobs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Engineer');
    });

    it('should return 404 for missing job', async () => {
      Job.findById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/jobs/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================== APPLICATIONS API ====================

  describe('GET /api/applications', () => {
    it('should return applications list', async () => {
      Application.findByUserId.mockResolvedValue({
        applications: [{ id: '1', status: 'submitted' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      Application.findByUserId.mockResolvedValue({
        applications: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/applications?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/applications');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/applications/stats', () => {
    it('should return application statistics', async () => {
      query.mockResolvedValueOnce({ rows: [{ status: 'submitted', count: '5' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
      query.mockResolvedValueOnce({
        rows: [{ scrape_count: '2', total_jobs_scraped: '50', total_matched: '15' }],
      });
      UserPreference.findByUserId.mockResolvedValue({ daily_limit: 50 });

      const res = await request(app)
        .get('/api/applications/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applications).toBeDefined();
      expect(res.body.data.scraping).toBeDefined();
      expect(res.body.data.limits).toBeDefined();
    });
  });

  describe('GET /api/applications/:id', () => {
    it('should return application details', async () => {
      Application.findById.mockResolvedValue({ id: '1', user_id: 'test-user-1', status: 'submitted' });

      const res = await request(app)
        .get('/api/applications/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('1');
    });

    it('should return 404 for other users application', async () => {
      Application.findById.mockResolvedValue({ id: '1', user_id: 'other-user' });

      const res = await request(app)
        .get('/api/applications/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/applications/jobs/:id/apply', () => {
    it('should submit an application', async () => {
      submitApplication.mockResolvedValue({ id: 'app-1', status: 'submitted' });

      const res = await request(app)
        .post('/api/applications/jobs/job-1/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ resumeVersion: 1 });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('submitted');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/applications/jobs/job-1/apply')
        .send({ resumeVersion: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/applications/auto-apply', () => {
    it('should auto-apply to matched jobs', async () => {
      const prefs = { auto_apply_enabled: true, daily_limit: 50, target_roles: ['Engineer'] };
      UserPreference.findByUserId.mockResolvedValue(prefs);
      Application.countTodayByUser.mockResolvedValue(0);
      Job.search.mockResolvedValue({
        jobs: [{ id: 'j1', title: 'Engineer', company: 'Co' }],
        total: 1,
        page: 1,
        limit: 200,
      });
      matchJobsForUser.mockReturnValue([
        { job: { id: 'j1', title: 'Engineer', company: 'Co' }, match: { score: 85 } },
      ]);
      query.mockResolvedValue({ rows: [] });
      submitApplication.mockResolvedValue({ id: 'app-1' });

      const res = await request(app)
        .post('/api/applications/auto-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ min_score: 70 });

      expect(res.status).toBe(201);
      expect(res.body.data.submitted).toBe(1);
    });

    it('should reject when auto-apply disabled', async () => {
      UserPreference.findByUserId.mockResolvedValue({ auto_apply_enabled: false });

      const res = await request(app)
        .post('/api/applications/auto-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should reject when no preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/applications/auto-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/applications/:id/status', () => {
    it('should update application status', async () => {
      Application.findById.mockResolvedValue({ id: '1', user_id: 'test-user-1', status: 'pending' });
      Application.updateStatus.mockResolvedValue({ id: '1', status: 'archived' });

      const res = await request(app)
        .patch('/api/applications/1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'archived' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('archived');
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .patch('/api/applications/1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== GENERAL API ====================

  describe('Health Check', () => {
    it('GET / should return ok', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
