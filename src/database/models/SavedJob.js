const { query } = require('../connection');

const SavedJob = {
  async findById(id) {
    const result = await query(
      `SELECT sj.*, j.title as job_title, j.company as job_company, j.location as job_location,
              j.salary_min, j.salary_max, j.job_type, j.experience_level
       FROM saved_jobs sj
       JOIN jobs j ON sj.job_id = j.id
       WHERE sj.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findByUser(userId, { status, priority, page = 1, limit = 20 } = {}) {
    const params = [userId];
    let paramIndex = 2;
    const filters = [];

    if (status) {
      filters.push(`sj.status = $${paramIndex++}`);
      params.push(status);
    }

    if (priority) {
      filters.push(`sj.priority = $${paramIndex++}`);
      params.push(priority);
    }

    const whereClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const countResult = await query(
      `SELECT COUNT(*) FROM saved_jobs sj WHERE sj.user_id = $1 ${whereClause}`,
      params.slice(0, paramIndex - 1),
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT sj.*, j.title as job_title, j.company as job_company, j.location as job_location,
              j.salary_min, j.salary_max, j.job_type, j.experience_level
       FROM saved_jobs sj
       JOIN jobs j ON sj.job_id = j.id
       WHERE sj.user_id = $1 ${whereClause}
       ORDER BY
         CASE sj.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         sj.saved_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params,
    );

    return { savedJobs: result.rows, total, page, limit };
  },

  async save(userId, jobId, data = {}) {
    const { notes = '', customResumeId = null, priority = 'medium' } = data;
    const result = await query(
      `INSERT INTO saved_jobs (user_id, job_id, notes, custom_resume_id, priority)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, job_id) DO NOTHING
       RETURNING *`,
      [userId, jobId, notes, customResumeId, priority],
    );
    return result.rows[0] || null;
  },

  async update(id, userId, data) {
    const setClauses = [];
    const params = [id, userId];
    let paramIndex = 3;

    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(data.notes);
    }

    if (data.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      params.push(data.priority);
    }

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }

    if (data.customResumeId !== undefined) {
      setClauses.push(`custom_resume_id = $${paramIndex++}`);
      params.push(data.customResumeId);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');

    const result = await query(
      `UPDATE saved_jobs
       SET ${setClauses.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  },

  async remove(userId, jobId) {
    const result = await query(
      `DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2 RETURNING *`,
      [userId, jobId],
    );
    return result.rows[0] || null;
  },

  async removeById(id, userId) {
    const result = await query(
      `DELETE FROM saved_jobs WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    return result.rows[0] || null;
  },

  async markApplied(id, userId) {
    const result = await query(
      `UPDATE saved_jobs
       SET status = 'applied', applied_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId],
    );
    return result.rows[0] || null;
  },

  async getStats(userId) {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'saved') as saved_count,
         COUNT(*) FILTER (WHERE status = 'applied') as applied_count,
         COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
         COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
         COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority,
         COUNT(*) FILTER (WHERE priority = 'low') as low_priority
       FROM saved_jobs
       WHERE user_id = $1`,
      [userId],
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      byStatus: {
        saved: parseInt(row.saved_count, 10),
        applied: parseInt(row.applied_count, 10),
        skipped: parseInt(row.skipped_count, 10),
      },
      byPriority: {
        high: parseInt(row.high_priority, 10),
        medium: parseInt(row.medium_priority, 10),
        low: parseInt(row.low_priority, 10),
      },
    };
  },

  async findSavedForBulkApply(userId, { priority, limit = 50 } = {}) {
    const params = [userId];
    let paramIndex = 2;
    let priorityFilter = '';

    if (priority) {
      priorityFilter = `AND sj.priority = $${paramIndex++}`;
      params.push(priority);
    }

    params.push(limit);

    const result = await query(
      `SELECT sj.*, j.title as job_title, j.company as job_company, j.location as job_location
       FROM saved_jobs sj
       JOIN jobs j ON sj.job_id = j.id
       WHERE sj.user_id = $1 AND sj.status = 'saved' ${priorityFilter}
       ORDER BY
         CASE sj.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         sj.saved_at ASC
       LIMIT $${paramIndex}`,
      params,
    );

    return result.rows;
  },
};

module.exports = SavedJob;
