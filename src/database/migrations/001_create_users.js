module.exports = {
  async up(client) {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        linkedin_id VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        profile_pic_url VARCHAR(500),
        access_token VARCHAR(500),
        refresh_token VARCHAR(500),
        token_expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_linkedin_id ON users(linkedin_id);
      CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS users CASCADE');
  },
};
