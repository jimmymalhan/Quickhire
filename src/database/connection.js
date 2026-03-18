/**
 * Database connection pool
 */
const { Pool } = require('pg');
const config = require('../utils/config');
const logger = require('../utils/logger');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });

    pool.on('connect', () => {
      logger.debug('New database connection established');
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function getClient() {
  return getPool().connect();
}

async function testConnection() {
  try {
    await query('SELECT 1');
    logger.info('Database connection established');
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    return false;
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, closePool };
Object.defineProperty(module.exports, 'pool', {
  enumerable: true,
  get: getPool,
});
module.exports.query = query;
module.exports.getClient = getClient;
module.exports.testConnection = testConnection;

// Initialize the shared pool eagerly so import-time expectations and
// pool event handlers are registered consistently across the app and tests.
getPool();
