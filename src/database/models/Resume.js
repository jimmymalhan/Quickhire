const { query } = require('../connection');

const Resume = {
  async findById(id) {
    const result = await query('SELECT * FROM resumes WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByUser(userId) {
    const result = await query(
      'SELECT * FROM resumes WHERE user_id = $1 ORDER BY is_default DESC, updated_at DESC',
      [userId],
    );
    return result.rows;
  },

  async getDefault(userId) {
    const result = await query(
      'SELECT * FROM resumes WHERE user_id = $1 AND is_default = true LIMIT 1',
      [userId],
    );
    return result.rows[0] || null;
  },

  async create(userId, data) {
    const { name, content = {}, format = 'json', isDefault = false } = data;

    // If setting as default, unset any existing default first
    if (isDefault) {
      await query(
        'UPDATE resumes SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND is_default = true',
        [userId],
      );
    }

    const result = await query(
      `INSERT INTO resumes (user_id, name, content, format, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, JSON.stringify(content), format, isDefault],
    );
    return result.rows[0];
  },

  async update(id, data) {
    const setClauses = [];
    const params = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }

    if (data.content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      params.push(JSON.stringify(data.content));
    }

    if (data.format !== undefined) {
      setClauses.push(`format = $${paramIndex++}`);
      params.push(data.format);
    }

    if (data.isDefault !== undefined) {
      // If setting as default, unset any existing default first
      if (data.isDefault) {
        const existing = await this.findById(id);
        if (existing) {
          await query(
            'UPDATE resumes SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND is_default = true AND id != $2',
            [existing.user_id, id],
          );
        }
      }
      setClauses.push(`is_default = $${paramIndex++}`);
      params.push(data.isDefault);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');

    const result = await query(
      `UPDATE resumes
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await query('DELETE FROM resumes WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  },
};

module.exports = Resume;
