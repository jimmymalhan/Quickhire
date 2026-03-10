/**
 * Application Submitter - Orchestrates the full submission pipeline
 * Coordinates form filling, resume upload, rate limiting, daily caps,
 * and LinkedIn form submission into a single workflow
 */
const Application = require('../database/models/Application');
const ApplicationLog = require('../database/models/ApplicationLog');
const Job = require('../database/models/Job');
const logger = require('../utils/logger');
const config = require('../utils/config');
const { AppError, ERROR_CODES } = require('../utils/errorCodes');
const { LinkedInFormSubmitter } = require('./linkedInFormSubmitter');
const { ApplicationRateLimiter } = require('./applicationRateLimiter');
const { DailyCapEnforcer } = require('./dailyCapEnforcer');

// Shared instances for rate limiting across calls
let rateLimiter = null;
let dailyCapEnforcer = null;

const getRateLimiter = () => {
  if (!rateLimiter) {
    rateLimiter = new ApplicationRateLimiter({
      maxPerHourPerCompany: 8,
      maxPerHourGlobal: 25,
      maxPerDayGlobal: config.application.maxPerDay || 50,
      minIntervalMs: (config.application.minIntervalSeconds || 60) * 1000,
    });
  }
  return rateLimiter;
};

const getDailyCapEnforcer = () => {
  if (!dailyCapEnforcer) {
    dailyCapEnforcer = new DailyCapEnforcer({
      defaultCap: config.application.maxPerDay || 50,
    });
  }
  return dailyCapEnforcer;
};

/**
 * Submit a single application through the full pipeline
 * @param {string} userId - User ID
 * @param {string} jobId - Job ID
 * @param {Object} options - Additional options
 * @param {number} options.resumeVersion - Resume version to use
 * @param {string} options.resumePath - Path to resume file
 * @param {string} options.coverLetter - Cover letter text
 * @param {Object} options.userProfile - User profile for form filling
 * @param {number} options.dailyLimit - User's daily limit preference
 * @returns {Object} Updated application record
 */
