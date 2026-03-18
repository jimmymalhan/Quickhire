const { query } = require('../connection');

const CustomizedResume = {
  async findById(id) {
    const result = await query(
      `SELECT cr.*, r.name as resume_name, r.format as resume_format,
              j.title as job_title, j.company as job_company, j.location as job_location
       FROM customized_resumes cr
       JOIN resumes r ON cr.resume_id = r.id
       JOIN jobs j ON cr.job_id = j.id
       WHERE cr.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findByUserAndJob(userId, jobId) {
    const result = await query(
      `SELECT cr.*, r.name as resume_name, r.format as resume_format,
              j.title as job_title, j.company as job_company, j.location as job_location
       FROM customized_resumes cr
       JOIN resumes r ON cr.resume_id = r.id
       JOIN jobs j ON cr.job_id = j.id
       WHERE cr.user_id = $1 AND cr.job_id = $2
       ORDER BY cr.created_at DESC`,
      [userId, jobId],
    );
    return result.rows;
  },

  async findByUser(userId) {
    const result = await query(
      `SELECT cr.*, r.name as resume_name, r.format as resume_format,
              j.title as job_title, j.company as job_company, j.location as job_location
       FROM customized_resumes cr
       JOIN resumes r ON cr.resume_id = r.id
       JOIN jobs j ON cr.job_id = j.id
       WHERE cr.user_id = $1
       ORDER BY cr.created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async create(data) {
    const {
      resumeId,
      jobId,
      userId,
      customizedContent = {},
      coverLetter = '',
      fitScore = 0,
    } = data;

    const result = await query(
      `INSERT INTO customized_resumes (resume_id, job_id, user_id, customized_content, cover_letter, fit_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [resumeId, jobId, userId, JSON.stringify(customizedContent), coverLetter, fitScore],
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await query(
      'DELETE FROM customized_resumes WHERE id = $1 RETURNING *',
      [id],
    );
    return result.rows[0] || null;
  },
};

module.exports = CustomizedResume;
