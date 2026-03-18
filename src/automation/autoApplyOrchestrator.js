/**
 * Auto-Apply Orchestrator
 * Processes saved jobs queue with customized resumes, enforcing rate limits,
 * daily caps, priority ordering, and pause/resume/cancel controls.
 */
const logger = require('../utils/logger');
const config = require('../utils/config');
const { AppError, ERROR_CODES } = require('../utils/errorCodes');
const { submitApplication } = require('./applicationSubmitter');
const { DailyCapEnforcer } = require('./dailyCapEnforcer');
const { ApplicationRateLimiter } = require('./applicationRateLimiter');
const Application = require('../database/models/Application');
const SavedJob = require('../database/models/SavedJob');
const UserPreference = require('../database/models/UserPreference');

const QUEUE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  ERROR: 'error',
};

const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };

class AutoApplyOrchestrator {
  constructor(options = {}) {
    this.maxPerHour = options.maxPerHour ?? 5;
    this.mockMode = options.mockMode ?? config.features.mockLinkedIn;

    this.rateLimiter = new ApplicationRateLimiter({
      maxPerHourGlobal: this.maxPerHour,
      maxPerHourPerCompany: options.maxPerHourPerCompany ?? 3,
      maxPerDayGlobal: config.application.maxPerDay ?? 50,
      minIntervalMs: (config.application.minIntervalSeconds ?? 60) * 1000,
    });

    this.dailyCapEnforcer = new DailyCapEnforcer({
      defaultCap: config.application.maxPerDay || 50,
    });

    // Per-user queue state: userId -> { status, progress, abortController }
    this.queues = new Map();
    // SSE listeners: userId -> Set<callback>
    this.listeners = new Map();
  }

