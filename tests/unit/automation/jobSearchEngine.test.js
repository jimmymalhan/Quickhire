jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/utils/config', () => ({
  features: { mockLinkedIn: true },
}));

jest.mock('../../../src/database/models/Job', () => ({
  search: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../src/database/models/UserPreference', () => ({
  findByUserId: jest.fn(),
}));

jest.mock('../../../src/automation/jobMatcher', () => ({
  calculateMatchScore: jest.fn(),
  matchJobsForUser: jest.fn(),
}));

const JobSearchEngine = require('../../../src/automation/jobSearchEngine');
const Job = require('../../../src/database/models/Job');
const UserPreference = require('../../../src/database/models/UserPreference');
const { calculateMatchScore, matchJobsForUser } = require('../../../src/automation/jobMatcher');

describe('JobSearchEngine', () => {
  let engine;
  let jobs;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new JobSearchEngine({ cacheTtl: 1000, cacheMaxSize: 100 });
    jobs = [
      {
        id: 'job-1',
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Remote',
        salary_max: 180000,
        salary_min: 140000,
        posted_at: new Date().toISOString(),
        job_level: 'senior',
      },
      {
        id: 'job-2',
        title: 'Frontend Engineer',
        company: 'Beta',
        location: 'New York, NY',
        salary_max: 150000,
        salary_min: 120000,
        posted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        job_level: 'mid',
      },
    ];
    Job.search.mockResolvedValue({ jobs, total: jobs.length });
    UserPreference.findByUserId.mockResolvedValue({
      target_roles: ['Backend Engineer'],
      target_locations: ['Remote'],
      experience_level: ['senior'],
    });
    matchJobsForUser.mockReturnValue([
      { job: jobs[0], match: { score: 82, reason: 'Strong fit' } },
      { job: jobs[1], match: { score: 55, reason: 'Partial fit' } },
    ]);
    calculateMatchScore.mockReturnValue({ score: 77, reason: 'Similar title' });
  });

  it('searches jobs with normalized filters and tracks history', async () => {
    const result = await engine.search('backend', {
      location: 'Remote',
      remote: true,
      page: '2',
      limit: '10',
      userId: 'user-1',
    });

    expect(Job.search).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'backend',
        location: 'Remote',
        page: 2,
        limit: 10,
      }),
    );
    expect(result.jobs).toHaveLength(1);
    expect(result.totalPages).toBe(1);
    expect((await engine.searchHistory('user-1')).history).toHaveLength(1);
  });

  it('returns cached search results on repeat calls', async () => {
    await engine.search('backend', { page: 1, limit: 5 });
    await engine.search('backend', { page: 1, limit: 5 });

    expect(Job.search).toHaveBeenCalledTimes(1);
  });

  it('sorts search results by salary and date', async () => {
    const bySalary = await engine.search('', { sortBy: 'salary' });
    const byDate = await engine.search('', { sortBy: 'date', page: 2 });

    expect(bySalary.jobs[0].salary_max).toBeGreaterThanOrEqual(bySalary.jobs[1].salary_max);
    expect(new Date(byDate.jobs[0].posted_at).getTime()).toBeGreaterThanOrEqual(
      new Date(byDate.jobs[1].posted_at).getTime(),
    );
  });

  it('returns recommendation fallback when preferences are missing', async () => {
    UserPreference.findByUserId.mockResolvedValueOnce(null);

    const result = await engine.getRecommendations('user-1');

    expect(result.message).toContain('Set up your preferences first');
    expect(result.jobs).toEqual([]);
  });

  it('returns paginated recommendations and caches them', async () => {
    const result = await engine.getRecommendations('user-1', { minScore: 60, limit: 1 });

    expect(matchJobsForUser).toHaveBeenCalled();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toEqual(expect.objectContaining({ matchScore: 82 }));

    await engine.getRecommendations('user-1', { minScore: 60, limit: 1 });
    expect(UserPreference.findByUserId).toHaveBeenCalledTimes(1);
  });

  it('boosts recommendation scores based on search history', () => {
    engine._addSearchHistory('user-1', 'backend platform', {});
    const boosted = engine._boostByHistory(
      [{ job: jobs[0], match: { score: 70, reason: 'fit' } }],
      engine._getSearchHistory('user-1'),
    );

    expect(boosted[0].match.score).toBeGreaterThan(70);
    expect(boosted[0].match.reason).toContain('boosted by search history');
  });

  it('finds similar jobs using matcher scores', async () => {
    Job.findById.mockResolvedValueOnce(jobs[0]);

    const result = await engine.getSimilarJobs('job-1', { limit: 5 });

    expect(Job.findById).toHaveBeenCalledWith('job-1');
    expect(calculateMatchScore).toHaveBeenCalled();
    expect(result.referenceJob.id).toBe('job-1');
    expect(result.similarJobs).toHaveLength(1);
  });

  it('returns null for similar jobs when the reference job is missing', async () => {
    Job.findById.mockResolvedValueOnce(null);
    await expect(engine.getSimilarJobs('missing')).resolves.toBeNull();
  });

  it('returns trending jobs ranked by recency and salary', async () => {
    const result = await engine.getTrendingJobs('Remote', { limit: 5, days: 7 });

    expect(Job.search).toHaveBeenCalledWith(expect.objectContaining({ location: 'Remote' }));
    expect(result.location).toBe('Remote');
    expect(result.jobs[0]).toEqual(expect.objectContaining({ trendingScore: expect.any(Number) }));
  });

  it('clears search history', async () => {
    engine._addSearchHistory('user-1', 'backend', { remote: true });
    await engine.clearSearchHistory('user-1');

    expect(engine._getSearchHistory('user-1')).toEqual([]);
  });
});
