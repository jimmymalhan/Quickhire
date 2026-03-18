/**
 * Test data factories for generating consistent test fixtures.
 * @module tests/factories
 */

const { v4: uuidv4 } = require('uuid');

let counter = 0;

/**
 * Generates a unique counter for creating unique test data.
 * @returns {number}
 */
function nextId() {
  return ++counter;
}

/**
 * Resets the counter (call in beforeEach if needed).
 */
function resetCounter() {
  counter = 0;
}

/**
 * Creates a test user object.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
 */
function createUser(overrides = {}) {
  const id = nextId();
  return {
    id: overrides.id || uuidv4(),
    email: overrides.email || `testuser${id}@example.com`,
    linkedin_id: overrides.linkedin_id || `linkedin_${id}`,
    first_name: overrides.first_name || `Test`,
    last_name: overrides.last_name || `User${id}`,
    profile_pic_url: overrides.profile_pic_url || `https://example.com/pic${id}.jpg`,
    access_token: overrides.access_token || `access_token_${id}`,
    refresh_token: overrides.refresh_token || `refresh_token_${id}`,
    token_expires_at: overrides.token_expires_at || new Date(Date.now() + 3600000).toISOString(),
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
    deleted_at: overrides.deleted_at || null,
  };
}

/**
 * Creates a test job object.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
 */
function createJob(overrides = {}) {
  const id = nextId();
  return {
    id: overrides.id || uuidv4(),
    linkedin_job_id: overrides.linkedin_job_id || `li_job_${id}`,
    title: overrides.title || `Software Engineer ${id}`,
    company: overrides.company || `Tech Corp ${id}`,
    location: overrides.location || 'San Francisco, CA',
    salary_min: overrides.salary_min !== undefined ? overrides.salary_min : 80000,
    salary_max: overrides.salary_max !== undefined ? overrides.salary_max : 150000,
    description: overrides.description || `Job description for position ${id}`,
    job_level: overrides.job_level || 'mid',
    experience_years: overrides.experience_years !== undefined ? overrides.experience_years : 3,
    posted_at: overrides.posted_at || new Date().toISOString(),
    scrape_date: overrides.scrape_date || new Date().toISOString(),
    url: overrides.url || `https://linkedin.com/jobs/${id}`,
    hash: overrides.hash || `hash_${id}`,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
  };
}

/**
 * Creates a test application object.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
 */
function createApplication(overrides = {}) {
  nextId();
  return {
    id: overrides.id || uuidv4(),
    user_id: overrides.user_id || uuidv4(),
    job_id: overrides.job_id || uuidv4(),
    status: overrides.status || 'pending',
    applied_at: overrides.applied_at || null,
    response_received_at: overrides.response_received_at || null,
    submission_attempts: overrides.submission_attempts !== undefined ? overrides.submission_attempts : 0,
    last_attempt_at: overrides.last_attempt_at || null,
    error_message: overrides.error_message || null,
    resume_version: overrides.resume_version !== undefined ? overrides.resume_version : 1,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
  };
}

/**
 * Creates a test user preferences object.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
 */
function createUserPreference(overrides = {}) {
  return {
    id: overrides.id || uuidv4(),
    user_id: overrides.user_id || uuidv4(),
    auto_apply_enabled: overrides.auto_apply_enabled !== undefined ? overrides.auto_apply_enabled : true,
    target_roles: overrides.target_roles || ['Software Engineer', 'Full Stack Developer'],
    target_locations: overrides.target_locations || ['San Francisco, CA', 'Remote'],
    min_salary: overrides.min_salary !== undefined ? overrides.min_salary : 80000,
    max_salary: overrides.max_salary !== undefined ? overrides.max_salary : 200000,
    experience_level: overrides.experience_level || ['mid', 'senior'],
    excluded_companies: overrides.excluded_companies || [],
    apply_interval_minutes: overrides.apply_interval_minutes || 60,
    notification_enabled: overrides.notification_enabled !== undefined ? overrides.notification_enabled : true,
    email_notifications: overrides.email_notifications !== undefined ? overrides.email_notifications : true,
    push_notifications: overrides.push_notifications !== undefined ? overrides.push_notifications : false,
    daily_limit: overrides.daily_limit || 20,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
  };
}

/**
 * Creates a batch of test objects.
 * @param {Function} factory - Factory function to use
 * @param {number} count - Number of objects to create
 * @param {object} [overrides] - Fields to override for all objects
 * @returns {object[]}
 */
function createBatch(factory, count, overrides = {}) {
  return Array.from({ length: count }, () => factory(overrides));
}

/**
 * Creates a mock JWT payload.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
 */
function createJWTPayload(overrides = {}) {
  return {
    userId: overrides.userId || uuidv4(),
    email: overrides.email || 'test@example.com',
    iat: overrides.iat || Math.floor(Date.now() / 1000),
    exp: overrides.exp || Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Creates mock LinkedIn profile data.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
 */
function createLinkedInProfile(overrides = {}) {
  const id = nextId();
  return {
    id: overrides.id || `linkedin_${id}`,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || `User${id}`,
    email: overrides.email || `testuser${id}@example.com`,
    profilePicture: overrides.profilePicture || `https://linkedin.com/pic/${id}`,
    headline: overrides.headline || `Software Engineer at Company ${id}`,
  };
}

module.exports = {
  nextId,
  resetCounter,
  createUser,
  createJob,
  createApplication,
  createUserPreference,
  createBatch,
  createJWTPayload,
  createLinkedInProfile,
};
