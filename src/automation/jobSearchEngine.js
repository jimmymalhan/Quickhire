/**
 * Job Search Engine
 * Enhanced search with recommendations, similar jobs, trending, and search history
 */
const logger = require('../utils/logger');
const config = require('../utils/config');
const { Cache } = require('../utils/cache');
const { calculateMatchScore, matchJobsForUser } = require('./jobMatcher');
const Job = require('../database/models/Job');
const UserPreference = require('../database/models/UserPreference');

class JobSearchEngine {
  constructor(options = {}) {
    this.cache = new Cache({
      maxSize: options.cacheMaxSize || 5000,
      defaultTtl: options.cacheTtl || 300000, // 5 min
    });
    this.searchHistoryStore = new Map(); // userId -> [{ query, filters, timestamp }]
    this.maxHistoryPerUser = options.maxHistoryPerUser || 100;
    this.mockMode = options.mockMode ?? config.features.mockLinkedIn ?? true;
  }

  /**
   * Full text search with filters
   * @param {string} query - Search query string
   * @param {Object} filters - Search filters
   * @param {string} [filters.location] - Location filter
   * @param {number} [filters.salaryMin] - Minimum salary
   * @param {number} [filters.salaryMax] - Maximum salary
   * @param {boolean} [filters.remote] - Remote only
   * @param {string} [filters.experience] - Experience level
   * @param {string} [filters.company] - Company name
   * @param {number} [filters.page] - Page number
   * @param {number} [filters.limit] - Results per page
   * @param {string} [filters.sortBy] - Sort field (relevance, date, salary)
   * @param {string} [filters.userId] - User ID for tracking search history
   * @returns {Object} Search results with pagination
   */
  async search(query, filters = {}) {
    const {
      location,
      salaryMin,
      salaryMax,
      remote,
      experience,
      company,
      page = 1,
      limit = 20,
      sortBy = 'relevance',
      userId,
    } = filters;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // Build cache key
    const cacheKey = `search:${JSON.stringify({ query, location, salaryMin, salaryMax, remote, experience, company, page: parsedPage, limit: parsedLimit, sortBy })}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Job search cache hit', { cacheKey });
      return cached;
    }

    logger.info('Executing job search', { query, filters: { location, salaryMin, salaryMax, remote, experience, company }, page: parsedPage });

    // Build search filters for the Job model
    const searchFilters = {
      page: parsedPage,
      limit: parsedLimit,
    };

    if (query) {
      searchFilters.title = query;
    }
    if (location) {
      searchFilters.location = location;
    }
    if (salaryMin) {
      searchFilters.salaryMin = parseInt(salaryMin, 10);
    }
    if (salaryMax) {
      searchFilters.salaryMax = parseInt(salaryMax, 10);
    }
    if (experience) {
      searchFilters.jobLevel = experience;
    }
    if (company) {
      searchFilters.company = company;
    }

    const result = await Job.search(searchFilters);
    let jobs = result.jobs;

    // Filter remote jobs if requested
    if (remote) {
      jobs = jobs.filter((job) => {
        const loc = (job.location || '').toLowerCase();
        return loc.includes('remote') || loc.includes('anywhere');
      });
    }

    // Sort results
    if (sortBy === 'date') {
      jobs.sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
    } else if (sortBy === 'salary') {
      jobs.sort((a, b) => (b.salary_max || 0) - (a.salary_max || 0));
    }
    // 'relevance' uses default DB ordering

    // Track search history
    if (userId) {
      this._addSearchHistory(userId, query, filters);
    }

    const response = {
      jobs,
      total: remote ? jobs.length : result.total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil((remote ? jobs.length : result.total) / parsedLimit),
      query,
      filters: { location, salaryMin, salaryMax, remote, experience, company, sortBy },
    };

    // Cache results
    await this.cache.set(cacheKey, response, 300000); // 5 min

    return response;
  }

  /**
   * AI-powered job recommendations based on user profile and history
   * Uses jobMatcher scoring internally
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @param {number} [options.page] - Page number
   * @param {number} [options.limit] - Results per page
   * @param {number} [options.minScore] - Minimum match score (0-100)
   * @returns {Object} Recommended jobs with match scores
   */
  async getRecommendations(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      minScore = 50,
    } = options;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const parsedMinScore = Math.max(0, Math.min(100, parseInt(minScore, 10) || 50));

    // Check cache
    const cacheKey = `recommendations:${userId}:${parsedPage}:${parsedLimit}:${parsedMinScore}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Recommendations cache hit', { userId });
      return cached;
    }

