const { query } = require('../../database/connection');
const logger = require('../../utils/logger');

const cleanup = async (_job) => {
  logger.info('Starting cleanup job');

  // Remove old application logs (older than 90 days)
  const logResult = await query(
    `DELETE FROM application_logs WHERE created_at < NOW() - INTERVAL '90 days'`,
  );
  logger.info(`Cleaned up ${logResult.rowCount} old application logs`);

  // Remove old scraped jobs without applications (older than 60 days)
  const jobResult = await query(
    `DELETE FROM jobs
     WHERE created_at < NOW() - INTERVAL '60 days'
       AND id NOT IN (SELECT DISTINCT job_id FROM applications)`,
  );
  logger.info(`Cleaned up ${jobResult.rowCount} old unused jobs`);

  return {
    logsRemoved: logResult.rowCount,
    jobsRemoved: jobResult.rowCount,
  };
};

module.exports = { cleanup };
