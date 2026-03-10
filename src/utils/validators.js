/**
 * Input validation utilities for the Quickhire platform.
 * @module utils/validators
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/;

/**
 * Validates an email address format.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {return false;}
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates a UUID v4 format.
 * @param {string} uuid
 * @returns {boolean}
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {return false;}
  return UUID_REGEX.test(uuid);
}

/**
 * Validates a URL format.
 * @param {string} url
 * @returns {boolean}
 */
function isValidURL(url) {
  if (!url || typeof url !== 'string') {return false;}
  return URL_REGEX.test(url);
}

/**
 * Validates salary range.
 * @param {number} min
 * @param {number} max
 * @returns {{ valid: boolean, error?: string }}
 */
function isValidSalaryRange(min, max) {
  if (min !== undefined && min !== null) {
    if (typeof min !== 'number' || min < 0) {
      return { valid: false, error: 'Minimum salary must be a non-negative number' };
    }
  }
  if (max !== undefined && max !== null) {
    if (typeof max !== 'number' || max < 0) {
      return { valid: false, error: 'Maximum salary must be a non-negative number' };
    }
  }
  if (min !== undefined && max !== undefined && min !== null && max !== null) {
    if (min > max) {
      return { valid: false, error: 'Minimum salary cannot exceed maximum salary' };
    }
  }
  return { valid: true };
}

/**
 * Validates pagination parameters.
 * @param {number} page
 * @param {number} limit
 * @returns {{ valid: boolean, page: number, limit: number, error?: string }}
 */
function validatePagination(page, limit) {
  const parsedPage = parseInt(page, 10) || 1;
  const parsedLimit = parseInt(limit, 10) || 20;

  if (parsedPage < 1) {
    return { valid: false, page: 1, limit: parsedLimit, error: 'Page must be at least 1' };
  }
  if (parsedLimit < 1 || parsedLimit > 100) {
    return { valid: false, page: parsedPage, limit: 20, error: 'Limit must be between 1 and 100' };
  }

  return { valid: true, page: parsedPage, limit: parsedLimit };
}

/**
 * Sanitizes a string to prevent XSS.
 * @param {string} input
 * @returns {string}
 */
function sanitizeString(input) {
  if (!input || typeof input !== 'string') {return '';}
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validates application status value.
 * @param {string} status
 * @returns {boolean}
 */
function isValidApplicationStatus(status) {
  const validStatuses = ['pending', 'submitted', 'viewed', 'rejected', 'archived'];
  return validStatuses.includes(status);
}

/**
 * Validates job level value.
 * @param {string} level
 * @returns {boolean}
 */
function isValidJobLevel(level) {
  const validLevels = ['entry', 'mid', 'senior', 'lead', 'director', 'executive'];
  return validLevels.includes(level);
}

/**
 * Validates that required fields are present in an object.
 * @param {object} obj
 * @param {string[]} requiredFields
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateRequiredFields(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, missing: requiredFields };
  }

  const missing = requiredFields.filter(
    (field) => obj[field] === undefined || obj[field] === null || obj[field] === ''
  );

  return { valid: missing.length === 0, missing };
}

/**
 * Validates password strength.
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePasswordStrength(password) {
  const errors = [];
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  if (password.length < 8) {errors.push('Password must be at least 8 characters');}
  if (password.length > 128) {errors.push('Password must be at most 128 characters');}
  if (!/[A-Z]/.test(password)) {errors.push('Password must contain at least one uppercase letter');}
  if (!/[a-z]/.test(password)) {errors.push('Password must contain at least one lowercase letter');}
  if (!/[0-9]/.test(password)) {errors.push('Password must contain at least one digit');}
  if (!/[^A-Za-z0-9]/.test(password)) {errors.push('Password must contain at least one special character');}

  return { valid: errors.length === 0, errors };
}

module.exports = {
  isValidEmail,
  isValidUUID,
  isValidURL,
  isValidSalaryRange,
  validatePagination,
  sanitizeString,
  isValidApplicationStatus,
  isValidJobLevel,
  validateRequiredFields,
  validatePasswordStrength,
};
