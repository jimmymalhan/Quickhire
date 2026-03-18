jest.mock('../../../src/database/models/SavedJob');
jest.mock('../../../src/database/models/Job');
jest.mock('../../../src/database/models/UserPreference');
jest.mock('../../../src/database/models/Application');
jest.mock('../../../src/automation/applicationSubmitter');
jest.mock('../../../src/database/connection');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../src/utils/config', () => ({
  application: { maxPerDay: 50, retryAttempts: 3, retryDelayMs: 100, minIntervalSeconds: 60 },
  features: { mockLinkedIn: true },
  logging: { level: 'info' },
  db: { host: 'localhost', port: 5432, name: 'test' },
  redis: { host: 'localhost', port: 6379 },
}));

const {
  listSavedJobs,
  saveJob,
  updateSavedJob,
  removeSavedJob,
  getSavedJobStats,
  bulkAutoApply,
} = require('../../../src/api/controllers/savedJobsController');
const SavedJob = require('../../../src/database/models/SavedJob');
const Job = require('../../../src/database/models/Job');
const UserPreference = require('../../../src/database/models/UserPreference');
const Application = require('../../../src/database/models/Application');
const { submitApplication } = require('../../../src/automation/applicationSubmitter');

const createMockReq = (overrides = {}) => ({
  query: {},
  params: {},
  body: {},
  user: { id: 'user-1' },
  ...overrides,
});

const createMockRes = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

