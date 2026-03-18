module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE resumes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        format VARCHAR(20) NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'pdf', 'docx')),
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_resumes_user_id ON resumes(user_id);
      CREATE INDEX idx_resumes_user_default ON resumes(user_id, is_default);

      CREATE TABLE customized_resumes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customized_content JSONB NOT NULL DEFAULT '{}',
        cover_letter TEXT DEFAULT '',
        fit_score INTEGER DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_customized_resumes_user_id ON customized_resumes(user_id);
      CREATE INDEX idx_customized_resumes_resume_id ON customized_resumes(resume_id);
      CREATE INDEX idx_customized_resumes_job_id ON customized_resumes(job_id);
      CREATE INDEX idx_customized_resumes_user_job ON customized_resumes(user_id, job_id);
    `);
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS customized_resumes CASCADE;
      DROP TABLE IF EXISTS resumes CASCADE;
    `);
  },
};
