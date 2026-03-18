const SavedJob = require('../../database/models/SavedJob');
const Job = require('../../database/models/Job');
const UserPreference = require('../../database/models/UserPreference');
const Application = require('../../database/models/Application');
const { submitApplication } = require('../../automation/applicationSubmitter');
const { AppError, ERROR_CODES } = require('../../utils/errorCodes');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

const VALID_STATUSES = ['saved', 'applied', 'skipped'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

const listSavedJobs = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      );
    }

    const result = await SavedJob.findByUser(req.user.id, {
      status,
      priority,
      page: parseInt(page, 10) || 1,
      limit: Math.min(100, parseInt(limit, 10) || 20),
    });

    res.json({
      status: 'success',
      code: 200,
      data: result.savedJobs,
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

const saveJob = async (req, res, next) => {
  try {
    const { jobId, notes, customResumeId, priority } = req.body;

    if (!jobId) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, 'jobId is required');
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      );
    }

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Job not found');
    }

    const savedJob = await SavedJob.save(req.user.id, jobId, {
      notes,
      customResumeId,
      priority,
    });

    if (!savedJob) {
      throw new AppError(ERROR_CODES.CONFLICT, 'Job is already saved');
    }

    logger.info('Job saved', { userId: req.user.id, jobId });

    res.status(201).json({
      status: 'success',
      code: 201,
      data: savedJob,
    });
  } catch (err) {
    next(err);
  }
};

const updateSavedJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, priority, status, customResumeId } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      );
    }

    const updated = await SavedJob.update(id, req.user.id, {
      notes,
      priority,
      status,
      customResumeId,
    });

    if (!updated) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Saved job not found');
    }

    logger.info('Saved job updated', { userId: req.user.id, savedJobId: id });

    res.json({
      status: 'success',
      code: 200,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

const removeSavedJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    const removed = await SavedJob.removeById(id, req.user.id);

    if (!removed) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Saved job not found');
    }

    logger.info('Saved job removed', { userId: req.user.id, savedJobId: id });

    res.json({
      status: 'success',
      code: 200,
      data: { id: removed.id, removed: true },
    });
  } catch (err) {
    next(err);
  }
};

const getSavedJobStats = async (req, res, next) => {
  try {
    const stats = await SavedJob.getStats(req.user.id);

    res.json({
      status: 'success',
      code: 200,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

const bulkAutoApply = async (req, res, next) => {
  try {
    const { priority, maxApplications = 10 } = req.body;

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      );
    }

    // Validate user has preferences and auto-apply enabled
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
    const dailyLimit = preferences.daily_limit || config.application.maxPerDay;
    const remainingToday = Math.max(0, dailyLimit - todayCount);

    if (remainingToday === 0) {
      throw new AppError(ERROR_CODES.APPLICATION_LIMIT_REACHED, 'Daily application limit reached');
    }

    const applyCount = Math.min(
      Math.min(maxApplications, 50),
      remainingToday,
    );

    // Get saved jobs eligible for auto-apply
    const savedJobs = await SavedJob.findSavedForBulkApply(req.user.id, {
      priority,
      limit: applyCount,
    });

    if (savedJobs.length === 0) {
      return res.json({
        status: 'success',
        code: 200,
        data: {
          submitted: 0,
          failed: 0,
          totalEligible: 0,
          applications: [],
        },
        meta: {
          remainingToday,
          priorityFilter: priority || 'all',
          message: 'No saved jobs eligible for auto-apply',
        },
      });
    }

    const results = [];

    for (const savedJob of savedJobs) {
      try {
        const application = await submitApplication(
          req.user.id,
          savedJob.job_id,
          savedJob.custom_resume_id ? savedJob.custom_resume_id : 1,
        );
        await SavedJob.markApplied(savedJob.id, req.user.id);
        results.push({
          savedJobId: savedJob.id,
          jobId: savedJob.job_id,
          jobTitle: savedJob.job_title,
          company: savedJob.job_company,
          status: 'submitted',
          applicationId: application.id,
        });
      } catch (err) {
        results.push({
          savedJobId: savedJob.id,
          jobId: savedJob.job_id,
          jobTitle: savedJob.job_title,
          company: savedJob.job_company,
          status: 'failed',
          error: err.message,
        });
      }
    }

    const submitted = results.filter((r) => r.status === 'submitted').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    logger.info('Bulk auto-apply completed', {
      userId: req.user.id,
      submitted,
      failed,
      total: savedJobs.length,
    });

    res.status(201).json({
      status: 'success',
      code: 201,
      data: {
        submitted,
        failed,
        totalEligible: savedJobs.length,
        applications: results,
      },
      meta: {
        remainingToday: remainingToday - submitted,
        priorityFilter: priority || 'all',
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listSavedJobs,
  saveJob,
  updateSavedJob,
  removeSavedJob,
  getSavedJobStats,
  bulkAutoApply,
};
