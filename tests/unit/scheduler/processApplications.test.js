const { processApplications, checkUserRateLimit, checkDailyLimit } = require('../../../src/scheduler/jobs/processApplications');

jest.mock('../../../src/database/connection');
jest.mock('../../../src/automation/applicationSubmitter');
jest.mock('../../../src/database/models/ApplicationLog');
jest.mock('../../../src/database/models/UserPreference');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/config', () => ({
  application: { maxPerDay: 50, retryAttempts: 3, retryDelayMs: 100, minIntervalSeconds: 60 },
  features: { mockLinkedIn: true },
}));

const { query } = require('../../../src/database/connection');
const { submitApplication } = require('../../../src/automation/applicationSubmitter');
const UserPreference = require('../../../src/database/models/UserPreference');

describe('processApplications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processApplications', () => {
    it('should process pending applications', async () => {
      const pendingApps = [
        { id: 'app-1', user_id: 'user-1', job_id: 'job-1', resume_version: 1 },
        { id: 'app-2', user_id: 'user-2', job_id: 'job-2', resume_version: 1 },
      ];

      query.mockResolvedValueOnce({ rows: pendingApps });
      UserPreference.findByUserId.mockResolvedValue(null);
      query.mockResolvedValue({ rows: [{ count: '0' }] });
      submitApplication.mockResolvedValue({ id: 'app-1', status: 'submitted' });

      const result = await processApplications({});

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
    });

    it('should handle submission failures gracefully', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'app-1', user_id: 'user-1', job_id: 'job-1', resume_version: 1 }],
      });
      UserPreference.findByUserId.mockResolvedValue(null);
      query.mockResolvedValue({ rows: [{ count: '0' }] });
      submitApplication.mockRejectedValue(new Error('Submission failed'));

      const result = await processApplications({});

      expect(result.failed).toBe(1);
      expect(result.processed).toBe(0);
    });

    it('should handle empty queue', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await processApplications({});

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(0);
      expect(submitApplication).not.toHaveBeenCalled();
    });

    it('should skip rate-limited users', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'app-1', user_id: 'user-1', job_id: 'job-1', resume_version: 1 }],
      });
      UserPreference.findByUserId.mockResolvedValueOnce({ apply_interval_minutes: 30 });
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await processApplications({});

      expect(result.skippedRateLimit).toBe(1);
      expect(result.processed).toBe(0);
      expect(submitApplication).not.toHaveBeenCalled();
    });

    it('should skip users at daily limit', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'app-1', user_id: 'user-1', job_id: 'job-1', resume_version: 1 }],
      });
      UserPreference.findByUserId.mockResolvedValueOnce(null);
      UserPreference.findByUserId.mockResolvedValueOnce({ daily_limit: 5 });
      query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await processApplications({});

      expect(result.skippedRateLimit).toBe(1);
      expect(result.processed).toBe(0);
    });
  });

  describe('checkUserRateLimit', () => {
    it('should return true when no preferences set', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);
      expect(await checkUserRateLimit('user-1')).toBe(true);
    });

    it('should return true when no interval configured', async () => {
      UserPreference.findByUserId.mockResolvedValue({});
      expect(await checkUserRateLimit('user-1')).toBe(true);
    });

    it('should return true when no recent submissions', async () => {
      UserPreference.findByUserId.mockResolvedValue({ apply_interval_minutes: 30 });
      query.mockResolvedValue({ rows: [{ count: '0' }] });
      expect(await checkUserRateLimit('user-1')).toBe(true);
    });

    it('should return false when rate limited', async () => {
      UserPreference.findByUserId.mockResolvedValue({ apply_interval_minutes: 30 });
      query.mockResolvedValue({ rows: [{ count: '1' }] });
      expect(await checkUserRateLimit('user-1')).toBe(false);
    });
  });

  describe('checkDailyLimit', () => {
    it('should return true when under limit', async () => {
      UserPreference.findByUserId.mockResolvedValue({ daily_limit: 50 });
      query.mockResolvedValue({ rows: [{ count: '10' }] });
      expect(await checkDailyLimit('user-1')).toBe(true);
    });

    it('should return false when at limit', async () => {
      UserPreference.findByUserId.mockResolvedValue({ daily_limit: 10 });
      query.mockResolvedValue({ rows: [{ count: '10' }] });
      expect(await checkDailyLimit('user-1')).toBe(false);
    });

    it('should use default limit when no preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);
      query.mockResolvedValue({ rows: [{ count: '49' }] });
      expect(await checkDailyLimit('user-1')).toBe(true);
    });

    it('should use default limit when daily_limit not set', async () => {
      UserPreference.findByUserId.mockResolvedValue({});
      query.mockResolvedValue({ rows: [{ count: '50' }] });
      expect(await checkDailyLimit('user-1')).toBe(false);
    });
  });
});
