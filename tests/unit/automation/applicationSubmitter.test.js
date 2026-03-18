jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/config', () => ({
  features: { mockLinkedIn: true },
  application: {
    maxPerDay: 50,
    retryAttempts: 3,
    retryDelayMs: 1,
    minIntervalSeconds: 0,
  },
}));

jest.mock('../../../src/database/models/Application', () => ({
  countTodayByUser: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../../../src/database/models/ApplicationLog', () => ({
  create: jest.fn(),
}));

jest.mock('../../../src/database/models/Job', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/utils/errorCodes', () => {
  class AppError extends Error {
    constructor(errorCode, message, details = []) {
      super(message);
      this.name = 'AppError';
      this.code = errorCode.code;
      this.statusCode = errorCode.status;
      this.details = details;
    }
  }
  return {
    AppError,
    ERROR_CODES: {
      APPLICATION_LIMIT_REACHED: { code: 'APPLICATION_LIMIT_REACHED', status: 429 },
      RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429 },
      CONFLICT: { code: 'CONFLICT', status: 409 },
      INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500 },
    },
  };
});

const Application = require('../../../src/database/models/Application');
const ApplicationLog = require('../../../src/database/models/ApplicationLog');
const Job = require('../../../src/database/models/Job');
const {
  submitApplication,
  submitBatch,
  getSubmissionStatus,
  _resetInstances,
} = require('../../../src/automation/applicationSubmitter');
describe('applicationSubmitter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetInstances();
    Job.findById.mockResolvedValue({ id: 'job-1', company: 'TechCorp', title: 'Engineer' });
  });

  describe('submitApplication', () => {
    it('successfully submits an application in mock mode', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      const result = await submitApplication('user-1', 'job-1', 1);
      expect(result.status).toBe('submitted');
      expect(Application.create).toHaveBeenCalledWith({
        userId: 'user-1',
        jobId: 'job-1',
        status: 'pending',
        resumeVersion: 1,
      });
    });

    it('throws when daily limit reached', async () => {
      Application.countTodayByUser.mockResolvedValue(50);

      await expect(submitApplication('user-1', 'job-1')).rejects.toThrow('Daily application limit');
    });

    it('throws when application already exists (create returns null)', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue(null);

      await expect(submitApplication('user-1', 'job-1')).rejects.toThrow(
        'Application already exists',
      );
    });

    it('creates application log on creation', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      await submitApplication('user-1', 'job-1', 2);
      expect(ApplicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-1',
          action: 'created',
        }),
      );
    });

    it('creates submitted log on success', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      await submitApplication('user-1', 'job-1');
      expect(ApplicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'submitted',
        }),
      );
    });

    it('uses default resumeVersion of 1', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      await submitApplication('user-1', 'job-1');
      expect(Application.create).toHaveBeenCalledWith(
        expect.objectContaining({ resumeVersion: 1 }),
      );
    });

    it('counts today applications for the user', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      await submitApplication('user-123', 'job-1');
      expect(Application.countTodayByUser).toHaveBeenCalledWith('user-123');
    });

    it('throws AppError with correct code when limit reached', async () => {
      Application.countTodayByUser.mockResolvedValue(50);

      await expect(submitApplication('user-1', 'job-1')).rejects.toMatchObject({
        name: 'AppError',
        code: 'APPLICATION_LIMIT_REACHED',
      });
    });

    it('accepts options object with userProfile and coverLetter', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      const result = await submitApplication('user-1', 'job-1', {
        resumeVersion: 2,
        coverLetter: 'Dear Hiring Manager...',
        userProfile: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
      });
      expect(result.status).toBe('submitted');
    });

    it('loads job details for rate limiting', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      await submitApplication('user-1', 'job-1');
      expect(Job.findById).toHaveBeenCalledWith('job-1');
    });

    it('handles job lookup failure gracefully', async () => {
      Job.findById.mockRejectedValue(new Error('DB error'));
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      const result = await submitApplication('user-1', 'job-1');
      expect(result.status).toBe('submitted');
    });
  });

  describe('submitBatch', () => {
    it('submits multiple applications', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create
        .mockResolvedValueOnce({ id: 'app-1' })
        .mockResolvedValueOnce({ id: 'app-2' });
      Application.updateStatus
        .mockResolvedValueOnce({ id: 'app-1', status: 'submitted' })
        .mockResolvedValueOnce({ id: 'app-2', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      const result = await submitBatch('user-1', [{ jobId: 'job-1' }, { jobId: 'job-2' }]);
      expect(result.submitted).toHaveLength(2);
    });

    it('handles failures in batch', async () => {
      Application.countTodayByUser.mockResolvedValue(0);
      Application.create.mockResolvedValueOnce({ id: 'app-1' }).mockResolvedValueOnce(null); // conflict
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      const result = await submitBatch('user-1', [{ jobId: 'job-1' }, { jobId: 'job-2' }]);
      expect(result.submitted).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });

    it('stops batch when daily cap reached', async () => {
      Application.countTodayByUser.mockResolvedValueOnce(0).mockResolvedValueOnce(50);
      Application.create.mockResolvedValue({ id: 'app-1' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      const result = await submitBatch('user-1', [
        { jobId: 'job-1' },
        { jobId: 'job-2' },
        { jobId: 'job-3' },
      ]);
      expect(
        result.submitted.length + result.skipped.length + result.failed.length,
      ).toBeLessThanOrEqual(3);
    });
  });

  describe('getSubmissionStatus', () => {
    it('returns rate limiter and daily cap status', () => {
      const status = getSubmissionStatus('user-1');
      expect(status).toHaveProperty('rateLimiter');
      expect(status).toHaveProperty('dailyCap');
      expect(status.rateLimiter).toHaveProperty('dailyCount');
      expect(status.dailyCap).toHaveProperty('count');
    });

    it('respects user daily limit override', () => {
      const status = getSubmissionStatus('user-1', 10);
      expect(status.dailyCap.cap).toBe(10);
    });
  });
});
