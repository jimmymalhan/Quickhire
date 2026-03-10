const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

const getAppliedMigrations = async (client) => {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY id');
  return result.rows.map((r) => r.filename);
};

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.js'))
      .sort();

    const pending = files.filter((f) => !applied.includes(f));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    for (const file of pending) {
      logger.info(`Running migration: ${file}`);
      const migration = require(path.join(MIGRATIONS_DIR, file));

      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info(`Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`Migration failed: ${file}`, { error: err.message });
        throw err;
      }
    }

    logger.info(`Applied ${pending.length} migration(s)`);
  } finally {
    client.release();
    await pool.end();
  }
};

const rollbackMigration = async () => {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    if (applied.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    const lastFile = applied[applied.length - 1];
    logger.info(`Rolling back migration: ${lastFile}`);

    const migration = require(path.join(MIGRATIONS_DIR, lastFile));

    await client.query('BEGIN');
    try {
      await migration.down(client);
      await client.query('DELETE FROM schema_migrations WHERE filename = $1', [lastFile]);
      await client.query('COMMIT');
      logger.info(`Rolled back: ${lastFile}`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`Rollback failed: ${lastFile}`, { error: err.message });
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
};

const command = process.argv[2];
if (command === 'rollback') {
  rollbackMigration().catch((err) => {
    logger.error('Rollback error', { error: err.message });
    process.exit(1);
  });
} else {
  runMigrations().catch((err) => {
    logger.error('Migration error', { error: err.message });
    process.exit(1);
  });
}
