const Application = require('../../database/models/Application');
const ApplicationLog = require('../../database/models/ApplicationLog');
const UserPreference = require('../../database/models/UserPreference');
const Job = require('../../database/models/Job');
const { submitApplication } = require('../../automation/applicationSubmitter');
const { matchJobsForUser } = require('../../automation/jobMatcher');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');
const { query } = require('../../database/connection');
const config = require('../../utils/config');

const listApplications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await Application.findByUserId(req.user.id, {
      status,
      page: parseInt(page, 10) || 1,
      limit: Math.min(100, parseInt(limit, 10) || 20),
    });

    res.json({
      status: 'success',
      code: 200,
      data: result.applications,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application || application.user_id !== req.user.id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Application not found');
    }

    const logs = await ApplicationLog.findByApplicationId(application.id);

    res.json({
      status: 'success',
      code: 200,
      data: { ...application, logs },
    });
  } catch (err) {
    next(err);
  }
};

const applyToJob = async (req, res, next) => {
  try {
    const { id: jobId } = req.params;
    const { resumeVersion } = req.body;

    const application = await submitApplication(req.user.id, jobId, resumeVersion || 1);

    res.status(201).json({
      status: 'success',
      code: 201,
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'submitted', 'viewed', 'rejected', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const application = await Application.findById(req.params.id);
    if (!application || application.user_id !== req.user.id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Application not found');
    }

    const updated = await Application.updateStatus(req.params.id, status);
    await ApplicationLog.create({
      applicationId: req.params.id,
      action: 'status_changed',
      details: { from: application.status, to: status },
    });

    res.json({
      status: 'success',
      code: 200,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

const autoApply = async (req, res, next) => {
  try {
    const { min_score = 70, max_applications = 10 } = req.body;
    const maxApps = Math.min(max_applications, config.application.maxPerDay);

    // Validate user has preferences set
    const preferences = await UserPreference.findByUserId(req.user.id);
    if (!preferences) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        'Set up your preferences before using auto-apply',
      );
    }

    if (!preferences.auto_apply_enabled) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Auto-apply is not enabled in your settings');
    }

    // Check daily limit
    const todayCount = await Application.countTodayByUser(req.user.id);
    const remainingToday = Math.max(
      0,
      (preferences.daily_limit || config.application.maxPerDay) - todayCount,
    );
    if (remainingToday === 0) {
      throw new AppError(ERROR_CODES.APPLICATION_LIMIT_REACHED, 'Daily application limit reached');
    }

    const applyCount = Math.min(maxApps, remainingToday);

    // Get recent jobs and match
    const jobResult = await Job.search({ page: 1, limit: 200 });
    const matched = matchJobsForUser(jobResult.jobs, preferences).filter(
      (m) => m.match.score >= min_score,
    );

    // Filter out jobs already applied to
    const existingApps = await query(`SELECT job_id FROM applications WHERE user_id = $1`, [
      req.user.id,
    ]);
    const appliedJobIds = new Set(existingApps.rows.map((r) => r.job_id));
    const newMatches = matched.filter((m) => !appliedJobIds.has(m.job.id));

    // Apply to top matches
    const toApply = newMatches.slice(0, applyCount);
    const results = [];

    for (const match of toApply) {
      try {
        const application = await submitApplication(req.user.id, match.job.id, 1);
        results.push({
          jobId: match.job.id,
          jobTitle: match.job.title,
          company: match.job.company,
          matchScore: match.match.score,
          status: 'submitted',
          applicationId: application.id,
        });
      } catch (err) {
        results.push({
          jobId: match.job.id,
          jobTitle: match.job.title,
          company: match.job.company,
          matchScore: match.match.score,
          status: 'failed',
          error: err.message,
        });
      }
    }

    const submitted = results.filter((r) => r.status === 'submitted').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    res.status(201).json({
      status: 'success',
      code: 201,
      data: {
        submitted,
        failed,
        totalMatched: newMatches.length,
        applications: results,
      },
      meta: {
        remainingToday: remainingToday - submitted,
        minScoreUsed: min_score,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get application counts by status
    const statusResult = await query(
      `SELECT status, COUNT(*) as count FROM applications WHERE user_id = $1 GROUP BY status`,
      [userId],
    );
    const byStatus = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    // Get today's count
    const todayResult = await query(
      `SELECT COUNT(*) FROM applications WHERE user_id = $1 AND applied_at >= CURRENT_DATE AND status = 'submitted'`,
      [userId],
    );
    const todayCount = parseInt(todayResult.rows[0].count, 10);

    // Get weekly count
    const weekResult = await query(
      `SELECT COUNT(*) FROM applications WHERE user_id = $1 AND applied_at >= CURRENT_DATE - INTERVAL '7 days' AND status = 'submitted'`,
      [userId],
    );
    const weekCount = parseInt(weekResult.rows[0].count, 10);

    // Get total count
    const totalResult = await query(`SELECT COUNT(*) FROM applications WHERE user_id = $1`, [
      userId,
    ]);
    const totalCount = parseInt(totalResult.rows[0].count, 10);

    // Get response rate
    const responseResult = await query(
      `SELECT COUNT(*) FROM applications WHERE user_id = $1 AND status IN ('viewed', 'rejected')`,
      [userId],
    );
    const responseCount = parseInt(responseResult.rows[0].count, 10);
    const submittedCount =
      (byStatus.submitted || 0) + (byStatus.viewed || 0) + (byStatus.rejected || 0);
    const responseRate =
      submittedCount > 0 ? Math.round((responseCount / submittedCount) * 100) : 0;

    // Get scrape stats
    const scrapeResult = await query(
      `SELECT COUNT(*) as scrape_count, COALESCE(SUM(total_scraped), 0) as total_jobs_scraped, COALESCE(SUM(matched_count), 0) as total_matched
       FROM scrape_stats WHERE user_id = $1`,
      [userId],
    );
    const scrapeStats = scrapeResult.rows[0];

    // Get user's daily limit
    const preferences = await UserPreference.findByUserId(userId);
    const dailyLimit = (preferences && preferences.daily_limit) || config.application.maxPerDay;

    res.json({
      status: 'success',
      code: 200,
      data: {
        applications: {
          total: totalCount,
          today: todayCount,
          thisWeek: weekCount,
          byStatus,
          responseRate,
        },
        scraping: {
          totalScrapes: parseInt(scrapeStats.scrape_count, 10),
          totalJobsScraped: parseInt(scrapeStats.total_jobs_scraped, 10),
          totalMatched: parseInt(scrapeStats.total_matched, 10),
        },
        limits: {
          dailyLimit,
          remainingToday: Math.max(0, dailyLimit - todayCount),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listApplications,
  getApplication,
  applyToJob,
  updateApplicationStatus,
  autoApply,
  getStats,
};
