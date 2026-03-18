module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE user_preferences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        auto_apply_enabled BOOLEAN DEFAULT true,
        target_roles TEXT[] DEFAULT '{}',
        target_locations TEXT[] DEFAULT '{}',
        min_salary INTEGER,
        max_salary INTEGER,
        experience_level VARCHAR[] DEFAULT '{}',
        excluded_companies TEXT[] DEFAULT '{}',
        apply_interval_minutes INTEGER DEFAULT 60,
        notification_enabled BOOLEAN DEFAULT true,
        email_notifications BOOLEAN DEFAULT true,
        push_notifications BOOLEAN DEFAULT false,
        daily_limit INTEGER DEFAULT 20,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS user_preferences CASCADE');
  },
};