    // Get user preferences
    const preferences = await UserPreference.findByUserId(userId);
    if (!preferences) {
      return {
        jobs: [],
        total: 0,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: 0,
        minScore: parsedMinScore,
        message: 'Set up your preferences first to get recommendations',
      };
    }

    logger.info('Generating recommendations', { userId, minScore: parsedMinScore });

    // Get recent jobs pool
    const jobResult = await Job.search({ page: 1, limit: 200 });

    // Match against preferences using jobMatcher
    const matched = matchJobsForUser(jobResult.jobs, preferences)
      .filter((m) => m.match.score >= parsedMinScore);

    // Boost scores based on search history
    const history = this._getSearchHistory(userId);
    const boostedResults = this._boostByHistory(matched, history);

    // Paginate
    const total = boostedResults.length;
    const start = (parsedPage - 1) * parsedLimit;
    const paginated = boostedResults.slice(start, start + parsedLimit);

    const response = {
      jobs: paginated.map((m) => ({
        ...m.job,
        matchScore: m.match.score,
        matchReason: m.match.reason,
      })),
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
      minScore: parsedMinScore,
    };

    // Cache for 2 minutes (recommendations change frequently)
    await this.cache.set(cacheKey, response, 120000);

    return response;
  }

  /**
   * Find jobs similar to a given job
   * @param {string} jobId - Job ID to find similar jobs for
   * @param {Object} options - Options
   * @param {number} [options.limit] - Max results
   * @returns {Object} Similar jobs with similarity scores
   */
  async getSimilarJobs(jobId, options = {}) {
    const { limit = 10 } = options;
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    // Check cache
    const cacheKey = `similar:${jobId}:${parsedLimit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Similar jobs cache hit', { jobId });
      return cached;
    }

    // Get the reference job
    const referenceJob = await Job.findById(jobId);
    if (!referenceJob) {
      return null;
    }

    logger.info('Finding similar jobs', { jobId, title: referenceJob.title });

    // Build pseudo-preferences from the reference job to reuse jobMatcher
    const pseudoPreferences = {
      target_roles: [referenceJob.title],
      target_locations: referenceJob.location ? [referenceJob.location] : [],
      min_salary: referenceJob.salary_min || undefined,
      max_salary: referenceJob.salary_max || undefined,
      experience_level: referenceJob.job_level ? [referenceJob.job_level] : [],
      excluded_companies: [],
    };

    // Get candidate pool
    const jobResult = await Job.search({ page: 1, limit: 200 });

    // Filter out the reference job and score similarity
    const candidates = jobResult.jobs.filter((j) => j.id !== jobId);
    const scored = candidates
      .map((job) => ({
        job,
        similarity: calculateMatchScore(job, pseudoPreferences),
      }))
      .filter((r) => r.similarity.score > 30)
      .sort((a, b) => b.similarity.score - a.similarity.score)
      .slice(0, parsedLimit);

    const response = {
      referenceJob: {
        id: referenceJob.id,
        title: referenceJob.title,
        company: referenceJob.company,
        location: referenceJob.location,
      },
      similarJobs: scored.map((s) => ({
        ...s.job,
        similarityScore: s.similarity.score,
      })),
      total: scored.length,
    };

    // Cache for 10 minutes (similar jobs don't change frequently)
    await this.cache.set(cacheKey, response, 600000);

    return response;
  }

  /**
   * Get trending/popular jobs by location
   * @param {string} [location] - Location filter (optional)
   * @param {Object} options - Options
   * @param {number} [options.limit] - Max results
   * @param {number} [options.days] - Look back period in days
   * @returns {Object} Trending jobs
   */
  async getTrendingJobs(location, options = {}) {
    const { limit = 20, days = 7 } = options;
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    // Check cache
    const cacheKey = `trending:${location || 'all'}:${parsedLimit}:${days}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Trending jobs cache hit', { location });
      return cached;
    }

    logger.info('Getting trending jobs', { location, limit: parsedLimit, days });

    const searchFilters = {
      page: 1,
      limit: 200, // Get a pool to rank
    };
    if (location) {
      searchFilters.location = location;
    }

    const jobResult = await Job.search(searchFilters);

    // Simulate trending by sorting by recency and salary (popular = well-paying + recent)
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const recentJobs = jobResult.jobs.filter((job) => {
      const postedAt = job.posted_at ? new Date(job.posted_at) : now;
      return postedAt >= cutoff;
    });

    // Score trending: recency (50%) + salary attractiveness (50%)
    const maxSalary = Math.max(...recentJobs.map((j) => j.salary_max || 0), 1);
    const scored = recentJobs
      .map((job) => {
        const postedAt = job.posted_at ? new Date(job.posted_at) : now;
        const ageMs = now - postedAt;
        const maxAgeMs = days * 24 * 60 * 60 * 1000;
        const recencyScore = Math.max(0, 1 - ageMs / maxAgeMs) * 50;
        const salaryScore = ((job.salary_max || 0) / maxSalary) * 50;
        return {
          job,
          trendingScore: Math.round(recencyScore + salaryScore),
        };
      })
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, parsedLimit);

    const response = {
      jobs: scored.map((s) => ({
        ...s.job,
        trendingScore: s.trendingScore,
      })),
      total: scored.length,
      location: location || 'all',
      period: `${days} days`,
    };

    // Cache for 15 minutes
    await this.cache.set(cacheKey, response, 900000);

    return response;
  }

  /**
   * Get user's search history
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @param {number} [options.limit] - Max entries
   * @returns {Object} Search history
   */
  async searchHistory(userId, options = {}) {
    const { limit = 50 } = options;
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const history = this._getSearchHistory(userId);
    const limited = history.slice(0, parsedLimit);

    return {
      history: limited,
      total: history.length,
      limit: parsedLimit,
    };
  }

  /**
   * Clear user's search history
   * @param {string} userId - User ID
   */
  async clearSearchHistory(userId) {
    this.searchHistoryStore.delete(userId);
    logger.info('Search history cleared', { userId });
  }

  // --- Private Methods ---

  /**
   * Add entry to user's search history
   */
  _addSearchHistory(userId, query, filters) {
    if (!this.searchHistoryStore.has(userId)) {
      this.searchHistoryStore.set(userId, []);
    }

    const history = this.searchHistoryStore.get(userId);
    history.unshift({
      query: query || '',
      filters: {
        location: filters.location,
        salaryMin: filters.salaryMin,
        salaryMax: filters.salaryMax,
        remote: filters.remote,
        experience: filters.experience,
        company: filters.company,
      },
      timestamp: new Date().toISOString(),
    });

    // Trim to max size
    if (history.length > this.maxHistoryPerUser) {
      history.length = this.maxHistoryPerUser;
    }
  }

  /**
   * Get user's search history
   */
  _getSearchHistory(userId) {
    return this.searchHistoryStore.get(userId) || [];
  }

  /**
   * Boost recommendation scores based on search history patterns
   */
  _boostByHistory(matchedJobs, history) {
    if (!history.length) {
      return matchedJobs;
    }

    // Extract frequently searched terms
    const termFrequency = {};
    for (const entry of history) {
      const terms = (entry.query || '').toLowerCase().split(/\s+/).filter(Boolean);
      for (const term of terms) {
        termFrequency[term] = (termFrequency[term] || 0) + 1;
      }
    }

    // Boost jobs whose titles contain frequently searched terms
    return matchedJobs
      .map((m) => {
        let boost = 0;
        const title = (m.job.title || '').toLowerCase();
        for (const [term, count] of Object.entries(termFrequency)) {
          if (title.includes(term)) {
            boost += Math.min(count * 2, 10); // Max 10 point boost per term
          }
        }

        return {
          ...m,
          match: {
            ...m.match,
            score: Math.min(100, m.match.score + boost),
            reason: boost > 0 ? `${m.match.reason} (boosted by search history)` : m.match.reason,
          },
        };
      })
      .sort((a, b) => b.match.score - a.match.score);
  }
}

module.exports = JobSearchEngine;
