const { query } = require('../../database/connection');
const { submitApplication } = require('../../automation/applicationSubmitter');
const ApplicationLog = require('../../database/models/ApplicationLog');
const UserPreference = require('../../database/models/UserPreference');
const logger = require('../../utils/logger');
const config = require('../../utils/config');

const processApplications = async (_job) => {
  logger.info('Processing pending applications');

  const result = await query(
    `SELECT a.id, a.user_id, a.job_id, a.resume_version
     FROM applications a
     WHERE a.status = 'pending' AND a.submission_attempts < 3
     ORDER BY a.created_at ASC
     LIMIT 50`,
  );

  let processed = 0;
  let failed = 0;
  let skippedRateLimit = 0;

  for (const app of result.rows) {
    try {
      // Check user's rate limit preference
      const rateLimitOk = await checkUserRateLimit(app.user_id);
      if (!rateLimitOk) {
        skippedRateLimit++;
        logger.debug('Skipped application due to rate limit', {
          applicationId: app.id,
          userId: app.user_id,
        });
        continue;
      }

      // Check daily limit from user preferences
      const dailyLimitOk = await checkDailyLimit(app.user_id);
      if (!dailyLimitOk) {
        skippedRateLimit++;
        logger.debug('Skipped application due to daily limit', {
          applicationId: app.id,
          userId: app.user_id,
        });
        continue;
      }

      await submitApplication(app.user_id, app.job_id, app.resume_version);
      processed++;
    } catch (err) {
      failed++;
      logger.warn('Failed to process application', {
        applicationId: app.id,
        error: err.message,
      });

      // Update submission attempt count
      await query(
        `UPDATE applications SET submission_attempts = submission_attempts + 1, last_attempt_at = NOW(), error_message = $2 WHERE id = $1`,
        [app.id, err.message],
      );
    }
  }

  logger.info('Application processing complete', { processed, failed, skippedRateLimit });
  return { processed, failed, skippedRateLimit, total: result.rows.length };
};

const checkUserRateLimit = async (userId) => {
  const preferences = await UserPreference.findByUserId(userId);
  if (!preferences || !preferences.apply_interval_minutes) {
    return true; // No rate limit configured
  }

  const intervalMinutes = preferences.apply_interval_minutes;
  const result = await query(
    `SELECT COUNT(*) FROM applications
     WHERE user_id = $1
       AND applied_at > NOW() - ($2 || ' minutes')::INTERVAL
       AND status = 'submitted'`,
    [userId, intervalMinutes],
  );

  return parseInt(result.rows[0].count, 10) === 0;
};

const checkDailyLimit = async (userId) => {
  const preferences = await UserPreference.findByUserId(userId);
  const dailyLimit = (preferences && preferences.daily_limit) || config.application.maxPerDay;

  const result = await query(
    `SELECT COUNT(*) FROM applications
     WHERE user_id = $1 AND applied_at >= CURRENT_DATE AND status = 'submitted'`,
    [userId],
  );

  return parseInt(result.rows[0].count, 10) < dailyLimit;
};

module.exports = { processApplications, checkUserRateLimit, checkDailyLimit };
