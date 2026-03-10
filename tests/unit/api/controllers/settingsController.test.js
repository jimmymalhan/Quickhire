jest.mock('../../../../src/database/models/UserPreference', () => ({
  findByUserId: jest.fn(),
  createOrUpdate: jest.fn(),
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

const { getSettings, updateSettings, getNotificationSettings } = require('../../../../src/api/controllers/settingsController');
const UserPreference = require('../../../../src/database/models/UserPreference');

describe('settingsController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 'user-1' }, body: {} };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('getSettings', () => {
    it('returns user preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue({ user_id: 'user-1', auto_apply_enabled: true });

      await getSettings(req, res, next);
      expect(UserPreference.findByUserId).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      );
    });

    it('calls next with NOT_FOUND when no preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);

      await getSettings(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('calls next on error', async () => {
      UserPreference.findByUserId.mockRejectedValue(new Error('db error'));

      await getSettings(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateSettings', () => {
    it('updates preferences successfully', async () => {
      req.body = {
        autoApplyEnabled: false,
        targetRoles: ['Engineer'],
        dailyLimit: 30,
      };
      UserPreference.createOrUpdate.mockResolvedValue({ user_id: 'user-1', auto_apply_enabled: false });

      await updateSettings(req, res, next);
      expect(UserPreference.createOrUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({
        autoApplyEnabled: false,
        targetRoles: ['Engineer'],
        dailyLimit: 30,
      }));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      );
    });

    it('handles partial updates', async () => {
      req.body = { notificationEnabled: true };
      UserPreference.createOrUpdate.mockResolvedValue({ notification_enabled: true });

      await updateSettings(req, res, next);
      expect(UserPreference.createOrUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({
        notificationEnabled: true,
      }));
    });

    it('calls next on error', async () => {
      UserPreference.createOrUpdate.mockRejectedValue(new Error('db error'));

      await updateSettings(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getNotificationSettings', () => {
    it('returns notification preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue({
        notification_enabled: true,
        email_notifications: true,
        push_notifications: false,
      });

      await getNotificationSettings(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            notificationEnabled: true,
            emailNotifications: true,
            pushNotifications: false,
          }),
        })
      );
    });

    it('calls next with NOT_FOUND when no preferences', async () => {
      UserPreference.findByUserId.mockResolvedValue(null);

      await getNotificationSettings(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });
  });
});
