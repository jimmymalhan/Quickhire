/**
 * Unit tests for src/utils/formatters.js
 * Tests all data formatting utilities.
 */

const {
  formatSuccessResponse,
  formatErrorResponse,
  formatPagination,
  formatUserResponse,
  formatJobResponse,
  formatApplicationResponse,
  formatSalaryRange,
  formatDate,
  formatRelativeTime,
} = require('../../../src/utils/formatters');

// ============================================================
// formatSuccessResponse
// ============================================================
describe('formatters - formatSuccessResponse', () => {
  test('creates success response with default code 200', () => {
    const data = { id: 1, name: 'Test' };
    const result = formatSuccessResponse(data);
    expect(result.status).toBe('success');
    expect(result.code).toBe(200);
    expect(result.data).toEqual(data);
    expect(result.meta).toHaveProperty('timestamp');
  });

  test('accepts custom status code', () => {
    const result = formatSuccessResponse({}, 201);
    expect(result.code).toBe(201);
  });

  test('includes additional metadata', () => {
    const meta = { requestId: 'req-123' };
    const result = formatSuccessResponse({}, 200, meta);
    expect(result.meta.requestId).toBe('req-123');
    expect(result.meta.timestamp).toBeDefined();
  });

  test('handles null data', () => {
    const result = formatSuccessResponse(null);
    expect(result.data).toBeNull();
  });

  test('handles array data', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = formatSuccessResponse(data);
    expect(result.data).toHaveLength(2);
  });

  test('timestamp is valid ISO string', () => {
    const result = formatSuccessResponse({});
    const date = new Date(result.meta.timestamp);
    expect(date.toISOString()).toBe(result.meta.timestamp);
  });
});

// ============================================================
// formatErrorResponse
// ============================================================
describe('formatters - formatErrorResponse', () => {
  test('creates error response with all fields', () => {
    const result = formatErrorResponse('INVALID_INPUT', 'Bad data', 400, ['name required']);
    expect(result.status).toBe('error');
    expect(result.code).toBe(400);
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.message).toBe('Bad data');
    expect(result.error.details).toEqual(['name required']);
    expect(result.meta).toHaveProperty('timestamp');
  });

  test('defaults to 500 status code', () => {
    const result = formatErrorResponse('INTERNAL_ERROR', 'Something broke');
    expect(result.code).toBe(500);
  });

  test('defaults to empty details array', () => {
    const result = formatErrorResponse('NOT_FOUND', 'Not found', 404);
    expect(result.error.details).toEqual([]);
  });

  test('includes valid timestamp', () => {
    const result = formatErrorResponse('ERROR', 'msg');
    const date = new Date(result.meta.timestamp);
    expect(date.toISOString()).toBe(result.meta.timestamp);
  });
});

// ============================================================
// formatPagination
// ============================================================
describe('formatters - formatPagination', () => {
  test('calculates pagination correctly', () => {
    const result = formatPagination(1, 20, 100);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(100);
    expect(result.totalPages).toBe(5);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrevious).toBe(false);
  });

  test('handles last page', () => {
    const result = formatPagination(5, 20, 100);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrevious).toBe(true);
  });

  test('handles middle page', () => {
    const result = formatPagination(3, 20, 100);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrevious).toBe(true);
  });

  test('handles single page of results', () => {
    const result = formatPagination(1, 20, 5);
    expect(result.totalPages).toBe(1);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrevious).toBe(false);
  });

  test('handles zero total results', () => {
    const result = formatPagination(1, 20, 0);
    expect(result.totalPages).toBe(0);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrevious).toBe(false);
  });

  test('handles partial last page', () => {
    const result = formatPagination(1, 20, 25);
    expect(result.totalPages).toBe(2);
    expect(result.hasNext).toBe(true);
  });

  test('handles limit of 1', () => {
    const result = formatPagination(5, 1, 10);
    expect(result.totalPages).toBe(10);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrevious).toBe(true);
  });
});

// ============================================================
// formatUserResponse
// ============================================================
describe('formatters - formatUserResponse', () => {
  test('formats user from snake_case db fields', () => {
    const user = {
      id: 'uuid-1',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      profile_pic_url: 'https://example.com/pic.jpg',
      created_at: '2026-01-01T00:00:00Z',
      access_token: 'secret-token',
      refresh_token: 'secret-refresh',
      password: 'hashed_password',
    };
    const result = formatUserResponse(user);
    expect(result.id).toBe('uuid-1');
    expect(result.email).toBe('test@example.com');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.profilePicUrl).toBe('https://example.com/pic.jpg');
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z');
    // Should NOT include sensitive fields
    expect(result.access_token).toBeUndefined();
    expect(result.refresh_token).toBeUndefined();
    expect(result.password).toBeUndefined();
  });

  test('formats user from camelCase fields', () => {
    const user = {
      id: 'uuid-1',
      email: 'test@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      profilePicUrl: 'https://example.com/pic2.jpg',
      createdAt: '2026-02-01T00:00:00Z',
    };
    const result = formatUserResponse(user);
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Smith');
  });

  test('returns null for null user', () => {
    expect(formatUserResponse(null)).toBeNull();
  });

  test('returns null for undefined user', () => {
    expect(formatUserResponse(undefined)).toBeNull();
  });
});

