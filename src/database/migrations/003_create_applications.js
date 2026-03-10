module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE applications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending', 'submitted', 'viewed', 'rejected', 'archived')),
        applied_at TIMESTAMP WITH TIME ZONE,
        response_received_at TIMESTAMP WITH TIME ZONE,
        submission_attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        resume_version INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, job_id)
      );

      CREATE INDEX idx_applications_user_status ON applications(user_id, status);
      CREATE INDEX idx_applications_applied_at ON applications(applied_at);
      CREATE INDEX idx_applications_job_id ON applications(job_id);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS applications CASCADE');
  },
};
