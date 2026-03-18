module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        linkedin_job_id VARCHAR(255) UNIQUE,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        salary_min INTEGER,
        salary_max INTEGER,
        description TEXT,
        job_level VARCHAR(50),
        experience_years INTEGER,
        posted_at TIMESTAMP WITH TIME ZONE,
        scrape_date TIMESTAMP WITH TIME ZONE,
        url VARCHAR(1000),
        hash VARCHAR(64) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_jobs_company ON jobs(company);
      CREATE INDEX idx_jobs_title ON jobs(title);
      CREATE INDEX idx_jobs_location ON jobs(location);
      CREATE INDEX idx_jobs_posted_at ON jobs(posted_at);
      CREATE INDEX idx_jobs_hash ON jobs(hash);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS jobs CASCADE');
  },
};