describe('savedJobsController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
    next = jest.fn();
  });

  describe('listSavedJobs', () => {
    it('returns paginated saved jobs', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [{ id: 'sj-1' }, { id: 'sj-2' }],
        total: 2,
        page: 1,
        limit: 20,
      });

      await listSavedJobs(req, res, next);

      expect(SavedJob.findByUser).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: 200,
          data: expect.any(Array),
        }),
      );
    });

    it('includes pagination meta', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 50,
        page: 1,
        limit: 20,
      });

      await listSavedJobs(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.meta.total).toBe(50);
      expect(response.meta.totalPages).toBe(3);
      expect(response.meta.page).toBe(1);
      expect(response.meta.limit).toBe(20);
    });

    it('filters by status', async () => {
      req.query = { status: 'saved' };
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await listSavedJobs(req, res, next);

      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ status: 'saved' }),
      );
    });

    it('filters by priority', async () => {
      req.query = { priority: 'high' };
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await listSavedJobs(req, res, next);

      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ priority: 'high' }),
      );
    });

    it('rejects invalid status', async () => {
      req.query = { status: 'invalid_status' };

      await listSavedJobs(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('rejects invalid priority', async () => {
      req.query = { priority: 'urgent' };

      await listSavedJobs(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('defaults page to 1 and limit to 20', async () => {
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await listSavedJobs(req, res, next);

      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('caps limit at 100', async () => {
      req.query = { limit: '500' };
      SavedJob.findByUser.mockResolvedValue({
        savedJobs: [],
        total: 0,
        page: 1,
        limit: 100,
      });

      await listSavedJobs(req, res, next);

      expect(SavedJob.findByUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ limit: 100 }),
      );
    });

    it('calls next on database error', async () => {
      SavedJob.findByUser.mockRejectedValue(new Error('DB error'));

      await listSavedJobs(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('saveJob', () => {
    it('saves a job successfully and returns 201', async () => {
      req.body = { jobId: 'job-1', notes: 'Great role', priority: 'high' };
      Job.findById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
      SavedJob.save.mockResolvedValue({ id: 'sj-1', job_id: 'job-1' });

      await saveJob(req, res, next);

      expect(Job.findById).toHaveBeenCalledWith('job-1');
      expect(SavedJob.save).toHaveBeenCalledWith('user-1', 'job-1', {
        notes: 'Great role',
        customResumeId: undefined,
        priority: 'high',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: 201,
          data: expect.objectContaining({ id: 'sj-1' }),
        }),
      );
    });

    it('rejects when jobId is missing', async () => {
      req.body = {};

      await saveJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('rejects when job is not found', async () => {
      req.body = { jobId: 'nonexistent' };
      Job.findById.mockResolvedValue(null);

      await saveJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });

    it('rejects when job is already saved (duplicate)', async () => {
      req.body = { jobId: 'job-1' };
      Job.findById.mockResolvedValue({ id: 'job-1' });
      SavedJob.save.mockResolvedValue(null);

      await saveJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CONFLICT' }),
      );
    });

    it('rejects invalid priority', async () => {
      req.body = { jobId: 'job-1', priority: 'urgent' };

      await saveJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('accepts all valid priorities', async () => {
      for (const priority of ['high', 'medium', 'low']) {
        jest.clearAllMocks();
        req = createMockReq({ body: { jobId: 'job-1', priority } });
        res = createMockRes();
        next = jest.fn();

        Job.findById.mockResolvedValue({ id: 'job-1' });
        SavedJob.save.mockResolvedValue({ id: 'sj-1' });

        await saveJob(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      }
    });

    it('calls next on database error', async () => {
      req.body = { jobId: 'job-1' };
      Job.findById.mockRejectedValue(new Error('DB error'));

      await saveJob(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateSavedJob', () => {
    it('updates saved job and returns success', async () => {
      req.params = { id: 'sj-1' };
      req.body = { notes: 'Updated notes', priority: 'high' };
      SavedJob.update.mockResolvedValue({ id: 'sj-1', notes: 'Updated notes', priority: 'high' });

      await updateSavedJob(req, res, next);

      expect(SavedJob.update).toHaveBeenCalledWith('sj-1', 'user-1', {
        notes: 'Updated notes',
        priority: 'high',
        status: undefined,
        customResumeId: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', code: 200 }),
      );
    });

    it('rejects invalid status', async () => {
      req.params = { id: 'sj-1' };
      req.body = { status: 'invalid' };

      await updateSavedJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('rejects invalid priority', async () => {
      req.params = { id: 'sj-1' };
      req.body = { priority: 'critical' };

      await updateSavedJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('returns NOT_FOUND when saved job does not exist', async () => {
      req.params = { id: 'nonexistent' };
      req.body = { notes: 'test' };
      SavedJob.update.mockResolvedValue(null);

      await updateSavedJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });

    it('calls next on database error', async () => {
      req.params = { id: 'sj-1' };
      req.body = { notes: 'test' };
      SavedJob.update.mockRejectedValue(new Error('DB error'));

      await updateSavedJob(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('accepts all valid statuses', async () => {
      for (const status of ['saved', 'applied', 'skipped']) {
        jest.clearAllMocks();
        req = createMockReq({ params: { id: 'sj-1' }, body: { status } });
        res = createMockRes();
        next = jest.fn();
        SavedJob.update.mockResolvedValue({ id: 'sj-1', status });

        await updateSavedJob(req, res, next);

        expect(next).not.toHaveBeenCalled();
      }
    });
  });

  describe('removeSavedJob', () => {
    it('removes saved job and returns success', async () => {
      req.params = { id: 'sj-1' };
      SavedJob.removeById.mockResolvedValue({ id: 'sj-1' });

      await removeSavedJob(req, res, next);

      expect(SavedJob.removeById).toHaveBeenCalledWith('sj-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({ id: 'sj-1', removed: true }),
        }),
      );
    });

    it('returns NOT_FOUND when saved job does not exist', async () => {
      req.params = { id: 'nonexistent' };
      SavedJob.removeById.mockResolvedValue(null);

      await removeSavedJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });

    it('calls next on database error', async () => {
      req.params = { id: 'sj-1' };
      SavedJob.removeById.mockRejectedValue(new Error('DB error'));

      await removeSavedJob(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getSavedJobStats', () => {
    it('returns stats for user', async () => {
      const stats = {
        total: 10,
        byStatus: { saved: 5, applied: 3, skipped: 2 },
        byPriority: { high: 4, medium: 3, low: 3 },
      };
      SavedJob.getStats.mockResolvedValue(stats);

      await getSavedJobStats(req, res, next);

      expect(SavedJob.getStats).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: 200,
          data: stats,
        }),
      );
    });

    it('handles zero stats', async () => {
      SavedJob.getStats.mockResolvedValue({
        total: 0,
        byStatus: { saved: 0, applied: 0, skipped: 0 },
        byPriority: { high: 0, medium: 0, low: 0 },
      });

      await getSavedJobStats(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.total).toBe(0);
    });

    it('calls next on database error', async () => {
      SavedJob.getStats.mockRejectedValue(new Error('DB error'));

      await getSavedJobStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('bulkAutoApply', () => {
    const mockPrefs = {
      auto_apply_enabled: true,
      daily_limit: 50,
    };

    const mockSavedJobs = [
      {
        id: 'sj-1',
        job_id: 'job-1',
        job_title: 'Engineer',
        job_company: 'Acme',
        custom_resume_id: null,
      },
      {
        id: 'sj-2',
        job_id: 'job-2',
        job_title: 'Designer',
        job_company: 'Corp',
        custom_resume_id: 'resume-5',
      },
    ];

    it('applies to saved jobs and returns 201', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue(mockSavedJobs);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.data.submitted).toBe(2);
      expect(response.data.failed).toBe(0);
      expect(response.data.totalEligible).toBe(2);
    });

    it('rejects when no preferences set', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(null);

      await bulkAutoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('rejects when auto-apply is disabled', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue({
        ...mockPrefs,
        auto_apply_enabled: false,
      });

      await bulkAutoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
    });

    it('rejects when daily limit reached', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(50);

      await bulkAutoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'APPLICATION_LIMIT_REACHED' }),
      );
    });

    it('returns zero results when no eligible saved jobs', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([]);

      await bulkAutoApply(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.submitted).toBe(0);
      expect(response.data.totalEligible).toBe(0);
      expect(response.meta.message).toContain('No saved jobs');
    });

    it('handles partial failures in batch', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue(mockSavedJobs);
      submitApplication
        .mockResolvedValueOnce({ id: 'app-1' })
        .mockRejectedValueOnce(new Error('Submission failed'));
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.submitted).toBe(1);
      expect(response.data.failed).toBe(1);
    });

    it('marks saved jobs as applied after submission', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([mockSavedJobs[0]]);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      expect(SavedJob.markApplied).toHaveBeenCalledWith('sj-1', 'user-1');
    });

    it('uses custom_resume_id when available', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([mockSavedJobs[1]]);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      expect(submitApplication).toHaveBeenCalledWith('user-1', 'job-2', 'resume-5');
    });

    it('defaults to resume version 1 when no custom resume', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([mockSavedJobs[0]]);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      expect(submitApplication).toHaveBeenCalledWith('user-1', 'job-1', 1);
    });

    it('rejects invalid priority filter', async () => {
      req.body = { priority: 'urgent' };

      await bulkAutoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    });

    it('respects maxApplications parameter', async () => {
      req.body = { maxApplications: 1 };
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([mockSavedJobs[0]]);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      expect(SavedJob.findSavedForBulkApply).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ limit: 1 }),
      );
    });

    it('caps maxApplications at 50', async () => {
      req.body = { maxApplications: 200 };
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([]);

      await bulkAutoApply(req, res, next);

      expect(SavedJob.findSavedForBulkApply).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ limit: 50 }),
      );
    });

    it('limits by remaining daily quota', async () => {
      req.body = { maxApplications: 20 };
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(45); // 5 remaining
      SavedJob.findSavedForBulkApply.mockResolvedValue([]);

      await bulkAutoApply(req, res, next);

      expect(SavedJob.findSavedForBulkApply).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ limit: 5 }),
      );
    });

    it('includes remainingToday in meta', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(10);
      SavedJob.findSavedForBulkApply.mockResolvedValue([mockSavedJobs[0]]);
      submitApplication.mockResolvedValue({ id: 'app-1' });
      SavedJob.markApplied.mockResolvedValue({});

      await bulkAutoApply(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.meta.remainingToday).toBe(39); // 50-10-1
    });

    it('includes priority filter in meta', async () => {
      req.body = { priority: 'high' };
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      SavedJob.findSavedForBulkApply.mockResolvedValue([]);

      await bulkAutoApply(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.meta.priorityFilter).toBe('high');
    });

    it('uses config maxPerDay when preferences has no daily_limit', async () => {
      req.body = {};
      UserPreference.findByUserId.mockResolvedValue({
        auto_apply_enabled: true,
        daily_limit: null,
      });
      Application.countTodayByUser.mockResolvedValue(50);

      await bulkAutoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'APPLICATION_LIMIT_REACHED' }),
      );
    });

    it('calls next on unexpected error', async () => {
      req.body = {};
      UserPreference.findByUserId.mockRejectedValue(new Error('DB error'));

      await bulkAutoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
