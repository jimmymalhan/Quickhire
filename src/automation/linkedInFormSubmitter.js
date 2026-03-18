/**
 * LinkedIn Form Submitter
 * Handles the actual submission of job applications via LinkedIn
 * Supports both mock mode (for development) and real submission
 */
const logger = require('../utils/logger');
const config = require('../utils/config');
const { FormFiller } = require('./formFiller');
const { ResumeUploadHandler } = require('./resumeUploadHandler');
const { withRetry } = require('./retryHandler');

const SUBMISSION_STATES = {
  PENDING: 'pending',
  FILLING_FORM: 'filling_form',
  UPLOADING_RESUME: 'uploading_resume',
  INSERTING_COVER_LETTER: 'inserting_cover_letter',
  SUBMITTING: 'submitting',
  SUBMITTED: 'submitted',
  FAILED: 'failed',
};

const LINKEDIN_ERRORS = {
  SESSION_EXPIRED: 'linkedin_session_expired',
  FORM_VALIDATION: 'linkedin_form_validation',
  ALREADY_APPLIED: 'linkedin_already_applied',
  JOB_CLOSED: 'linkedin_job_closed',
  RATE_LIMITED: 'linkedin_rate_limited',
  NETWORK_ERROR: 'network_error',
  UNKNOWN: 'unknown_error',
};

class LinkedInFormSubmitter {
  constructor(options = {}) {
    this.mockMode =
      options.mockMode !== undefined ? options.mockMode : config.features.mockLinkedIn;
    this.resumeHandler = new ResumeUploadHandler();
    this.submissionTimeout = options.submissionTimeout || 30000;
    this.mockDelay = options.mockDelay !== undefined ? options.mockDelay : 100;
    this.mockFailRate = options.mockFailRate || 0;
  }

  /**
   * Submit a job application
   * @param {Object} params
   * @param {Object} params.job - Job details
   * @param {Object} params.userProfile - User profile for form filling
   * @param {string} params.resumePath - Path to resume file
   * @param {string} params.coverLetter - Cover letter text
   * @returns {Object} Submission result
   */
  async submit({ job, userProfile, resumePath, coverLetter }) {
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timeline = [];

    const addEvent = (state, details = {}) => {
      timeline.push({ state, timestamp: new Date().toISOString(), ...details });
    };

    addEvent(SUBMISSION_STATES.PENDING);

    try {
      // Step 1: Fill the form
      addEvent(SUBMISSION_STATES.FILLING_FORM);
      const formResult = this._fillForm(userProfile, job, coverLetter);

      if (!formResult.success) {
        addEvent(SUBMISSION_STATES.FAILED, { error: 'Form fill incomplete', details: formResult });
        return this._buildResult(submissionId, false, 'form_fill_failed', formResult, timeline);
      }

      // Step 2: Prepare resume upload
      let resumeData = null;
      if (resumePath) {
        addEvent(SUBMISSION_STATES.UPLOADING_RESUME);
        resumeData = this._prepareResume(resumePath);
      }

      // Step 3: Insert cover letter
      if (coverLetter) {
        addEvent(SUBMISSION_STATES.INSERTING_COVER_LETTER);
      }

      // Step 4: Submit
      addEvent(SUBMISSION_STATES.SUBMITTING);
      const submitResult = await this._executeSubmission({
        job,
        formData: formResult.payload,
        resumeData,
        coverLetter,
      });

      if (submitResult.success) {
        addEvent(SUBMISSION_STATES.SUBMITTED);
        logger.info('Application submitted successfully', {
          submissionId,
          jobId: job.id || job.linkedinJobId,
          company: job.company,
        });
      } else {
        addEvent(SUBMISSION_STATES.FAILED, { error: submitResult.error });
      }

      return this._buildResult(
        submissionId,
        submitResult.success,
        submitResult.error || null,
        { form: formResult, submission: submitResult },
        timeline,
      );
    } catch (err) {
      addEvent(SUBMISSION_STATES.FAILED, { error: err.message });
      const errorType = this._classifyError(err);
      logger.error('Application submission failed', {
        submissionId,
        error: err.message,
        errorType,
      });
      return this._buildResult(submissionId, false, errorType, { error: err.message }, timeline);
    }
  }

