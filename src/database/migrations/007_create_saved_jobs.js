module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE saved_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        notes TEXT DEFAULT '',
        custom_resume_id UUID DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'skipped')),
        priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
        saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (user_id, job_id)
      );

      CREATE INDEX idx_saved_jobs_user_id ON saved_jobs(user_id);
      CREATE INDEX idx_saved_jobs_job_id ON saved_jobs(job_id);
      CREATE INDEX idx_saved_jobs_user_status ON saved_jobs(user_id, status);
      CREATE INDEX idx_saved_jobs_user_priority ON saved_jobs(user_id, priority);
      CREATE INDEX idx_saved_jobs_saved_at ON saved_jobs(saved_at);
    `);
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS saved_jobs CASCADE;
    `);
  },
};
