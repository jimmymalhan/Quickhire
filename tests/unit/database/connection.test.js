/**
 * Unit tests for src/database/connection.js
 * Tests database connection module with mocked pg Pool.
 */

// Mock pg module before requiring
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

// Mock the logger to prevent real winston initialization
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock the config to avoid dotenv issues
jest.mock('../../../src/utils/config', () => ({
  db: {
    host: 'localhost',
    port: 5432,
    name: 'quickhire_test',
    user: 'postgres',
    password: 'test',
  },
  logging: {
    level: 'error',
    format: 'json',
    toFile: false,
    filePath: './logs',
  },
  env: 'test',
}));

describe('database - connection', () => {
  let connection;
  let pg;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    pg = require('pg');
    connection = require('../../../src/database/connection');
  });

  test('exports pool, query, getClient, and testConnection', () => {
    expect(connection.pool).toBeDefined();
    expect(connection.query).toBeDefined();
    expect(connection.getClient).toBeDefined();
    expect(connection.testConnection).toBeDefined();
    expect(typeof connection.query).toBe('function');
    expect(typeof connection.getClient).toBe('function');
    expect(typeof connection.testConnection).toBe('function');
  });

  test('creates Pool with correct config', () => {
    expect(pg.Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 5432,
        database: 'quickhire_test',
        user: 'postgres',
        password: 'test',
      })
    );
  });

  test('registers error handler on pool', () => {
    expect(connection.pool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

describe('database - query', () => {
  let connection;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    connection = require('../../../src/database/connection');
  });

  test('executes query with text and params', async () => {
    const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
    connection.pool.query.mockResolvedValue(mockResult);

    const result = await connection.query('SELECT * FROM users WHERE id = $1', ['uuid-1']);
    expect(result).toEqual(mockResult);
    expect(connection.pool.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1',
      ['uuid-1']
    );
  });

  test('executes query without params', async () => {
    const mockResult = { rows: [], rowCount: 0 };
    connection.pool.query.mockResolvedValue(mockResult);

    const result = await connection.query('SELECT 1');
    expect(result).toEqual(mockResult);
  });

  test('propagates query errors', async () => {
    connection.pool.query.mockRejectedValue(new Error('Query failed'));
    await expect(connection.query('BAD SQL')).rejects.toThrow('Query failed');
  });
});

describe('database - getClient', () => {
  let connection;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    connection = require('../../../src/database/connection');
  });

  test('returns a pool client', async () => {
    const mockClient = { query: jest.fn(), release: jest.fn() };
    connection.pool.connect.mockResolvedValue(mockClient);

    const client = await connection.getClient();
    expect(client).toBe(mockClient);
    expect(connection.pool.connect).toHaveBeenCalled();
  });

  test('propagates connection errors', async () => {
    connection.pool.connect.mockRejectedValue(new Error('Connection failed'));
    await expect(connection.getClient()).rejects.toThrow('Connection failed');
  });
});

describe('database - testConnection', () => {
  let connection;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    connection = require('../../../src/database/connection');
    logger = require('../../../src/utils/logger');
  });

  test('returns true on successful connection', async () => {
    connection.pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const result = await connection.testConnection();
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Database connection established');
  });

  test('returns false on connection failure', async () => {
    connection.pool.query.mockRejectedValue(new Error('Connection refused'));
    const result = await connection.testConnection();
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Database connection failed', {
      error: 'Connection refused',
    });
  });
});
