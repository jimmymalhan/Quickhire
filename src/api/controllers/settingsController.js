const UserPreference = require('../../database/models/UserPreference');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');

const getSettings = async (req, res, next) => {
  try {
    const preferences = await UserPreference.findByUserId(req.user.id);
    if (!preferences) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Preferences not found');
    }

    res.json({
      status: 'success',
      code: 200,
      data: preferences,
    });
  } catch (err) {
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const updated = await UserPreference.createOrUpdate(req.user.id, {
      autoApplyEnabled: req.body.autoApplyEnabled,
      targetRoles: req.body.targetRoles,
      targetLocations: req.body.targetLocations,
      minSalary: req.body.minSalary,
      maxSalary: req.body.maxSalary,
      experienceLevel: req.body.experienceLevel,
      excludedCompanies: req.body.excludedCompanies,
      applyIntervalMinutes: req.body.applyIntervalMinutes,
      notificationEnabled: req.body.notificationEnabled,
      emailNotifications: req.body.emailNotifications,
      pushNotifications: req.body.pushNotifications,
      dailyLimit: req.body.dailyLimit,
    });

    res.json({
      status: 'success',
      code: 200,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

const getNotificationSettings = async (req, res, next) => {
  try {
    const preferences = await UserPreference.findByUserId(req.user.id);
    if (!preferences) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Preferences not found');
    }

    res.json({
      status: 'success',
      code: 200,
      data: {
        notificationEnabled: preferences.notification_enabled,
        emailNotifications: preferences.email_notifications,
        pushNotifications: preferences.push_notifications,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSettings, updateSettings, getNotificationSettings };
