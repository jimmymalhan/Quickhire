jest.mock('../../../src/database/models/Job');
jest.mock('../../../src/database/models/UserPreference');
jest.mock('../../../src/utils/cache');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/automation/jobMatcher');
jest.mock('../../../src/scheduler/schedulerInit');

const {
  searchJobs,
  getJobById,
  triggerJobScrape,
  getRecommendations,
} = require('../../../src/api/controllers/jobController');
const Job = require('../../../src/database/models/Job');
const UserPreference = require('../../../src/database/models/UserPreference');
const cache = require('../../../src/utils/cache');
const { matchJobsForUser } = require('../../../src/automation/jobMatcher');
const { triggerScrape } = require('../../../src/scheduler/schedulerInit');

const createMockReq = (overrides = {}) => ({
  query: {},
  params: {},
  user: { id: 'user-1' },
  headers: {},
  ...overrides,
});

const createMockRes = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

describe('jobController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
    next = jest.fn();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(true);
  });

  describe('searchJobs', () => {
    it('should return search results with pagination', async () => {
      const jobs = [{ id: '1', title: 'Engineer' }];
      Job.search.mockResolvedValue({ jobs, total: 1, page: 1, limit: 20 });
      req.query = { role: 'Engineer', page: '1', limit: '20' };

      await searchJobs(req, res, next);

      expect(Job.search).toHaveBeenCalledWith(expect.objectContaining({ title: 'Engineer' }));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: jobs,
          meta: expect.objectContaining({ total: 1 }),
        }),
      );
    });

    it('should return cached results when available', async () => {
      const cached = { status: 'success', data: [], meta: {} };
      cache.get.mockResolvedValue(JSON.stringify(cached));

      await searchJobs(req, res, next);

      expect(Job.search).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(cached);
    });

    it('should enforce pagination limits', async () => {
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 100 });
      req.query = { limit: '500' };

      await searchJobs(req, res, next);

      expect(Job.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });

    it('should handle errors via next', async () => {
      const error = new Error('DB error');
      Job.search.mockRejectedValue(error);

      await searchJobs(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getJobById', () => {
    it('should return a job by id', async () => {
      const job = { id: '1', title: 'Engineer' };
      Job.findById.mockResolvedValue(job);
      req.params = { id: '1' };

      await getJobById(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: job }));
    });

    it('should return 404 for missing job', async () => {
      Job.findById.mockResolvedValue(null);
      req.params = { id: 'nonexistent' };

      await getJobById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('should return cached job when available', async () => {
      const cached = { status: 'success', data: { id: '1' } };
      cache.get.mockResolvedValue(JSON.stringify(cached));
      req.params = { id: '1' };

      await getJobById(req, res, next);

      expect(Job.findById).not.toHaveBeenCalled();
    });
  });

  describe('triggerJobScrape', () => {
    it('should trigger a scrape with search params', async () => {
      triggerScrape.mockResolvedValue({ jobId: 'job-123' });
      req.query = { role: 'Engineer', location: 'SF' };

      await triggerJobScrape(req, res, next);

      expect(triggerScrape).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Engineer', location: 'SF' }),
        'user-1',
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: { jobId: 'job-123' },
        }),
      );
    });

    it('should trigger scrape with empty params', async () => {
      triggerScrape.mockResolvedValue({ jobId: 'job-456' });

      await triggerJobScrape(req, res, next);

      expect(triggerScrape).toHaveBeenCalledWith({}, 'user-1');
    });

    it('should parse salary params as integers', async () => {
      triggerScrape.mockResolvedValue({ jobId: 'job-789' });
      req.query = { salary_min: '80000', salary_max: '150000' };

      await triggerJobScrape(req, res, next);

      expect(triggerScrape).toHaveBeenCalledWith(
        expect.objectContaining({ salaryMin: 80000, salaryMax: 150000 }),
        'user-1',
      );
    });

    it('should handle errors via next', async () => {
      triggerScrape.mockRejectedValue(new Error('Queue error'));

      await triggerJobScrape(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRecommendations', () => {
    it('should return matched jobs based on user preferences', async () => {
      const prefs = { target_roles: ['Engineer'] };
      const jobs = [
        { id: '1', title: 'Software Engineer', company: 'Co' },
        { id: '2', title: 'Manager', company: 'Co' },
      ];
      UserPreference.findByUserId.mockResolvedValue(prefs);
      Job.search.mockResolvedValue({ jobs, total: 2, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue([
        { job: jobs[0], match: { score: 85, reason: 'Good match' } },
      ]);

      await getRecommendations(req, res, next);

      expect(UserPreference.findByUserId).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: [expect.objectContaining({ id: '1', matchScore: 85 })],
        }),
      );
    });

    it('should return error when no preferences set', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);

      await getRecommendations(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('should filter by min_score', async () => {
      const prefs = { target_roles: ['Engineer'] };
      const jobs = [{ id: '1', title: 'Engineer' }];
      UserPreference.findByUserId.mockResolvedValue(prefs);
      Job.search.mockResolvedValue({ jobs, total: 1, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue([
        { job: jobs[0], match: { score: 40, reason: 'Below threshold' } },
      ]);
      req.query = { min_score: '50' };

      await getRecommendations(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    });

    it('should return cached recommendations', async () => {
      UserPreference.findByUserId.mockResolvedValue({ target_roles: ['Eng'] });
      const cached = { status: 'success', data: [] };
      cache.get.mockResolvedValue(JSON.stringify(cached));

      await getRecommendations(req, res, next);

      expect(Job.search).not.toHaveBeenCalled();
    });

    it('should handle pagination', async () => {
      const prefs = { target_roles: ['Engineer'] };
      const jobs = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: 'Engineer' }));
      UserPreference.findByUserId.mockResolvedValue(prefs);
      Job.search.mockResolvedValue({ jobs, total: 5, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue(
        jobs.map((j) => ({ job: j, match: { score: 80, reason: 'Good match' } })),
      );
      req.query = { page: '2', limit: '2' };

      await getRecommendations(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data).toHaveLength(2);
      expect(response.meta.page).toBe(2);
      expect(response.meta.total).toBe(5);
    });
  });
});
