const Job = require('../../database/models/Job');
const UserPreference = require('../../database/models/UserPreference');
const cache = require('../../utils/cache');
const logger = require('../../utils/logger');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');
const { matchJobsForUser } = require('../../automation/jobMatcher');
const { triggerScrape } = require('../../scheduler/schedulerInit');

const CACHE_TTL = 300; // 5 minutes

const searchJobs = async (req, res, next) => {
  try {
    const {
      role,
      location,
      salary_min,
      salary_max,
      company,
      level,
      page = 1,
      limit = 20,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // Check cache
    const cacheKey = `jobs:search:${JSON.stringify({ role, location, salary_min, salary_max, company, level, page: parsedPage, limit: parsedLimit })}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('Job search cache hit', { cacheKey });
      return res.json(JSON.parse(cached));
    }

    const result = await Job.search({
      title: role,
      company,
      location,
      salaryMin: salary_min ? parseInt(salary_min, 10) : undefined,
      salaryMax: salary_max ? parseInt(salary_max, 10) : undefined,
      jobLevel: level,
      page: parsedPage,
      limit: parsedLimit,
    });

    const response = {
      status: 'success',
      code: 200,
      data: result.jobs,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        timestamp: new Date().toISOString(),
      },
    };

    // Cache results
    await cache.set(cacheKey, JSON.stringify(response), CACHE_TTL);

    res.json(response);
  } catch (err) {
    next(err);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cached = await cache.get(`jobs:${id}`);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const job = await Job.findById(id);
    if (!job) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Job not found');
    }

    const response = {
      status: 'success',
      code: 200,
      data: job,
    };

    await cache.set(`jobs:${id}`, JSON.stringify(response), CACHE_TTL);

    res.json(response);
  } catch (err) {
    next(err);
  }
};

const triggerJobScrape = async (req, res, next) => {
  try {
    const { role, location, salary_min, salary_max, level } = req.query;
    const searchParams = {};
    if (role) {
      searchParams.role = role;
    }
    if (location) {
      searchParams.location = location;
    }
    if (salary_min) {
      searchParams.salaryMin = parseInt(salary_min, 10);
    }
    if (salary_max) {
      searchParams.salaryMax = parseInt(salary_max, 10);
    }
    if (level) {
      searchParams.level = level;
    }

    const result = await triggerScrape(searchParams, req.user.id);

    res.json({
      status: 'success',
      code: 200,
      data: result,
      message: 'Scrape job queued successfully',
    });
  } catch (err) {
    next(err);
  }
};

const getRecommendations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, min_score = 50 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const minScore = Math.max(0, Math.min(100, parseInt(min_score, 10) || 50));

    // Get user preferences
    const preferences = await UserPreference.findByUserId(req.user.id);
    if (!preferences) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Set up your preferences first to get recommendations',
      );
    }

    // Check cache
    const cacheKey = `recommendations:${req.user.id}:${parsedPage}:${parsedLimit}:${minScore}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Get recent jobs (last 7 days)
    const jobResult = await Job.search({
      page: 1,
      limit: 200, // Get a larger pool to match against
    });

    // Match against preferences
    const matched = matchJobsForUser(jobResult.jobs, preferences).filter(
      (m) => m.match.score >= minScore,
    );

    // Paginate results
    const total = matched.length;
    const start = (parsedPage - 1) * parsedLimit;
    const paginated = matched.slice(start, start + parsedLimit);

    const response = {
      status: 'success',
      code: 200,
      data: paginated.map((m) => ({
        ...m.job,
        matchScore: m.match.score,
        matchReason: m.match.reason,
      })),
      meta: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        minScore,
        timestamp: new Date().toISOString(),
      },
    };

    await cache.set(cacheKey, JSON.stringify(response), 120); // 2 min cache

    res.json(response);
  } catch (err) {
    next(err);
  }
};

module.exports = { searchJobs, getJobById, triggerJobScrape, getRecommendations };
