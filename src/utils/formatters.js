/**
 * Data formatting utilities for the Quickhire platform.
 * @module utils/formatters
 */

/**
 * Formats a successful API response.
 * @param {object} data - Response data
 * @param {number} [code=200] - HTTP status code
 * @param {object} [meta] - Additional metadata
 * @returns {object}
 */
function formatSuccessResponse(data, code = 200, meta = {}) {
  return {
    status: 'success',
    code,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Formats an error API response.
 * @param {string} errorCode - Error code string
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {string[]} [details=[]] - Error details
 * @returns {object}
 */
function formatErrorResponse(errorCode, message, statusCode = 500, details = []) {
  return {
    status: 'error',
    code: statusCode,
    error: {
      code: errorCode,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Formats pagination metadata.
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {object}
 */
function formatPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Formats a user object for API response (strips sensitive fields).
 * @param {object} user - Raw user object from database
 * @returns {object}
 */
function formatUserResponse(user) {
  if (!user) {return null;}
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name || user.firstName,
    lastName: user.last_name || user.lastName,
    profilePicUrl: user.profile_pic_url || user.profilePicUrl,
    createdAt: user.created_at || user.createdAt,
  };
}

/**
 * Formats a job object for API response.
 * @param {object} job - Raw job object from database
 * @returns {object}
 */
function formatJobResponse(job) {
  if (!job) {return null;}
  return {
    id: job.id,
    linkedinJobId: job.linkedin_job_id || job.linkedinJobId,
    title: job.title,
    company: job.company,
    location: job.location,
    salaryMin: job.salary_min || job.salaryMin,
    salaryMax: job.salary_max || job.salaryMax,
    description: job.description,
    jobLevel: job.job_level || job.jobLevel,
    experienceYears: job.experience_years || job.experienceYears,
    postedAt: job.posted_at || job.postedAt,
    url: job.url,
  };
}

/**
 * Formats an application object for API response.
 * @param {object} application - Raw application object from database
 * @returns {object}
 */
function formatApplicationResponse(application) {
  if (!application) {return null;}
  return {
    id: application.id,
    userId: application.user_id || application.userId,
    jobId: application.job_id || application.jobId,
    status: application.status,
    appliedAt: application.applied_at || application.appliedAt,
    submissionAttempts: application.submission_attempts || application.submissionAttempts,
    resumeVersion: application.resume_version || application.resumeVersion,
    createdAt: application.created_at || application.createdAt,
  };
}

/**
 * Formats salary as a human-readable string.
 * @param {number} min - Minimum salary
 * @param {number} max - Maximum salary
 * @returns {string}
 */
function formatSalaryRange(min, max) {
  const fmt = (n) => `$${n.toLocaleString('en-US')}`;
  if (min && max) {return `${fmt(min)} - ${fmt(max)}`;}
  if (min) {return `${fmt(min)}+`;}
  if (max) {return `Up to ${fmt(max)}`;}
  return 'Not specified';
}

/**
 * Formats a date to ISO date string.
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) {return null;}
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {return null;}
  return d.toISOString();
}

/**
 * Formats a relative time string (e.g., "2 hours ago").
 * @param {Date|string} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  if (!date) {return '';}
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {return '';}

  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {return 'just now';}
  if (diffMin < 60) {return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;}
  if (diffHr < 24) {return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;}
  if (diffDay < 30) {return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;}
  return d.toLocaleDateString();
}

module.exports = {
  formatSuccessResponse,
  formatErrorResponse,
  formatPagination,
  formatUserResponse,
  formatJobResponse,
  formatApplicationResponse,
  formatSalaryRange,
  formatDate,
  formatRelativeTime,
};
