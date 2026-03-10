module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE scrape_stats (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        search_params JSONB DEFAULT '{}',
        total_scraped INTEGER NOT NULL DEFAULT 0,
        unique_count INTEGER NOT NULL DEFAULT 0,
        matched_count INTEGER NOT NULL DEFAULT 0,
        scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_scrape_stats_user_id ON scrape_stats(user_id);
      CREATE INDEX idx_scrape_stats_scraped_at ON scrape_stats(scraped_at);

      -- Add match_score column to applications for tracking match quality
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS match_score INTEGER;
    `);
  },

  async down(client) {
    await client.query(`
      ALTER TABLE applications DROP COLUMN IF EXISTS match_score;
      DROP TABLE IF EXISTS scrape_stats CASCADE;
    `);
  },
};