  /**
   * Process a queue of saved jobs for a user
   * @param {string} userId
   * @param {Array} savedJobs - Array of saved job records (with job_id, job_company, etc.)
   * @param {Object} options
   * @param {Object} options.userProfile - User profile for form filling
   * @param {number} options.dailyLimit - Override daily cap
   * @param {string} options.resumePath - Default resume path
   * @returns {Object} Final results summary
   */
  async processQueue(userId, savedJobs, options = {}) {
    if (this._isRunning(userId)) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'Auto-apply is already running for this user',
      );
    }

    const { userProfile = {}, dailyLimit, resumePath } = options;

    const prioritized = this.prioritizeJobs(savedJobs);

    const queueState = {
      status: QUEUE_STATUS.RUNNING,
      total: prioritized.length,
      processed: 0,
      submitted: [],
      failed: [],
      skipped: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.queues.set(userId, queueState);
    this._emitProgress(userId, queueState);

    logger.info('Auto-apply queue started', {
      userId,
      totalJobs: prioritized.length,
      mockMode: this.mockMode,
    });

    try {
      for (const savedJob of prioritized) {
        // Check pause/cancel between each job
        const currentState = this.queues.get(userId);
        if (!currentState || currentState.status === QUEUE_STATUS.CANCELLED) {
          logger.info('Auto-apply queue cancelled', { userId });
          break;
        }

        if (currentState.status === QUEUE_STATUS.PAUSED) {
          // Wait for resume or cancel
          await this._waitForResume(userId);
          const afterWait = this.queues.get(userId);
          if (!afterWait || afterWait.status === QUEUE_STATUS.CANCELLED) {
            break;
          }
        }

        // Check daily cap
        const capCheck = this.checkDailyCap(userId, dailyLimit);
        if (!capCheck.allowed) {
          queueState.skipped.push({
            jobId: savedJob.job_id,
            reason: 'daily_cap_reached',
            detail: `${capCheck.count}/${capCheck.cap} applications today`,
          });
          logger.info('Daily cap reached, skipping remaining jobs', { userId });
          break;
        }

        // Warn if approaching daily cap (80%)
        if (capCheck.remaining <= Math.ceil(capCheck.cap * 0.2)) {
          logger.warn('Approaching daily cap', {
            userId,
            remaining: capCheck.remaining,
            cap: capCheck.cap,
          });
        }

        // Check rate limit
        const rateCheck = this.checkRateLimit(userId);
        if (!rateCheck.allowed) {
          const waitMs = rateCheck.retryAfterMs || 5000;
          logger.debug('Rate limited, waiting', { userId, waitMs });
          await this._sleep(waitMs);
        }

        // Check if already applied
        const alreadyApplied = await this._hasAlreadyApplied(userId, savedJob.job_id);
        if (alreadyApplied) {
          queueState.skipped.push({
            jobId: savedJob.job_id,
            reason: 'already_applied',
          });
          queueState.processed++;
          queueState.updatedAt = new Date().toISOString();
          this._emitProgress(userId, queueState);
          continue;
        }

        // Apply to job
        try {
          const result = await this.applyToJob(userId, savedJob, {
            userProfile,
            dailyLimit,
            resumePath: savedJob.custom_resume_path || resumePath,
          });

          queueState.submitted.push({
            jobId: savedJob.job_id,
            savedJobId: savedJob.id,
            applicationId: result.id,
            company: savedJob.job_company,
            title: savedJob.job_title,
          });

          // Record in daily cap
          this.dailyCapEnforcer.recordApplication(userId, dailyLimit);

          // Mark saved job as applied
          if (savedJob.id) {
            try {
              await SavedJob.markApplied(savedJob.id, userId);
            } catch (err) {
              logger.warn('Failed to mark saved job as applied', {
                savedJobId: savedJob.id,
                error: err.message,
              });
            }
          }
        } catch (err) {
          const errorEntry = {
            jobId: savedJob.job_id,
            savedJobId: savedJob.id,
            error: err.message,
            code: err.code || 'UNKNOWN',
          };

          if (
            err.code === 'APPLICATION_LIMIT_REACHED' ||
            err.code === 'RATE_LIMIT_EXCEEDED'
          ) {
            queueState.skipped.push({
              ...errorEntry,
              reason: err.code.toLowerCase(),
            });
            break;
          }

          queueState.failed.push(errorEntry);
        }

        queueState.processed++;
        queueState.updatedAt = new Date().toISOString();
        this._emitProgress(userId, queueState);
      }

      // Mark complete
      const finalState = this.queues.get(userId);
      if (finalState && finalState.status === QUEUE_STATUS.RUNNING) {
        finalState.status = QUEUE_STATUS.COMPLETED;
      }
      if (finalState) {
        finalState.completedAt = new Date().toISOString();
        finalState.updatedAt = new Date().toISOString();
        this._emitProgress(userId, finalState);
      }

      const results = {
        status: finalState ? finalState.status : QUEUE_STATUS.COMPLETED,
        total: queueState.total,
        submitted: queueState.submitted,
        failed: queueState.failed,
        skipped: queueState.skipped,
        startedAt: queueState.startedAt,
        completedAt: new Date().toISOString(),
      };

      logger.info('Auto-apply queue finished', {
        userId,
        status: results.status,
        submitted: results.submitted.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
      });

      return results;
    } catch (err) {
      const currentState = this.queues.get(userId);
      if (currentState) {
        currentState.status = QUEUE_STATUS.ERROR;
        currentState.error = err.message;
        currentState.updatedAt = new Date().toISOString();
        this._emitProgress(userId, currentState);
      }

      logger.error('Auto-apply queue error', {
        userId,
        error: err.message,
      });

      throw err;
    }
  }

  /**
   * Apply to a single job
   * @param {string} userId
   * @param {Object} job - Saved job record
   * @param {Object} options
   * @returns {Object} Application record
   */
  async applyToJob(userId, job, options = {}) {
    const { userProfile = {}, dailyLimit, resumePath } = options;

    logger.debug('Applying to job', {
      userId,
      jobId: job.job_id,
      company: job.job_company,
      title: job.job_title,
    });

    const result = await submitApplication(userId, job.job_id, {
      resumePath,
      coverLetter: job.cover_letter,
      userProfile,
      dailyLimit,
    });

    return result;
  }

  /**
   * Check if user has reached daily application cap
   * @param {string} userId
   * @param {number} dailyLimit - Optional override
   * @returns {{ allowed: boolean, remaining: number, cap: number, count: number }}
   */
  checkDailyCap(userId, dailyLimit) {
    return this.dailyCapEnforcer.canApply(userId, dailyLimit);
  }

  /**
   * Check rate limit for a user
   * @param {string} userId
   * @returns {{ allowed: boolean, reason?: string, retryAfterMs?: number }}
   */
  checkRateLimit(_userId) {
    return this.rateLimiter.canSubmit(null);
  }

  /**
   * Prioritize jobs: high priority first, then by match score descending
   * @param {Array} jobs
   * @returns {Array} Sorted jobs
   */
  prioritizeJobs(jobs) {
    if (!Array.isArray(jobs)) {
      return [];
    }

    return [...jobs].sort((a, b) => {
      // Sort by priority first
      const priorityA = PRIORITY_ORDER[a.priority] || 2;
      const priorityB = PRIORITY_ORDER[b.priority] || 2;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Then by match score descending (if available)
      const scoreA = a.match_score || 0;
      const scoreB = b.match_score || 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Then by saved_at ascending (oldest first)
      const savedAtA = a.saved_at ? new Date(a.saved_at).getTime() : 0;
      const savedAtB = b.saved_at ? new Date(b.saved_at).getTime() : 0;
      return savedAtA - savedAtB;
    });
  }

  /**
   * Get current progress for a user
   * @param {string} userId
   * @returns {Object|null}
   */
  getProgress(userId) {
    const state = this.queues.get(userId);
    if (!state) {
      return {
        status: QUEUE_STATUS.IDLE,
        total: 0,
        processed: 0,
        submitted: [],
        failed: [],
        skipped: [],
      };
    }

    return {
      status: state.status,
      total: state.total,
      processed: state.processed,
      submittedCount: state.submitted.length,
      failedCount: state.failed.length,
      skippedCount: state.skipped.length,
      submitted: state.submitted,
      failed: state.failed,
      skipped: state.skipped,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt || null,
      error: state.error || null,
    };
  }

  /**
   * Pause the auto-apply queue for a user
   * @param {string} userId
   * @returns {boolean}
   */
  pauseQueue(userId) {
    const state = this.queues.get(userId);
    if (!state || state.status !== QUEUE_STATUS.RUNNING) {
      return false;
    }

    state.status = QUEUE_STATUS.PAUSED;
    state.updatedAt = new Date().toISOString();
    this._emitProgress(userId, state);

    logger.info('Auto-apply queue paused', { userId });
    return true;
  }

  /**
   * Resume the auto-apply queue for a user
   * @param {string} userId
   * @returns {boolean}
   */
  resumeQueue(userId) {
    const state = this.queues.get(userId);
    if (!state || state.status !== QUEUE_STATUS.PAUSED) {
      return false;
    }

    state.status = QUEUE_STATUS.RUNNING;
    state.updatedAt = new Date().toISOString();
    this._emitProgress(userId, state);

    logger.info('Auto-apply queue resumed', { userId });
    return true;
  }

  /**
   * Cancel the auto-apply queue for a user
   * @param {string} userId
   * @returns {boolean}
   */
  cancelQueue(userId) {
    const state = this.queues.get(userId);
    if (
      !state ||
      state.status === QUEUE_STATUS.COMPLETED ||
      state.status === QUEUE_STATUS.CANCELLED
    ) {
      return false;
    }

    state.status = QUEUE_STATUS.CANCELLED;
    state.updatedAt = new Date().toISOString();
    state.completedAt = new Date().toISOString();
    this._emitProgress(userId, state);

    logger.info('Auto-apply queue cancelled', { userId });
    return true;
  }

  /**
   * Subscribe to progress updates via SSE
   * @param {string} userId
   * @param {Function} callback - Called with progress data
   * @returns {Function} Unsubscribe function
   */
  subscribe(userId, callback) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId).add(callback);

    // Immediately send current state
    const progress = this.getProgress(userId);
    callback(progress);

    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(callback);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  /**
   * Check if auto-apply is currently running for a user
   */
  _isRunning(userId) {
    const state = this.queues.get(userId);
    return (
      state &&
      (state.status === QUEUE_STATUS.RUNNING || state.status === QUEUE_STATUS.PAUSED)
    );
  }

  /**
   * Emit progress to all SSE listeners for a user
   */
  _emitProgress(userId, state) {
    const userListeners = this.listeners.get(userId);
    if (!userListeners || userListeners.size === 0) {
      return;
    }

    const progress = {
      status: state.status,
      total: state.total,
      processed: state.processed,
      submittedCount: state.submitted.length,
      failedCount: state.failed.length,
      skippedCount: state.skipped.length,
      submitted: state.submitted,
      failed: state.failed,
      skipped: state.skipped,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt || null,
      error: state.error || null,
    };

    for (const callback of userListeners) {
      try {
        callback(progress);
      } catch (err) {
        logger.warn('SSE listener error', { userId, error: err.message });
      }
    }
  }

  /**
   * Check if user has already applied to a job
   */
  async _hasAlreadyApplied(userId, jobId) {
    try {
      const count = await Application.countTodayByUser(userId);
      // Also check if an application record exists for this specific job
      const { query } = require('../database/connection');
      const result = await query(
        `SELECT COUNT(*) FROM applications WHERE user_id = $1 AND job_id = $2 AND status = 'submitted'`,
        [userId, jobId],
      );
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (err) {
      logger.warn('Could not check existing application', {
        userId,
        jobId,
        error: err.message,
      });
      return false;
    }
  }

  /**
   * Wait for queue to be resumed or cancelled
   */
  _waitForResume(userId) {
    if (process.env.DISABLE_QUEUES === 'true') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const state = this.queues.get(userId);
        if (
          !state ||
          state.status !== QUEUE_STATUS.PAUSED
        ) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset orchestrator state (for testing)
   */
  _reset() {
    this.queues.clear();
    this.listeners.clear();
    this.rateLimiter.reset();
    this.dailyCapEnforcer.resetAll();
  }
}

module.exports = { AutoApplyOrchestrator, QUEUE_STATUS, PRIORITY_ORDER };
