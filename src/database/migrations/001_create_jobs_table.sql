-- Migration: Create jobs table
-- Version: 001
-- Date: 2026-03-09

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_job_id VARCHAR(255) UNIQUE,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(500) NOT NULL,
  location VARCHAR(500),
  salary_min INTEGER,
  salary_max INTEGER,
  description TEXT,
  job_level VARCHAR(100),
  experience_years INTEGER,
  posted_at TIMESTAMP WITH TIME ZONE,
  scrape_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  url VARCHAR(2048),
  hash VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs (company);
CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs (location);
CREATE INDEX IF NOT EXISTS idx_jobs_hash ON jobs (hash);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_salary ON jobs (salary_min, salary_max) WHERE salary_min IS NOT NULL;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
