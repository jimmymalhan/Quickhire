jest.mock('../../../src/database/models/Application');
jest.mock('../../../src/database/models/ApplicationLog');
jest.mock('../../../src/database/models/UserPreference');
jest.mock('../../../src/database/models/Job');
jest.mock('../../../src/automation/applicationSubmitter');
jest.mock('../../../src/automation/jobMatcher');
jest.mock('../../../src/database/connection');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/config', () => ({
  application: { maxPerDay: 50, retryAttempts: 3, retryDelayMs: 100, minIntervalSeconds: 60 },
  features: { mockLinkedIn: true },
}));

const {
  listApplications,
  getApplication,
  applyToJob,
  updateApplicationStatus,
  autoApply,
  getStats,
} = require('../../../src/api/controllers/applicationController');
const Application = require('../../../src/database/models/Application');
const ApplicationLog = require('../../../src/database/models/ApplicationLog');
const UserPreference = require('../../../src/database/models/UserPreference');
const Job = require('../../../src/database/models/Job');
const { submitApplication } = require('../../../src/automation/applicationSubmitter');
const { matchJobsForUser } = require('../../../src/automation/jobMatcher');
const { query } = require('../../../src/database/connection');

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

describe('applicationController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
    next = jest.fn();
  });

  describe('listApplications', () => {
    it('should return paginated applications', async () => {
      Application.findByUserId.mockResolvedValue({
        applications: [{ id: '1' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      await listApplications(req, res, next);

      expect(Application.findByUserId).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', data: [{ id: '1' }] }),
      );
    });

    it('should filter by status', async () => {
      req.query = { status: 'submitted' };
      Application.findByUserId.mockResolvedValue({
        applications: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await listApplications(req, res, next);

      expect(Application.findByUserId).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ status: 'submitted' }),
      );
    });
  });

  describe('getApplication', () => {
    it('should return application with logs', async () => {
      const app = { id: '1', user_id: 'user-1' };
      Application.findById.mockResolvedValue(app);
      ApplicationLog.findByApplicationId.mockResolvedValue([{ action: 'created' }]);
      req.params = { id: '1' };

      await getApplication(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: '1', logs: expect.any(Array) }),
        }),
      );
    });

    it('should return 404 for missing application', async () => {
      Application.findById.mockResolvedValue(null);
      req.params = { id: 'nonexistent' };

      await getApplication(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('should return 404 when application belongs to different user', async () => {
      Application.findById.mockResolvedValue({ id: '1', user_id: 'other-user' });
      req.params = { id: '1' };

      await getApplication(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });
  });

  describe('applyToJob', () => {
    it('should submit an application', async () => {
      const app = { id: 'app-1', status: 'submitted' };
      submitApplication.mockResolvedValue(app);
      req.params = { id: 'job-1' };
      req.body = { resumeVersion: 2 };

      await applyToJob(req, res, next);

      expect(submitApplication).toHaveBeenCalledWith('user-1', 'job-1', 2);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should default to resume version 1', async () => {
      submitApplication.mockResolvedValue({ id: 'app-1' });
      req.params = { id: 'job-1' };

      await applyToJob(req, res, next);

      expect(submitApplication).toHaveBeenCalledWith('user-1', 'job-1', 1);
    });
  });

  describe('updateApplicationStatus', () => {
    it('should update status', async () => {
      Application.findById.mockResolvedValue({ id: '1', user_id: 'user-1', status: 'pending' });
      Application.updateStatus.mockResolvedValue({ id: '1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});
      req.params = { id: '1' };
      req.body = { status: 'submitted' };

      await updateApplicationStatus(req, res, next);

      expect(Application.updateStatus).toHaveBeenCalledWith('1', 'submitted');
    });

    it('should reject invalid statuses', async () => {
      req.params = { id: '1' };
      req.body = { status: 'invalid' };

      await updateApplicationStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });
  });

  describe('autoApply', () => {
    const mockPrefs = {
      auto_apply_enabled: true,
      daily_limit: 50,
      target_roles: ['Engineer'],
    };

    it('should auto-apply to matched jobs', async () => {
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
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
      req.body = { min_score: 70 };

      await autoApply(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.data.submitted).toBe(1);
    });

    it('should reject when no preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);
      req.body = {};

      await autoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });

    it('should reject when auto-apply disabled', async () => {
      UserPreference.findByUserId.mockResolvedValue({ ...mockPrefs, auto_apply_enabled: false });
      req.body = {};

      await autoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    });

    it('should reject when daily limit reached', async () => {
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(50);
      req.body = {};

      await autoApply(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'APPLICATION_LIMIT_REACHED' }),
      );
    });

    it('should skip already-applied jobs', async () => {
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
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
      query.mockResolvedValue({ rows: [{ job_id: 'j1' }] });
      req.body = {};

      await autoApply(req, res, next);

      expect(submitApplication).not.toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.submitted).toBe(0);
    });

    it('should handle partial failures', async () => {
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      const jobs = [
        { id: 'j1', title: 'Engineer', company: 'A' },
        { id: 'j2', title: 'Engineer', company: 'B' },
      ];
      Job.search.mockResolvedValue({ jobs, total: 2, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue(
        jobs.map((j) => ({ job: j, match: { score: 85 } })),
      );
      query.mockResolvedValue({ rows: [] });
      submitApplication
        .mockResolvedValueOnce({ id: 'app-1' })
        .mockRejectedValueOnce(new Error('Failed'));
      req.body = {};

      await autoApply(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.submitted).toBe(1);
      expect(response.data.failed).toBe(1);
    });

    it('should respect max_applications limit', async () => {
      UserPreference.findByUserId.mockResolvedValue(mockPrefs);
      Application.countTodayByUser.mockResolvedValue(0);
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        id: 'j' + i,
        title: 'Engineer',
        company: 'Co' + i,
      }));
      Job.search.mockResolvedValue({ jobs, total: 10, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue(
        jobs.map((j) => ({ job: j, match: { score: 90 } })),
      );
      query.mockResolvedValue({ rows: [] });
      submitApplication.mockResolvedValue({ id: 'app-x' });
      req.body = { max_applications: 3 };

      await autoApply(req, res, next);

      expect(submitApplication).toHaveBeenCalledTimes(3);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { status: 'submitted', count: '10' },
          { status: 'pending', count: '5' },
          { status: 'viewed', count: '3' },
          { status: 'rejected', count: '2' },
        ],
      });
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '8' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '20' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      query.mockResolvedValueOnce({
        rows: [{ scrape_count: '4', total_jobs_scraped: '100', total_matched: '30' }],
      });
      UserPreference.findByUserId.mockResolvedValue({ daily_limit: 50 });

      await getStats(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.status).toBe('success');
      expect(response.data.applications.total).toBe(20);
      expect(response.data.applications.today).toBe(2);
      expect(response.data.applications.thisWeek).toBe(8);
      expect(response.data.applications.byStatus).toEqual({
        submitted: 10,
        pending: 5,
        viewed: 3,
        rejected: 2,
      });
      expect(response.data.applications.responseRate).toBe(33);
      expect(response.data.scraping.totalScrapes).toBe(4);
      expect(response.data.limits.dailyLimit).toBe(50);
      expect(response.data.limits.remainingToday).toBe(48);
    });

    it('should handle zero applications', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({
        rows: [{ scrape_count: '0', total_jobs_scraped: '0', total_matched: '0' }],
      });
      UserPreference.findByUserId.mockResolvedValue(null);

      await getStats(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.applications.total).toBe(0);
      expect(response.data.applications.responseRate).toBe(0);
      expect(response.data.limits.dailyLimit).toBe(50);
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('DB error'));

      await getStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
