const { query } = require('../connection');

const User = {
  async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  },

  async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [
      email,
    ]);
    return result.rows[0] || null;
  },

  async findByLinkedInId(linkedinId) {
    const result = await query(
      'SELECT * FROM users WHERE linkedin_id = $1 AND deleted_at IS NULL',
      [linkedinId],
    );
    return result.rows[0] || null;
  },

  async create({
    email,
    linkedinId,
    firstName,
    lastName,
    profilePicUrl,
    accessToken,
    refreshToken,
    tokenExpiresAt,
  }) {
    const result = await query(
      `INSERT INTO users (email, linkedin_id, first_name, last_name, profile_pic_url, access_token, refresh_token, token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        email,
        linkedinId,
        firstName,
        lastName,
        profilePicUrl,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      ],
    );
    return result.rows[0];
  },

  async update(id, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClauses = keys.map((key, i) => `${key} = $${i + 2}`);
    setClauses.push('updated_at = NOW()');

    const result = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, ...values],
    );
    return result.rows[0] || null;
  },

  async softDelete(id) {
    const result = await query(
      'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [id],
    );
    return result.rows[0] || null;
  },
};

module.exports = User;