  /**
   * Submit with retry logic
   */
  async submitWithRetry({ job, userProfile, resumePath, coverLetter, maxRetries = 3 }) {
    return withRetry(
      async (attempt) => {
        logger.debug('Submission attempt', { attempt, jobId: job.id || job.linkedinJobId });
        const result = await this.submit({ job, userProfile, resumePath, coverLetter });

        if (!result.success) {
          // Don't retry certain errors
          if (this._isNonRetryableError(result.errorType)) {
            const err = new Error(result.errorType);
            err.nonRetryable = true;
            err.result = result;
            throw err;
          }
          throw new Error(result.errorType || 'submission_failed');
        }

        return result;
      },
      {
        maxRetries,
        delayMs: 2000,
        backoffMultiplier: 2,
      },
    ).catch((err) => {
      if (err.nonRetryable && err.result) {
        return err.result;
      }
      return this._buildResult(
        `sub_retry_failed_${Date.now()}`,
        false,
        'max_retries_exceeded',
        { error: err.message, maxRetries },
        [],
      );
    });
  }

  /**
   * Fill form fields from user profile
   */
  _fillForm(userProfile, job, coverLetter) {
    const filler = new FormFiller({
      ...userProfile,
      coverLetter: coverLetter || userProfile.coverLetter,
    });

    // Standard LinkedIn application fields
    const fields = [
      { name: 'first_name', type: 'text' },
      { name: 'last_name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'linkedin_url', type: 'text' },
      { name: 'current_company', type: 'text' },
      { name: 'current_title', type: 'text' },
    ];

    const result = filler.fillForm(fields);
    const payload = filler.generatePayload(fields.map((f) => f.name));

    // Require at minimum: name and email
    const hasMinimum = !!(payload.first_name && payload.last_name && payload.email);

    return {
      success: hasMinimum,
      payload,
      ...result.summary,
    };
  }

  /**
   * Prepare resume for upload
   */
  _prepareResume(resumePath) {
    try {
      return this.resumeHandler.prepareUpload(resumePath);
    } catch (err) {
      logger.warn('Resume preparation failed', { error: err.message, path: resumePath });
      return null;
    }
  }

  /**
   * Execute the actual submission (mock or real)
   */
  async _executeSubmission({ job, formData, resumeData: _resumeData, coverLetter: _coverLetter }) {
    if (this.mockMode) {
      return this._mockSubmission(job, formData);
    }

    // Real submission would use browser automation here
    // For now, throw to indicate not configured
    throw new Error('Real LinkedIn submission requires browser automation configuration');
  }

  /**
   * Mock submission for development/testing
   */
  async _mockSubmission(_job, _formData) {
    if (this.mockDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.mockDelay));
    }

    // Simulate random failures based on mockFailRate
    if (this.mockFailRate > 0 && Math.random() < this.mockFailRate) {
      const errors = [
        LINKEDIN_ERRORS.SESSION_EXPIRED,
        LINKEDIN_ERRORS.FORM_VALIDATION,
        LINKEDIN_ERRORS.RATE_LIMITED,
        LINKEDIN_ERRORS.NETWORK_ERROR,
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];
      return { success: false, error: randomError, mock: true };
    }

    return {
      success: true,
      mock: true,
      confirmationId: `mock_confirm_${Date.now()}`,
      submittedAt: new Date().toISOString(),
    };
  }

  /**
   * Classify an error into a known type
   */
  _classifyError(err) {
    const message = (err.message || '').toLowerCase();

    if (message.includes('session') || message.includes('auth') || message.includes('login')) {
      return LINKEDIN_ERRORS.SESSION_EXPIRED;
    }
    if (message.includes('validation') || message.includes('required field')) {
      return LINKEDIN_ERRORS.FORM_VALIDATION;
    }
    if (message.includes('already applied') || message.includes('duplicate')) {
      return LINKEDIN_ERRORS.ALREADY_APPLIED;
    }
    if (message.includes('closed') || message.includes('no longer accepting')) {
      return LINKEDIN_ERRORS.JOB_CLOSED;
    }
    if (message.includes('rate') || message.includes('throttl') || message.includes('too many')) {
      return LINKEDIN_ERRORS.RATE_LIMITED;
    }
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('ECONNREFUSED')
    ) {
      return LINKEDIN_ERRORS.NETWORK_ERROR;
    }
    return LINKEDIN_ERRORS.UNKNOWN;
  }

  /**
   * Check if an error type should not be retried
   */
  _isNonRetryableError(errorType) {
    return [
      LINKEDIN_ERRORS.ALREADY_APPLIED,
      LINKEDIN_ERRORS.JOB_CLOSED,
      LINKEDIN_ERRORS.FORM_VALIDATION,
      'form_fill_failed',
    ].includes(errorType);
  }

  /**
   * Build a standardized result object
   */
  _buildResult(submissionId, success, errorType, details, timeline) {
    return {
      submissionId,
      success,
      errorType,
      details,
      timeline,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { LinkedInFormSubmitter, SUBMISSION_STATES, LINKEDIN_ERRORS };
