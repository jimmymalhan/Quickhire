const { query } = require('../connection');

const Application = {
  async findById(id) {
    const result = await query(
      `SELECT a.*, j.title as job_title, j.company as job_company, j.location as job_location
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findByUserId(userId, { status, page = 1, limit = 20 } = {}) {
    const params = [userId];
    let paramIndex = 2;
    let statusFilter = '';

    if (status) {
      statusFilter = `AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const countResult = await query(
      `SELECT COUNT(*) FROM applications a WHERE a.user_id = $1 ${statusFilter}`,
      status ? [userId, status] : [userId],
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT a.*, j.title as job_title, j.company as job_company, j.location as job_location
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.user_id = $1 ${statusFilter}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params,
    );

    return { applications: result.rows, total, page, limit };
  },

  async create({ userId, jobId, status = 'pending', resumeVersion }) {
    const result = await query(
      `INSERT INTO applications (user_id, job_id, status, resume_version)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, job_id) DO NOTHING
       RETURNING *`,
      [userId, jobId, status, resumeVersion],
    );
    return result.rows[0] || null;
  },

  async updateStatus(id, status, errorMessage = null) {
    const result = await query(
      `UPDATE applications
       SET status = $2, error_message = $3, updated_at = NOW(),
           applied_at = CASE WHEN $2 = 'submitted' THEN NOW() ELSE applied_at END,
           submission_attempts = CASE WHEN $2 = 'submitted' THEN submission_attempts + 1 ELSE submission_attempts END,
           last_attempt_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, errorMessage],
    );
    return result.rows[0] || null;
  },

  async countTodayByUser(userId) {
    const result = await query(
      `SELECT COUNT(*) FROM applications
       WHERE user_id = $1 AND applied_at >= CURRENT_DATE AND status = 'submitted'`,
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = Application;
