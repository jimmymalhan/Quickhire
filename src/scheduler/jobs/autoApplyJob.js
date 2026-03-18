/**
 * Auto-Apply Scheduled Job
 * Picks up saved jobs for users with auto-apply enabled and processes them
 * through the AutoApplyOrchestrator.
 */
const { query } = require('../../database/connection');
const UserPreference = require('../../database/models/UserPreference');
const { AutoApplyOrchestrator } = require('../../automation/autoApplyOrchestrator');
const logger = require('../../utils/logger');
const config = require('../../utils/config');

/**
 * Main auto-apply job handler
 * Called by the Bull queue scheduler on a cron schedule
 * @param {Object} job - Bull job instance
 * @returns {Object} Summary of processing results
 */
const autoApplyJob = async (job = {}) => {
  const jobData = job.data || {};
  const { userId: specificUserId } = jobData;

  logger.info('Auto-apply job started', {
    specificUserId: specificUserId || 'all',
    timestamp: new Date().toISOString(),
  });

  try {
    // Get users with auto-apply enabled
    const users = await getEligibleUsers(specificUserId);

    if (users.length === 0) {
      logger.info('No eligible users for auto-apply');
      return { processed: 0, users: 0, results: [] };
    }

    const orchestrator = new AutoApplyOrchestrator({
      mockMode: config.features.mockLinkedIn,
    });

    const results = [];

    for (const user of users) {
      try {
        // Check if within user's schedule
        if (!isWithinSchedule(user.preferences)) {
          logger.debug('User outside auto-apply schedule', { userId: user.id });
          results.push({
            userId: user.id,
            status: 'skipped',
            reason: 'outside_schedule',
          });
          continue;
        }

        // Get saved jobs for user
        const savedJobs = await getSavedJobsForUser(user.id);
        if (savedJobs.length === 0) {
          results.push({
            userId: user.id,
            status: 'skipped',
            reason: 'no_saved_jobs',
          });
          continue;
        }

        // Process queue
        const result = await orchestrator.processQueue(user.id, savedJobs, {
          dailyLimit: user.preferences.daily_limit,
          userProfile: user.profile || {},
        });

        results.push({
          userId: user.id,
          status: 'completed',
          submitted: result.submitted.length,
          failed: result.failed.length,
          skipped: result.skipped.length,
        });

        logger.info('Auto-apply completed for user', {
          userId: user.id,
          submitted: result.submitted.length,
          failed: result.failed.length,
        });
      } catch (err) {
        logger.error('Auto-apply failed for user', {
          userId: user.id,
          error: err.message,
        });

        results.push({
          userId: user.id,
          status: 'error',
          error: err.message,
        });
      }
    }

    const summary = {
      processed: results.filter((r) => r.status === 'completed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      users: users.length,
      results,
    };

    logger.info('Auto-apply job completed', summary);
    return summary;
  } catch (err) {
    logger.error('Auto-apply job failed', { error: err.message });
    throw err;
  }
};

/**
 * Get users who have auto-apply enabled
 * @param {string} specificUserId - Optional: target a specific user
 * @returns {Array} Array of user objects with preferences
 */
const getEligibleUsers = async (specificUserId) => {
  let result;

  if (specificUserId) {
    const preferences = await UserPreference.findByUserId(specificUserId);
    if (!preferences || !preferences.auto_apply_enabled) {
      return [];
    }
    return [{ id: specificUserId, preferences }];
  }

  const result = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u
     JOIN user_preferences up ON u.id = up.user_id
     WHERE up.auto_apply_enabled = true`,
  );

  const users = [];
  for (const row of result.rows) {
    const preferences = await UserPreference.findByUserId(row.id);
    users.push({
      id: row.id,
      profile: {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
      },
      preferences: preferences || {},
    });
  }

  return users;
};

/**
 * Check if current time is within user's auto-apply schedule
 * @param {Object} preferences - User preferences
 * @returns {boolean}
 */
const isWithinSchedule = (preferences) => {
  if (!preferences) {return true;}

  const {
    auto_apply_start_hour,
    auto_apply_end_hour,
    auto_apply_days,
  } = preferences;

  // No schedule configured = always eligible
  if (auto_apply_start_hour === null && auto_apply_end_hour === null && !auto_apply_days) {
    return true;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0=Sun, 6=Sat

  // Check day-of-week
  if (auto_apply_days && Array.isArray(auto_apply_days)) {
    if (!auto_apply_days.includes(currentDay)) {
      return false;
    }
  }

  // Check hour range
  if (auto_apply_start_hour !== null && auto_apply_end_hour !== null) {
    if (currentHour < auto_apply_start_hour || currentHour >= auto_apply_end_hour) {
      return false;
    }
  }

  return true;
};

/**
 * Get saved jobs that are ready for auto-apply
 * @param {string} userId
 * @returns {Array}
 */
const getSavedJobsForUser = async (userId) => {
  const result = await query(
    `SELECT sj.*, j.title as job_title, j.company as job_company, j.location as job_location
     FROM saved_jobs sj
     JOIN jobs j ON sj.job_id = j.id
     WHERE sj.user_id = $1
       AND sj.status = 'saved'
       AND sj.auto_apply = true
     ORDER BY sj.priority ASC, sj.match_score DESC NULLS LAST
     LIMIT 50`,
    [userId],
  );

  return result.rows;
};

module.exports = {
  autoApplyJob,
  getEligibleUsers,
  isWithinSchedule,
  getSavedJobsForUser,
};