// ============================================================
// formatJobResponse
// ============================================================
describe('formatters - formatJobResponse', () => {
  test('formats job from snake_case db fields', () => {
    const job = {
      id: 'job-uuid',
      linkedin_job_id: 'li_123',
      title: 'Software Engineer',
      company: 'TechCo',
      location: 'Remote',
      salary_min: 80000,
      salary_max: 150000,
      description: 'A great job',
      job_level: 'senior',
      experience_years: 5,
      posted_at: '2026-01-15T00:00:00Z',
      url: 'https://linkedin.com/jobs/123',
    };
    const result = formatJobResponse(job);
    expect(result.id).toBe('job-uuid');
    expect(result.linkedinJobId).toBe('li_123');
    expect(result.title).toBe('Software Engineer');
    expect(result.company).toBe('TechCo');
    expect(result.salaryMin).toBe(80000);
    expect(result.salaryMax).toBe(150000);
    expect(result.jobLevel).toBe('senior');
    expect(result.experienceYears).toBe(5);
  });

  test('returns null for null job', () => {
    expect(formatJobResponse(null)).toBeNull();
  });

  test('returns null for undefined job', () => {
    expect(formatJobResponse(undefined)).toBeNull();
  });
});

// ============================================================
// formatApplicationResponse
// ============================================================
describe('formatters - formatApplicationResponse', () => {
  test('formats application from snake_case db fields', () => {
    const app = {
      id: 'app-uuid',
      user_id: 'user-uuid',
      job_id: 'job-uuid',
      status: 'pending',
      applied_at: '2026-01-20T00:00:00Z',
      submission_attempts: 1,
      resume_version: 2,
      created_at: '2026-01-20T00:00:00Z',
    };
    const result = formatApplicationResponse(app);
    expect(result.id).toBe('app-uuid');
    expect(result.userId).toBe('user-uuid');
    expect(result.jobId).toBe('job-uuid');
    expect(result.status).toBe('pending');
    expect(result.submissionAttempts).toBe(1);
    expect(result.resumeVersion).toBe(2);
  });

  test('returns null for null application', () => {
    expect(formatApplicationResponse(null)).toBeNull();
  });

  test('returns null for undefined application', () => {
    expect(formatApplicationResponse(undefined)).toBeNull();
  });
});

// ============================================================
// formatSalaryRange
// ============================================================
describe('formatters - formatSalaryRange', () => {
  test('formats range with both min and max', () => {
    const result = formatSalaryRange(80000, 150000);
    expect(result).toContain('80,000');
    expect(result).toContain('150,000');
    expect(result).toContain('-');
  });

  test('formats range with only min', () => {
    const result = formatSalaryRange(80000, null);
    expect(result).toContain('80,000');
    expect(result).toContain('+');
  });

  test('formats range with only max', () => {
    const result = formatSalaryRange(null, 150000);
    expect(result).toContain('Up to');
    expect(result).toContain('150,000');
  });

  test('returns "Not specified" when both are null', () => {
    expect(formatSalaryRange(null, null)).toBe('Not specified');
  });

  test('returns "Not specified" when both are undefined', () => {
    expect(formatSalaryRange(undefined, undefined)).toBe('Not specified');
  });

  test('returns "Not specified" when both are 0', () => {
    expect(formatSalaryRange(0, 0)).toBe('Not specified');
  });
});

// ============================================================
// formatDate
// ============================================================
describe('formatters - formatDate', () => {
  test('formats Date object to ISO string', () => {
    const date = new Date('2026-03-09T10:30:00Z');
    expect(formatDate(date)).toBe('2026-03-09T10:30:00.000Z');
  });

  test('formats date string to ISO string', () => {
    expect(formatDate('2026-03-09')).toBeTruthy();
  });

  test('returns null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(formatDate(undefined)).toBeNull();
  });

  test('returns null for invalid date string', () => {
    expect(formatDate('not-a-date')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(formatDate('')).toBeNull();
  });
});

// ============================================================
// formatRelativeTime
// ============================================================
describe('formatters - formatRelativeTime', () => {
  test('returns "just now" for recent timestamps', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  test('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 minutes ago');
  });

  test('returns singular "minute ago"', () => {
    const oneMinAgo = new Date(Date.now() - 61 * 1000);
    expect(formatRelativeTime(oneMinAgo)).toBe('1 minute ago');
  });

  test('returns hours ago', () => {
    const threeHrsAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHrsAgo)).toBe('3 hours ago');
  });

  test('returns singular "hour ago"', () => {
    const oneHrAgo = new Date(Date.now() - 61 * 60 * 1000);
    expect(formatRelativeTime(oneHrAgo)).toBe('1 hour ago');
  });

  test('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2 days ago');
  });

  test('returns localized date for old timestamps', () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(oldDate);
    expect(result).not.toBe('');
    expect(result).not.toContain('ago');
  });

  test('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  test('returns empty string for invalid date', () => {
    expect(formatRelativeTime('invalid')).toBe('');
  });
});
