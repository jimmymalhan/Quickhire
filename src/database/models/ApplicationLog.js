const { query } = require('../connection');

const ApplicationLog = {
  async findByApplicationId(applicationId) {
    const result = await query(
      'SELECT * FROM application_logs WHERE application_id = $1 ORDER BY created_at DESC',
      [applicationId],
    );
    return result.rows;
  },

  async create({ applicationId, action, details = {} }) {
    const result = await query(
      `INSERT INTO application_logs (application_id, action, details)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [applicationId, action, JSON.stringify(details)],
    );
    return result.rows[0];
  },
};

module.exports = ApplicationLog;
