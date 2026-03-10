jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../src/database/models/Application', () => ({
  findById: jest.fn(),
  findByUserId: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../../../../src/database/models/ApplicationLog', () => ({
  create: jest.fn(),
  findByApplicationId: jest.fn(),
}));

jest.mock('../../../../src/automation/applicationSubmitter', () => ({
  submitApplication: jest.fn(),
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
      INVALID_INPUT: { code: 'INVALID_INPUT', status: 400 },
    },
  };
});

const { listApplications, getApplication, applyToJob, updateApplicationStatus } = require('../../../../src/api/controllers/applicationController');
const Application = require('../../../../src/database/models/Application');
const ApplicationLog = require('../../../../src/database/models/ApplicationLog');
const { submitApplication } = require('../../../../src/automation/applicationSubmitter');

describe('applicationController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {}, params: {}, body: {}, user: { id: 'user-1' } };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('listApplications', () => {
    it('returns paginated applications for user', async () => {
      Application.findByUserId.mockResolvedValue({
        applications: [{ id: '1' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      await listApplications(req, res, next);
      expect(Application.findByUserId).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', code: 200 })
      );
    });

    it('passes status filter', async () => {
      req.query = { status: 'submitted' };
      Application.findByUserId.mockResolvedValue({
        applications: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await listApplications(req, res, next);
      expect(Application.findByUserId).toHaveBeenCalledWith('user-1', expect.objectContaining({
        status: 'submitted',
      }));
    });

    it('defaults page and limit', async () => {
      Application.findByUserId.mockResolvedValue({
        applications: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await listApplications(req, res, next);
      expect(Application.findByUserId).toHaveBeenCalledWith('user-1', expect.objectContaining({
        page: 1,
        limit: 20,
      }));
    });

    it('caps limit at 100', async () => {
      req.query = { limit: '500' };
      Application.findByUserId.mockResolvedValue({
        applications: [],
        total: 0,
        page: 1,
        limit: 100,
      });

      await listApplications(req, res, next);
      expect(Application.findByUserId).toHaveBeenCalledWith('user-1', expect.objectContaining({
        limit: 100,
      }));
    });

    it('includes pagination meta', async () => {
      Application.findByUserId.mockResolvedValue({
        applications: [],
        total: 50,
        page: 1,
        limit: 20,
      });

      await listApplications(req, res, next);
      const response = res.json.mock.calls[0][0];
      expect(response.meta.total).toBe(50);
      expect(response.meta.totalPages).toBe(3);
    });

    it('calls next on error', async () => {
      Application.findByUserId.mockRejectedValue(new Error('db error'));

      await listApplications(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getApplication', () => {
    it('returns application with logs', async () => {
      req.params = { id: 'app-1' };
      Application.findById.mockResolvedValue({ id: 'app-1', user_id: 'user-1' });
      ApplicationLog.findByApplicationId.mockResolvedValue([{ action: 'created' }]);

      await getApplication(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({ logs: expect.any(Array) }),
        })
      );
    });

    it('calls next with NOT_FOUND when application does not exist', async () => {
      req.params = { id: 'nonexistent' };
      Application.findById.mockResolvedValue(null);

      await getApplication(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('calls next with NOT_FOUND when application belongs to another user', async () => {
      req.params = { id: 'app-1' };
      Application.findById.mockResolvedValue({ id: 'app-1', user_id: 'other-user' });

      await getApplication(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('calls next on error', async () => {
      req.params = { id: 'app-1' };
      Application.findById.mockRejectedValue(new Error('db error'));

      await getApplication(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('applyToJob', () => {
    it('submits application and returns 201', async () => {
      req.params = { id: 'job-1' };
      req.body = { resumeVersion: 2 };
      submitApplication.mockResolvedValue({ id: 'app-1', status: 'submitted' });

      await applyToJob(req, res, next);
      expect(submitApplication).toHaveBeenCalledWith('user-1', 'job-1', 2);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', code: 201 })
      );
    });

    it('defaults resumeVersion to 1', async () => {
      req.params = { id: 'job-1' };
      req.body = {};
      submitApplication.mockResolvedValue({ id: 'app-1' });

      await applyToJob(req, res, next);
      expect(submitApplication).toHaveBeenCalledWith('user-1', 'job-1', 1);
    });

    it('calls next on submission error', async () => {
      req.params = { id: 'job-1' };
      submitApplication.mockRejectedValue(new Error('limit reached'));

      await applyToJob(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateApplicationStatus', () => {
    it('updates status successfully', async () => {
      req.params = { id: 'app-1' };
      req.body = { status: 'submitted' };
      Application.findById.mockResolvedValue({ id: 'app-1', user_id: 'user-1', status: 'pending' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'submitted' });
      ApplicationLog.create.mockResolvedValue({});

      await updateApplicationStatus(req, res, next);
      expect(Application.updateStatus).toHaveBeenCalledWith('app-1', 'submitted');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      );
    });

    it('logs status change', async () => {
      req.params = { id: 'app-1' };
      req.body = { status: 'viewed' };
      Application.findById.mockResolvedValue({ id: 'app-1', user_id: 'user-1', status: 'submitted' });
      Application.updateStatus.mockResolvedValue({ id: 'app-1', status: 'viewed' });
      ApplicationLog.create.mockResolvedValue({});

      await updateApplicationStatus(req, res, next);
      expect(ApplicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'status_changed',
          details: { from: 'submitted', to: 'viewed' },
        })
      );
    });

    it('rejects invalid status', async () => {
      req.params = { id: 'app-1' };
      req.body = { status: 'invalid_status' };

      await updateApplicationStatus(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_INPUT' })
      );
    });

    it('accepts all valid statuses', async () => {
      const validStatuses = ['pending', 'submitted', 'viewed', 'rejected', 'archived'];
      for (const status of validStatuses) {
        jest.clearAllMocks();
        req.params = { id: 'app-1' };
        req.body = { status };
        Application.findById.mockResolvedValue({ id: 'app-1', user_id: 'user-1', status: 'pending' });
        Application.updateStatus.mockResolvedValue({ id: 'app-1', status });
        ApplicationLog.create.mockResolvedValue({});

        await updateApplicationStatus(req, res, next);
        expect(next).not.toHaveBeenCalled();
      }
    });

    it('returns NOT_FOUND when application not found', async () => {
      req.params = { id: 'nonexistent' };
      req.body = { status: 'submitted' };
      Application.findById.mockResolvedValue(null);

      await updateApplicationStatus(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('returns NOT_FOUND when app belongs to another user', async () => {
      req.params = { id: 'app-1' };
      req.body = { status: 'submitted' };
      Application.findById.mockResolvedValue({ id: 'app-1', user_id: 'other-user' });

      await updateApplicationStatus(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });
});
