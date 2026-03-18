/**
 * Integration tests for Saved Jobs API
 * Tests full CRUD flow, filtering, pagination, stats, duplicate prevention,
 * auth enforcement, and bulk apply through the Express request/response cycle.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock all database and external dependencies
jest.mock('../../src/database/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  getClient: jest.fn(),
  pool: { query: jest.fn() },
}));

jest.mock('../../src/database/models/SavedJob', () => ({
  findById: jest.fn(),
  findByUser: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  removeById: jest.fn(),
  getStats: jest.fn(),
  findSavedForBulkApply: jest.fn(),
  markApplied: jest.fn(),
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

jest.mock('../../src/database/models/UserPreference', () => ({
  findByUserId: jest.fn(),
  createOrUpdate: jest.fn(),
}));

jest.mock('../../src/automation/applicationSubmitter', () => ({
  submitApplication: jest.fn(),
}));

jest.mock('../../src/utils/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  has: jest.fn().mockResolvedValue(false),
  del: jest.fn().mockResolvedValue(true),
}));

const app = require('../../src/app');
const SavedJob = require('../../src/database/models/SavedJob');
const Job = require('../../src/database/models/Job');
const Application = require('../../src/database/models/Application');
const UserPreference = require('../../src/database/models/UserPreference');
const { submitApplication } = require('../../src/automation/applicationSubmitter');

const generateToken = (userId = 'test-user-1') => {
  return jwt.sign(
    { id: userId, email: 'test@example.com' },
    'test-jwt-secret-for-testing-only',
    { expiresIn: '1h' },
  );
};

describe('Saved Jobs Integration Tests', () => {
  let authToken;

  beforeAll(() => {
    authToken = generateToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== AUTH ENFORCEMENT ====================

  describe('Auth enforcement on all endpoints', () => {
    it('GET /api/saved-jobs returns 401 without auth', async () => {
      const res = await request(app).get('/api/saved-jobs');
      expect(res.status).toBe(401);
    });

    it('GET /api/saved-jobs/stats returns 401 without auth', async () => {
      const res = await request(app).get('/api/saved-jobs/stats');
      expect(res.status).toBe(401);
    });

    it('POST /api/saved-jobs returns 401 without auth', async () => {
      const res = await request(app).post('/api/saved-jobs').send({ jobId: 'j1' });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/saved-jobs/:id returns 401 without auth', async () => {
      const res = await request(app).patch('/api/saved-jobs/sj-1').send({ notes: 'test' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/saved-jobs/:id returns 401 without auth', async () => {
      const res = await request(app).delete('/api/saved-jobs/sj-1');
      expect(res.status).toBe(401);
    });

    it('POST /api/saved-jobs/bulk-apply returns 401 without auth', async () => {
      const res = await request(app).post('/api/saved-jobs/bulk-apply').send({});
      expect(res.status).toBe(401);
    });

    it('rejects expired tokens', async () => {
      const expiredToken = jwt.sign(
        { id: 'test-user-1', email: 'test@example.com' },
        'test-jwt-secret-for-testing-only',
        { expiresIn: '0s' },
      );
      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects invalid tokens', async () => {
      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', 'Bearer invalid-token-value');
      expect(res.status).toBe(401);
    });
  });

  // ==================== SAVE JOB ====================

  describe('POST /api/saved-jobs (save a job)', () => {
    it('should save a job successfully', async () => {
      Job.findById.mockResolvedValue({ id: 'job-1', title: 'Engineer', company: 'TechCo' });
      SavedJob.save.mockResolvedValue({
        id: 'sj-1',
        user_id: 'test-user-1',
        job_id: 'job-1',
        notes: 'Looks good',
        priority: 'high',
        status: 'saved',
      });

      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jobId: 'job-1', notes: 'Looks good', priority: 'high' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.job_id).toBe('job-1');
      expect(res.body.data.priority).toBe('high');
    });

    it('should return 400 when jobId is missing', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'no job id' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('jobId is required');
    });

    it('should return 404 when job does not exist', async () => {
      Job.findById.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jobId: 'nonexistent-job' });

      expect(res.status).toBe(404);
    });

    it('should return 409 for duplicate save', async () => {
      Job.findById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
      SavedJob.save.mockResolvedValue(null); // null indicates duplicate

      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jobId: 'job-1' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already saved');
    });

    it('should reject invalid priority value', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jobId: 'job-1', priority: 'urgent' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid priority');
    });
  });

  // ==================== LIST SAVED JOBS ====================

  describe('GET /api/saved-jobs (list saved jobs)', () => {
    it('should return saved jobs list with pagination meta', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [
          { id: 'sj-1', job_id: 'j1', job_title: 'Engineer', priority: 'high', status: 'saved' },
          { id: 'sj-2', job_id: 'j2', job_title: 'Designer', priority: 'medium', status: 'saved' },
        ],
        total: 2,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.totalPages).toBe(1);
    });

    it('should return empty list when no saved jobs', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should support filtering by status', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [{ id: 'sj-1', status: 'applied' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/saved-jobs?status=applied')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({ status: 'applied' }),
      );
    });

    it('should support filtering by priority', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/saved-jobs?priority=high')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({ priority: 'high' }),
      );
    });

    it('should reject invalid status filter', async () => {
      const res = await request(app)
        .get('/api/saved-jobs?status=invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject invalid priority filter', async () => {
      const res = await request(app)
        .get('/api/saved-jobs?priority=critical')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should support pagination parameters', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 50,
        page: 3,
        limit: 10,
      });

      const res = await request(app)
        .get('/api/saved-jobs?page=3&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(3);
      expect(res.body.meta.totalPages).toBe(5);
      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({ page: 3, limit: 10 }),
      );
    });

    it('should cap limit at 100', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 100,
      });

      await request(app)
        .get('/api/saved-jobs?limit=500')
        .set('Authorization', `Bearer ${authToken}`);

      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({ limit: 100 }),
      );
    });
  });

  // ==================== UPDATE SAVED JOB ====================

  describe('PATCH /api/saved-jobs/:id (update saved job)', () => {
    it('should update notes', async () => {
      SavedJob.update.mockResolvedValue({
        id: 'sj-1',
        notes: 'Updated notes',
        priority: 'medium',
        status: 'saved',
      });

      const res = await request(app)
        .patch('/api/saved-jobs/sj-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Updated notes' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated notes');
    });

    it('should update priority', async () => {
      SavedJob.update.mockResolvedValue({
        id: 'sj-1',
        priority: 'high',
        status: 'saved',
      });

      const res = await request(app)
        .patch('/api/saved-jobs/sj-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.data.priority).toBe('high');
    });

    it('should update status', async () => {
      SavedJob.update.mockResolvedValue({
        id: 'sj-1',
        status: 'skipped',
      });

      const res = await request(app)
        .patch('/api/saved-jobs/sj-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'skipped' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('skipped');
    });

    it('should return 404 when saved job not found', async () => {
      SavedJob.update.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/saved-jobs/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'test' });

      expect(res.status).toBe(404);
    });

    it('should reject invalid status on update', async () => {
      const res = await request(app)
        .patch('/api/saved-jobs/sj-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid priority on update', async () => {
      const res = await request(app)
        .patch('/api/saved-jobs/sj-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 'urgent' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== DELETE SAVED JOB ====================

  describe('DELETE /api/saved-jobs/:id (remove saved job)', () => {
    it('should remove a saved job', async () => {
      SavedJob.removeById.mockResolvedValue({ id: 'sj-1' });

      const res = await request(app)
        .delete('/api/saved-jobs/sj-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.removed).toBe(true);
      expect(res.body.data.id).toBe('sj-1');
    });

    it('should return 404 when saved job not found for deletion', async () => {
      SavedJob.removeById.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/saved-jobs/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================== STATS ====================

  describe('GET /api/saved-jobs/stats', () => {
    it('should return saved job statistics', async () => {
      SavedJob.getStats.mockResolvedValue({
        total: 15,
        byStatus: { saved: 8, applied: 5, skipped: 2 },
        byPriority: { high: 4, medium: 7, low: 4 },
      });

      const res = await request(app)
        .get('/api/saved-jobs/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(15);
      expect(res.body.data.byStatus.saved).toBe(8);
      expect(res.body.data.byStatus.applied).toBe(5);
      expect(res.body.data.byPriority.high).toBe(4);
    });

    it('should return zero stats for new user', async () => {
      SavedJob.getStats.mockResolvedValue({
        total: 0,
        byStatus: { saved: 0, applied: 0, skipped: 0 },
        byPriority: { high: 0, medium: 0, low: 0 },
      });

      const res = await request(app)
        .get('/api/saved-jobs/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });
  });

  // ==================== BULK APPLY ====================

  describe('POST /api/saved-jobs/bulk-apply', () => {
    it('should bulk apply to saved jobs successfully', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: true,
        daily_limit: 50,
      });
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([
        { id: 'sj-1', job_id: 'j1', job_title: 'Engineer', job_company: 'TechCo' },
        { id: 'sj-2', job_id: 'j2', job_title: 'Designer', job_company: 'DesignCo' },
      ]);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maxApplications: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.submitted).toBe(2);
      expect(res.body.data.failed).toBe(0);
      expect(res.body.data.applications).toHaveLength(2);
    });

    it('should return 400 when no preferences set', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 403 when auto-apply is disabled', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: false,
        daily_limit: 50,
      });

      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should return 429 when daily limit reached', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: true,
        daily_limit: 10,
      });
      Application.countTodayByUser.mockResolvedValue(10);

      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(429);
    });

    it('should handle empty eligible jobs gracefully', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: true,
        daily_limit: 50,
      });
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.submitted).toBe(0);
      expect(res.body.data.totalEligible).toBe(0);
    });

    it('should handle partial failures in bulk apply', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: true,
        daily_limit: 50,
      });
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([
        { id: 'sj-1', job_id: 'j1', job_title: 'Engineer', job_company: 'TechCo' },
        { id: 'sj-2', job_id: 'j2', job_title: 'Designer', job_company: 'FailCo' },
      ]);
      submitApplication
        .mockResolvedValueOnce({ id: 'app-1' })
        .mockRejectedValueOnce(new Error('Submission failed'));
      SavedJob.markApplied.mockResolvedValue({});

      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.submitted).toBe(1);
      expect(res.body.data.failed).toBe(1);
    });

    it('should respect priority filter in bulk apply', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: true,
        daily_limit: 50,
      });
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([]);

      await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 'high' });

      expect(SavedJob.findSavedForBulkApply).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({ priority: 'high' }),
      );
    });

    it('should reject invalid priority in bulk apply', async () => {
      const res = await request(app)
        .post('/api/saved-jobs/bulk-apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 'urgent' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== FULL CRUD FLOW ====================

  describe('Full CRUD flow: save -> list -> update -> delete', () => {
    it('should complete full lifecycle of a saved job', async () => {
      // Step 1: Save the job
      Job.findById.mockResolvedValue({ id: 'job-1', title: 'SRE', company: 'CloudCo' });
      SavedJob.save.mockResolvedValue({
        id: 'sj-100',
        user_id: 'test-user-1',
        job_id: 'job-1',
        notes: '',
        priority: 'medium',
        status: 'saved',
      });

      const saveRes = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jobId: 'job-1' });

      expect(saveRes.status).toBe(201);
      const savedId = saveRes.body.data.id;

      // Step 2: List and verify present
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [{ id: savedId, job_id: 'job-1', status: 'saved' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const listRes = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      // Step 3: Update notes and priority
      SavedJob.update.mockResolvedValue({
        id: savedId,
        notes: 'Great opportunity',
        priority: 'high',
        status: 'saved',
      });

      const updateRes = await request(app)
        .patch(`/api/saved-jobs/${savedId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Great opportunity', priority: 'high' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.priority).toBe('high');

      // Step 4: Delete
      SavedJob.removeById.mockResolvedValue({ id: savedId });

      const deleteRes = await request(app)
        .delete(`/api/saved-jobs/${savedId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.removed).toBe(true);
    });
  });
});
