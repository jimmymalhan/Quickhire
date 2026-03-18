jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../src/utils/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../../src/database/models/Job', () => ({
  search: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../../src/database/models/UserPreference', () => ({
  findByUserId: jest.fn(),
}));

jest.mock('../../../../src/automation/jobMatcher', () => ({
  matchJobsForUser: jest.fn(() => []),
}));

jest.mock('../../../../src/scheduler/schedulerInit', () => ({
  triggerScrape: jest.fn().mockResolvedValue({ jobId: 'mock-id' }),
}));

jest.mock('../../../../src/utils/errorCodes', () => {
  class AppError extends Error {
    constructor(errorCode, message) {
      super(message);
      this.name = 'AppError';
      this.code = errorCode.code;
      this.statusCode = errorCode.status;
    }
  }
  return {
    AppError,
    ERROR_CODES: {
      NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
    },
  };
});

const { searchJobs, getJobById, triggerJobScrape, getRecommendations } = require('../../../../src/api/controllers/jobController');
const Job = require('../../../../src/database/models/Job');
const UserPreference = require('../../../../src/database/models/UserPreference');
const cache = require('../../../../src/utils/cache');
const { matchJobsForUser } = require('../../../../src/automation/jobMatcher');
const { triggerScrape } = require('../../../../src/scheduler/schedulerInit');

describe('jobController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {}, params: {}, user: { id: 'user-1' } };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('searchJobs', () => {
    it('returns cached result when available', async () => {
      const cached = JSON.stringify({ status: 'success', data: [] });
      cache.get.mockResolvedValue(cached);

      await searchJobs(req, res, next);
      expect(res.json).toHaveBeenCalledWith(JSON.parse(cached));
      expect(Job.search).not.toHaveBeenCalled();
    });

    it('searches database when no cache', async () => {
      cache.get.mockResolvedValue(null);
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 20 });

      await searchJobs(req, res, next);
      expect(Job.search).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', code: 200 })
      );
    });

    it('caches search results', async () => {
      cache.get.mockResolvedValue(null);
      Job.search.mockResolvedValue({ jobs: [{ id: 1 }], total: 1, page: 1, limit: 20 });

      await searchJobs(req, res, next);
      expect(cache.set).toHaveBeenCalled();
    });

    it('passes query params to search', async () => {
      cache.get.mockResolvedValue(null);
      req.query = { role: 'Engineer', location: 'NYC', salary_min: '100000', level: 'mid' };
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 20 });

      await searchJobs(req, res, next);
      expect(Job.search).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Engineer',
          location: 'NYC',
          salaryMin: 100000,
          jobLevel: 'mid',
        })
      );
    });

    it('defaults page to 1 and limit to 20', async () => {
      cache.get.mockResolvedValue(null);
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 20 });

      await searchJobs(req, res, next);
      expect(Job.search).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 })
      );
    });

    it('clamps page minimum to 1', async () => {
      cache.get.mockResolvedValue(null);
      req.query = { page: '-5' };
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 20 });

      await searchJobs(req, res, next);
      expect(Job.search).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    it('clamps limit to max 100', async () => {
      cache.get.mockResolvedValue(null);
      req.query = { limit: '500' };
      Job.search.mockResolvedValue({ jobs: [], total: 0, page: 1, limit: 100 });

      await searchJobs(req, res, next);
      expect(Job.search).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });

    it('includes pagination meta in response', async () => {
      cache.get.mockResolvedValue(null);
      Job.search.mockResolvedValue({ jobs: Array(20).fill({}), total: 50, page: 1, limit: 20 });

      await searchJobs(req, res, next);
      const response = res.json.mock.calls[0][0];
      expect(response.meta.total).toBe(50);
      expect(response.meta.totalPages).toBe(3);
    });

    it('calls next on error', async () => {
      cache.get.mockRejectedValue(new Error('cache error'));

      await searchJobs(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getJobById', () => {
    it('returns cached job when available', async () => {
      const cached = JSON.stringify({ status: 'success', data: { id: '1' } });
      cache.get.mockResolvedValue(cached);
      req.params = { id: '1' };

      await getJobById(req, res, next);
      expect(res.json).toHaveBeenCalledWith(JSON.parse(cached));
    });

    it('fetches from database when no cache', async () => {
      cache.get.mockResolvedValue(null);
      Job.findById.mockResolvedValue({ id: '1', title: 'Engineer' });
      req.params = { id: '1' };

      await getJobById(req, res, next);
      expect(Job.findById).toHaveBeenCalledWith('1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      );
    });

    it('caches fetched job', async () => {
      cache.get.mockResolvedValue(null);
      Job.findById.mockResolvedValue({ id: '1' });
      req.params = { id: '1' };

      await getJobById(req, res, next);
      expect(cache.set).toHaveBeenCalled();
    });

    it('calls next with AppError when job not found', async () => {
      cache.get.mockResolvedValue(null);
      Job.findById.mockResolvedValue(null);
      req.params = { id: 'nonexistent' };

      await getJobById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('calls next on database error', async () => {
      cache.get.mockResolvedValue(null);
      Job.findById.mockRejectedValue(new Error('db error'));
      req.params = { id: '1' };

      await getJobById(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('triggerJobScrape', () => {
    it('triggers scrape and returns result', async () => {
      req.query = { role: 'Engineer', location: 'NYC' };

      await triggerJobScrape(req, res, next);
      expect(triggerScrape).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Engineer', location: 'NYC' }),
        'user-1'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      );
    });

    it('calls next on error', async () => {
      triggerScrape.mockRejectedValue(new Error('queue error'));

      await triggerJobScrape(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRecommendations', () => {
    it('returns matched jobs sorted by score', async () => {
      cache.get.mockResolvedValue(null);
      UserPreference.findByUserId.mockResolvedValue({ target_roles: ['Engineer'] });
      Job.search.mockResolvedValue({ jobs: [{ id: 1, title: 'Engineer' }], total: 1, page: 1, limit: 200 });
      matchJobsForUser.mockReturnValue([
        { job: { id: 1, title: 'Engineer' }, match: { score: 85, reason: 'Good match' } },
      ]);

      await getRecommendations(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.arrayContaining([
            expect.objectContaining({ matchScore: 85 }),
          ]),
        })
      );
    });

    it('returns NOT_FOUND when no preferences', async () => {
      cache.get.mockResolvedValue(null);
      UserPreference.findByUserId.mockResolvedValue(null);

      await getRecommendations(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('returns cached recommendations', async () => {
      const cached = JSON.stringify({ status: 'success', data: [] });
      UserPreference.findByUserId.mockResolvedValue({ target_roles: ['Engineer'] });
      cache.get
        .mockResolvedValueOnce(null) // First call won't match cache key
        .mockResolvedValue(cached);
      // The cache key includes user ID, so the second get call for recommendations will hit
      // We need to mock properly for the recommendation cache key
      cache.get.mockResolvedValue(cached);

      await getRecommendations(req, res, next);
      expect(res.json).toHaveBeenCalledWith(JSON.parse(cached));
    });

    it('calls next on error', async () => {
      cache.get.mockResolvedValue(null);
      UserPreference.findByUserId.mockRejectedValue(new Error('db error'));

      await getRecommendations(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
