module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE application_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_application_logs_application_id ON application_logs(application_id);
      CREATE INDEX idx_application_logs_created_at ON application_logs(created_at);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS application_logs CASCADE');
  },
};