const submitApplication = async (userId, jobId, options = {}) => {
  const {
    resumeVersion = 1,
    resumePath,
    coverLetter,
    userProfile = {},
    dailyLimit,
  } = typeof options === 'number' ? { resumeVersion: options } : options;

  const limiter = getRateLimiter();
  const capEnforcer = getDailyCapEnforcer();

  // Step 1: Check daily cap (from database)
  const todayCount = await Application.countTodayByUser(userId);
  const maxPerDay = dailyLimit || config.application.maxPerDay;
  if (todayCount >= maxPerDay) {
    throw new AppError(
      ERROR_CODES.APPLICATION_LIMIT_REACHED,
      `Daily application limit (${maxPerDay}) reached`,
    );
  }

  // Step 2: Check daily cap enforcer (in-memory tracking)
  const capCheck = capEnforcer.canApply(userId, dailyLimit);
  if (!capCheck.allowed) {
    throw new AppError(
      ERROR_CODES.APPLICATION_LIMIT_REACHED,
      `Daily cap reached: ${capCheck.count}/${capCheck.cap} applications today`,
    );
  }

  // Step 3: Load job details for rate limiting
  let job = null;
  try {
    job = await Job.findById(jobId);
  } catch (err) {
    logger.warn('Could not load job details', { jobId, error: err.message });
  }

  const company = job ? job.company : null;

  // Step 4: Check rate limiter
  const rateCheck = limiter.canSubmit(company);
  if (!rateCheck.allowed) {
    throw new AppError(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      `Rate limit: ${rateCheck.reason}. Retry after ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)}s`,
    );
  }

  // Step 5: Create application record
  const application = await Application.create({
    userId,
    jobId,
    status: 'pending',
    resumeVersion,
  });

  if (!application) {
    throw new AppError(ERROR_CODES.CONFLICT, 'Application already exists for this job');
  }

  await ApplicationLog.create({
    applicationId: application.id,
    action: 'created',
    details: { resumeVersion, hasResumePath: !!resumePath, hasCoverLetter: !!coverLetter },
  });

  // Step 6: Attempt submission with retries
  let attempts = 0;
  const maxAttempts = config.application.retryAttempts;
  let lastError = null;

  const submitter = new LinkedInFormSubmitter({
    mockMode: config.features.mockLinkedIn,
    mockDelay: config.features.mockLinkedIn ? 50 : 0,
  });

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const submissionResult = await submitter.submit({
        job: job || { id: jobId },
        userProfile,
        resumePath,
        coverLetter,
      });

      if (!submissionResult.success) {
        throw new Error(submissionResult.errorType || 'submission_failed');
      }

      // Success - update records
      const updated = await Application.updateStatus(application.id, 'submitted');
      await ApplicationLog.create({
        applicationId: application.id,
        action: 'submitted',
        details: {
          attempt: attempts,
          submissionId: submissionResult.submissionId,
        },
      });

      // Record in rate limiter and daily cap
      limiter.recordSubmission(company);
      capEnforcer.recordApplication(userId, dailyLimit);

      logger.info('Application submitted', {
        applicationId: application.id,
        attempts,
        company,
        submissionId: submissionResult.submissionId,
      });

      return updated;
    } catch (err) {
      lastError = err;
      logger.warn('Application submission attempt failed', {
        applicationId: application.id,
        attempt: attempts,
        error: err.message,
      });

      await ApplicationLog.create({
        applicationId: application.id,
        action: 'attempt_failed',
        details: { attempt: attempts, error: err.message },
      });

      // Activate cooldown if rate limited by LinkedIn
      if (err.message && err.message.includes('rate_limited')) {
        limiter.activateCooldown();
      }

      if (attempts < maxAttempts) {
        const delay = config.application.retryDelayMs * Math.pow(2, attempts - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  await Application.updateStatus(application.id, 'pending', lastError?.message);
  throw new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    `Application submission failed after ${maxAttempts} attempts`,
  );
};

/**
 * Submit multiple applications in batch with rate limiting
 * @param {string} userId
 * @param {Array<{jobId: string, resumePath?: string, coverLetter?: string}>} applications
 * @param {Object} options
 * @returns {{ submitted: Array, failed: Array, skipped: Array }}
 */
const submitBatch = async (userId, applications, options = {}) => {
  const { userProfile = {}, dailyLimit } = options;
  const limiter = getRateLimiter();
  const results = { submitted: [], failed: [], skipped: [] };

  for (const app of applications) {
    // Check if we can continue
    const capEnforcer = getDailyCapEnforcer();
    const capCheck = capEnforcer.canApply(userId, dailyLimit);
    if (!capCheck.allowed) {
      results.skipped.push({ jobId: app.jobId, reason: 'daily_cap_reached' });
      continue;
    }

    // Wait for rate limiter
    const waitTime = limiter.getWaitTime(app.company);
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    try {
      const result = await submitApplication(userId, app.jobId, {
        resumePath: app.resumePath,
        coverLetter: app.coverLetter,
        userProfile,
        dailyLimit,
      });
      results.submitted.push({ jobId: app.jobId, applicationId: result.id });
    } catch (err) {
      if (err.code === 'APPLICATION_LIMIT_REACHED' || err.code === 'RATE_LIMIT_EXCEEDED') {
        results.skipped.push({ jobId: app.jobId, reason: err.message });
        break; // Stop batch if limits reached
      }
      results.failed.push({ jobId: app.jobId, error: err.message });
    }
  }

  logger.info('Batch submission complete', {
    userId,
    total: applications.length,
    submitted: results.submitted.length,
    failed: results.failed.length,
    skipped: results.skipped.length,
  });

  return results;
};

/**
 * Get rate limit and cap status for a user
 */
const getSubmissionStatus = (userId, dailyLimit) => {
  const limiter = getRateLimiter();
  const capEnforcer = getDailyCapEnforcer();

  return {
    rateLimiter: limiter.getStatus(),
    dailyCap: capEnforcer.getStatus(userId, dailyLimit),
  };
};

/**
 * Reset shared instances (for testing)
 */
const _resetInstances = () => {
  rateLimiter = null;
  dailyCapEnforcer = null;
};

module.exports = {
  submitApplication,
  submitBatch,
  getSubmissionStatus,
  _resetInstances,
};
