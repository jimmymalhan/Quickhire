/**
 * Job database model - handles all job CRUD operations
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { ScraperError } = require('../../utils/errorCodes');
const { query: dbQuery } = require('../connection');

class JobModel {
  constructor(pool = null) {
    this.pool = pool;
    this.tableName = 'jobs';
  }

  setPool(pool) {
    this.pool = pool;
  }

  async _query(text, params) {
    if (this.pool && typeof this.pool.query === 'function') {
      return this.pool.query(text, params);
    }
    return dbQuery(text, params);
  }

  /**
   * Insert a single job
   */
  async create(job) {
    const id = uuidv4();
    const query = `
      INSERT INTO ${this.tableName}
        (id, linkedin_job_id, title, company, location, salary_min, salary_max,
         description, job_level, experience_years, posted_at, scrape_date, url, hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (hash) DO NOTHING
      RETURNING *
    `;

    const values = [
      id, job.linkedinJobId, job.title, job.company, job.location,
      job.salaryMin, job.salaryMax, job.description, job.jobLevel,
      job.experienceYears, job.postedAt, new Date(), job.url, job.hash,
    ];

    try {
      const result = await this._query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      if (err.code === '23505') {
        // Duplicate - return existing
        logger.debug('Duplicate job, returning existing', { hash: job.hash });
        return this.findByHash(job.hash);
      }
      logger.error('Job insert failed', { error: err.message, hash: job.hash });
      throw new ScraperError('DB_INSERT_ERROR', { hash: job.hash }, err);
    }
  }

  async insert(job) {
    return this.create(job);
  }

  /**
   * Bulk insert jobs
   */
  async bulkCreate(jobs) {
    if (!jobs.length) {return [];}

    const results = [];
    for (const job of jobs) {
      const created = await this.create(job);
      if (created) {
        results.push(created);
      }
    }
    return results;
  }

  async bulkInsert(jobs) {
    if (!jobs.length) {return { inserted: 0, updated: 0, errors: 0 };}

    let inserted = 0;
    const updated = 0;
    let errors = 0;

    try {
      for (const job of jobs) {
        try {
          const created = await this.create(job);
          if (created) {
            inserted++;
          }
        } catch (err) {
          errors++;
          logger.warn('Bulk insert single job failed', { error: err.message, title: job.title });
        }
      }
    } catch (err) {
      throw new ScraperError('DB_INSERT_ERROR', { count: jobs.length }, err);
    }

    logger.info('Bulk insert complete', { inserted, updated, errors, total: jobs.length });
    return { inserted, updated, errors };
  }

  /**
   * Find job by hash
   */
  async findByHash(hash) {
    const result = await this._query(
      `SELECT * FROM ${this.tableName} WHERE hash = $1`, [hash]
    );
    return result.rows[0] || null;
  }

  /**
   * Find job by LinkedIn job ID
   */
  async findByLinkedInJobId(linkedinJobId) {
    const result = await this._query(
      `SELECT * FROM ${this.tableName} WHERE linkedin_job_id = $1`, [linkedinJobId]
    );
    return result.rows[0] || null;
  }

  async findByLinkedinId(linkedinJobId) {
    return this.findByLinkedInJobId(linkedinJobId);
  }

  async findById(id) {
    const result = await this._query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all existing hashes (for deduplication)
   */
  async getExistingHashes() {
    const result = await this._query(`SELECT hash FROM ${this.tableName}`);
    return result.rows.map(r => r.hash);
  }

  /**
   * Search jobs with filters
   */
  async search(filters = {}) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.title) {
      conditions.push(`title ILIKE $${paramIndex++}`);
      values.push(`%${filters.title}%`);
    }

    if (filters.company) {
      conditions.push(`company ILIKE $${paramIndex++}`);
      values.push(`%${filters.company}%`);
    }

    if (filters.location) {
      conditions.push(`location ILIKE $${paramIndex++}`);
      values.push(`%${filters.location}%`);
    }

    if (filters.salaryMin) {
      conditions.push(`salary_max >= $${paramIndex++}`);
      values.push(filters.salaryMin);
    }

    if (filters.salaryMax) {
      conditions.push(`salary_min <= $${paramIndex++}`);
      values.push(filters.salaryMax);
    }

    if (filters.jobLevel) {
      conditions.push(`job_level = $${paramIndex++}`);
      values.push(filters.jobLevel);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 20;
    const page = filters.page ?? 1;
    const offset = filters.offset ?? (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) FROM ${this.tableName}
      ${where}
    `;
    const countValues = [...values];
    const countResult = await this._query(countQuery, countValues);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const query = `
      SELECT * FROM ${this.tableName}
      ${where}
      ORDER BY posted_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    values.push(limit, offset);

    const result = await this._query(query, values);
    return {
      jobs: result.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Count jobs matching filters
   */
  async count(filters = {}) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.title) {
      conditions.push(`title ILIKE $${paramIndex++}`);
      values.push(`%${filters.title}%`);
    }
    if (filters.company) {
      conditions.push(`company ILIKE $${paramIndex++}`);
      values.push(`%${filters.company}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this._query(
      `SELECT COUNT(*) FROM ${this.tableName} ${where}`, values
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get recent jobs
   */
  async getRecent(limit = 20) {
    const result = await this._query(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    return result.rows;
  }

  /**
   * Delete old jobs
   */
  async deleteOlderThan(days) {
    const result = await this._query(
      `DELETE FROM ${this.tableName} WHERE created_at < NOW() - INTERVAL '${parseInt(days, 10)} days' RETURNING id`
    );
    return result.rowCount;
  }
}

module.exports = new JobModel();
module.exports.JobModel = JobModel;
