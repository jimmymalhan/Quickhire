const { calculateMatchScore, matchJobsForUser } = require('../../../src/automation/jobMatcher');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('jobMatcher', () => {
  describe('calculateMatchScore', () => {
    const baseJob = {
      title: 'Software Engineer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      salary_min: 100000,
      salary_max: 150000,
      job_level: 'mid',
    };

    const fullPrefs = {
      target_roles: ['Software Engineer'],
      target_locations: ['San Francisco'],
      min_salary: 80000,
      max_salary: 200000,
      experience_level: ['mid', 'senior'],
      excluded_companies: [],
    };

    it('returns perfect score for fully matching job', () => {
      const result = calculateMatchScore(baseJob, fullPrefs);
      expect(result.score).toBe(100);
      expect(result.matched).toBe(true);
      expect(result.reason).toBe('Good match');
    });

    it('returns 0 for excluded company', () => {
      const prefs = { ...fullPrefs, excluded_companies: ['TechCorp'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBe(0);
      expect(result.matched).toBe(false);
      expect(result.reason).toBe('Company excluded');
    });

    it('excluded company check is case insensitive', () => {
      const prefs = { ...fullPrefs, excluded_companies: ['techcorp'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBe(0);
    });

    it('gives partial score when role does not match', () => {
      const prefs = { ...fullPrefs, target_roles: ['Designer'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBeLessThan(100);
    });

    it('gives neutral score when no role preference set', () => {
      const prefs = { ...fullPrefs, target_roles: [] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBeGreaterThan(0);
      expect(result.matched).toBe(true);
    });

    it('gives neutral score when target_roles is undefined', () => {
      const prefs = { ...fullPrefs };
      delete prefs.target_roles;
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBeGreaterThan(0);
    });

    it('matches role as substring', () => {
      const prefs = { ...fullPrefs, target_roles: ['Engineer'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBe(100);
    });

    it('role matching is case insensitive', () => {
      const prefs = { ...fullPrefs, target_roles: ['software engineer'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBe(100);
    });

    it('matches location as substring', () => {
      const prefs = { ...fullPrefs, target_locations: ['San Francisco'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.matched).toBe(true);
    });

    it('treats remote as special location', () => {
      const remoteJob = { ...baseJob, location: 'Remote' };
      const prefs = { ...fullPrefs, target_locations: ['remote'] };
      const result = calculateMatchScore(remoteJob, prefs);
      expect(result.matched).toBe(true);
    });

    it('gives neutral score when no location preference', () => {
      const prefs = { ...fullPrefs, target_locations: [] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.matched).toBe(true);
    });

    it('handles null job location', () => {
      const job = { ...baseJob, location: null };
      const result = calculateMatchScore(job, fullPrefs);
      expect(result).toBeDefined();
    });

    it('matches salary range correctly', () => {
      const prefs = { ...fullPrefs, min_salary: 90000, max_salary: 160000 };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.matched).toBe(true);
    });

    it('fails salary when job max below pref min', () => {
      const job = { ...baseJob, salary_max: 50000 };
      const prefs = { ...fullPrefs, min_salary: 80000 };
      const result = calculateMatchScore(job, prefs);
      expect(result.score).toBeLessThan(100);
    });

    it('gives neutral score when no salary preference', () => {
      const prefs = { ...fullPrefs };
      delete prefs.min_salary;
      delete prefs.max_salary;
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.matched).toBe(true);
    });

    it('handles missing salary on job', () => {
      const job = { ...baseJob };
      delete job.salary_min;
      delete job.salary_max;
      const prefs = { ...fullPrefs, min_salary: 100000 };
      const result = calculateMatchScore(job, prefs);
      expect(result).toBeDefined();
    });

    it('matches experience level', () => {
      const prefs = { ...fullPrefs, experience_level: ['mid'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBe(100);
    });

    it('fails experience level mismatch', () => {
      const prefs = { ...fullPrefs, experience_level: ['senior'] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.score).toBeLessThan(100);
    });

    it('gives neutral score when no experience preference', () => {
      const prefs = { ...fullPrefs, experience_level: [] };
      const result = calculateMatchScore(baseJob, prefs);
      expect(result.matched).toBe(true);
    });

    it('handles missing job_level on job', () => {
      const job = { ...baseJob };
      delete job.job_level;
      const result = calculateMatchScore(job, fullPrefs);
      expect(result).toBeDefined();
    });

    it('returns matched=false when score below 50', () => {
      const job = { ...baseJob, title: 'Chef', location: 'Paris', salary_max: 10000, job_level: 'executive' };
      const prefs = {
        target_roles: ['Engineer'],
        target_locations: ['NYC'],
        min_salary: 100000,
        experience_level: ['entry'],
      };
      const result = calculateMatchScore(job, prefs);
      expect(result.matched).toBe(false);
      expect(result.reason).toBe('Below threshold');
    });

    it('normalizedScore is a whole number', () => {
      const result = calculateMatchScore(baseJob, fullPrefs);
      expect(result.score).toBe(Math.round(result.score));
    });

    it('maxScore is always 100 in result', () => {
      const result = calculateMatchScore(baseJob, fullPrefs);
      expect(result.maxScore).toBe(100);
    });

    it('handles empty preferences object', () => {
      const result = calculateMatchScore(baseJob, {});
      expect(result).toBeDefined();
      expect(result.matched).toBe(true); // neutral scores
    });
  });

  describe('matchJobsForUser', () => {
    const prefs = {
      target_roles: ['Software Engineer'],
      target_locations: ['San Francisco'],
      min_salary: 80000,
      max_salary: 200000,
      experience_level: ['mid'],
    };

    it('returns matching jobs sorted by score descending', () => {
      const jobs = [
        { title: 'Chef', company: 'Restaurant', location: 'Paris', salary_min: 30000, salary_max: 40000, job_level: 'entry' },
        { title: 'Software Engineer', company: 'Acme', location: 'San Francisco, CA', salary_min: 100000, salary_max: 150000, job_level: 'mid' },
      ];
      const results = matchJobsForUser(jobs, prefs);
      expect(results.length).toBeGreaterThanOrEqual(1);
      // If multiple results, verify descending score order
      const hasMultipleResults = results.length > 1;
      expect(
        !hasMultipleResults || results[0].match.score >= results[1].match.score
      ).toBe(true);
    });

    it('filters out non-matching jobs', () => {
      const jobs = [
        { title: 'Chef', company: 'Restaurant', location: 'Paris', salary_min: 10000, salary_max: 20000, job_level: 'executive' },
      ];
      const prefs2 = {
        target_roles: ['Engineer'],
        target_locations: ['NYC'],
        min_salary: 100000,
        experience_level: ['mid'],
      };
      const results = matchJobsForUser(jobs, prefs2);
      expect(results).toHaveLength(0);
    });

    it('returns each result with job and match properties', () => {
      const jobs = [
        { title: 'Software Engineer', company: 'Acme', location: 'San Francisco', salary_min: 100000, salary_max: 150000, job_level: 'mid' },
      ];
      const results = matchJobsForUser(jobs, prefs);
      expect(results[0]).toHaveProperty('job');
      expect(results[0]).toHaveProperty('match');
      expect(results[0].match).toHaveProperty('score');
      expect(results[0].match).toHaveProperty('matched');
    });

    it('handles empty jobs array', () => {
      expect(matchJobsForUser([], prefs)).toHaveLength(0);
    });

    it('filters excluded companies', () => {
      const jobs = [
        { title: 'Software Engineer', company: 'BadCo', location: 'San Francisco', salary_min: 100000, salary_max: 150000, job_level: 'mid' },
      ];
      const prefsWithExclusion = { ...prefs, excluded_companies: ['BadCo'] };
      const results = matchJobsForUser(jobs, prefsWithExclusion);
      expect(results).toHaveLength(0);
    });

    it('handles large number of jobs', () => {
      const jobs = Array.from({ length: 500 }, (_, i) => ({
        title: `Software Engineer ${i}`,
        company: `Company ${i}`,
        location: 'San Francisco, CA',
        salary_min: 100000,
        salary_max: 150000,
        job_level: 'mid',
      }));
      const start = Date.now();
      const results = matchJobsForUser(jobs, prefs);
      expect(Date.now() - start).toBeLessThan(5000);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
