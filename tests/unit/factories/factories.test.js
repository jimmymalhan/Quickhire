/**
 * Unit tests for tests/factories/index.js
 * Tests the test data factory functions.
 */

const {
  nextId,
  resetCounter,
  createUser,
  createJob,
  createApplication,
  createUserPreference,
  createBatch,
  createJWTPayload,
  createLinkedInProfile,
} = require('../../factories');

describe('factories - nextId', () => {
  beforeEach(() => {
    resetCounter();
  });

  test('increments counter', () => {
    expect(nextId()).toBe(1);
    expect(nextId()).toBe(2);
    expect(nextId()).toBe(3);
  });

  test('resetCounter resets to 0', () => {
    nextId();
    nextId();
    resetCounter();
    expect(nextId()).toBe(1);
  });
});

describe('factories - createUser', () => {
  beforeEach(() => {
    resetCounter();
  });

  test('creates a user with default values', () => {
    const user = createUser();
    expect(user.id).toBeDefined();
    expect(user.email).toContain('@example.com');
    expect(user.linkedin_id).toBeDefined();
    expect(user.first_name).toBe('Test');
    expect(user.last_name).toContain('User');
    expect(user.profile_pic_url).toBeDefined();
    expect(user.access_token).toBeDefined();
    expect(user.refresh_token).toBeDefined();
    expect(user.token_expires_at).toBeDefined();
    expect(user.created_at).toBeDefined();
    expect(user.updated_at).toBeDefined();
    expect(user.deleted_at).toBeNull();
  });

  test('creates unique users', () => {
    const user1 = createUser();
    const user2 = createUser();
    expect(user1.id).not.toBe(user2.id);
    expect(user1.email).not.toBe(user2.email);
  });

  test('accepts overrides', () => {
    const user = createUser({
      email: 'custom@test.com',
      first_name: 'Custom',
    });
    expect(user.email).toBe('custom@test.com');
    expect(user.first_name).toBe('Custom');
  });
});

describe('factories - createJob', () => {
  beforeEach(() => {
    resetCounter();
  });

  test('creates a job with default values', () => {
    const job = createJob();
    expect(job.id).toBeDefined();
    expect(job.linkedin_job_id).toBeDefined();
    expect(job.title).toContain('Software Engineer');
    expect(job.company).toContain('Tech Corp');
    expect(job.location).toBe('San Francisco, CA');
    expect(job.salary_min).toBe(80000);
    expect(job.salary_max).toBe(150000);
    expect(job.description).toBeDefined();
    expect(job.job_level).toBe('mid');
    expect(job.experience_years).toBe(3);
    expect(job.url).toContain('linkedin.com');
    expect(job.hash).toBeDefined();
  });

  test('accepts overrides', () => {
    const job = createJob({ title: 'Data Scientist', salary_min: 120000 });
    expect(job.title).toBe('Data Scientist');
    expect(job.salary_min).toBe(120000);
  });

  test('accepts zero values for salary', () => {
    const job = createJob({ salary_min: 0, salary_max: 0 });
    expect(job.salary_min).toBe(0);
    expect(job.salary_max).toBe(0);
  });
});

describe('factories - createApplication', () => {
  beforeEach(() => {
    resetCounter();
  });

  test('creates an application with default values', () => {
    const app = createApplication();
    expect(app.id).toBeDefined();
    expect(app.user_id).toBeDefined();
    expect(app.job_id).toBeDefined();
    expect(app.status).toBe('pending');
    expect(app.applied_at).toBeNull();
    expect(app.submission_attempts).toBe(0);
    expect(app.error_message).toBeNull();
    expect(app.resume_version).toBe(1);
  });

  test('accepts overrides', () => {
    const app = createApplication({
      status: 'submitted',
      submission_attempts: 2,
    });
    expect(app.status).toBe('submitted');
    expect(app.submission_attempts).toBe(2);
  });

  test('accepts zero submission attempts', () => {
    const app = createApplication({ submission_attempts: 0 });
    expect(app.submission_attempts).toBe(0);
  });
});

describe('factories - createUserPreference', () => {
  test('creates user preferences with defaults', () => {
    const pref = createUserPreference();
    expect(pref.id).toBeDefined();
    expect(pref.user_id).toBeDefined();
    expect(pref.auto_apply_enabled).toBe(true);
    expect(pref.target_roles).toBeInstanceOf(Array);
    expect(pref.target_locations).toBeInstanceOf(Array);
    expect(pref.min_salary).toBe(80000);
    expect(pref.max_salary).toBe(200000);
    expect(pref.daily_limit).toBe(20);
    expect(pref.notification_enabled).toBe(true);
    expect(pref.email_notifications).toBe(true);
    expect(pref.push_notifications).toBe(false);
  });

  test('accepts overrides', () => {
    const pref = createUserPreference({
      auto_apply_enabled: false,
      daily_limit: 10,
    });
    expect(pref.auto_apply_enabled).toBe(false);
    expect(pref.daily_limit).toBe(10);
  });
});

describe('factories - createBatch', () => {
  beforeEach(() => {
    resetCounter();
  });

  test('creates a batch of users', () => {
    const users = createBatch(createUser, 5);
    expect(users).toHaveLength(5);
    const ids = users.map((u) => u.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  test('creates a batch of jobs', () => {
    const jobs = createBatch(createJob, 3);
    expect(jobs).toHaveLength(3);
  });

  test('creates a batch with overrides', () => {
    const apps = createBatch(createApplication, 4, { status: 'submitted' });
    expect(apps).toHaveLength(4);
    apps.forEach((app) => expect(app.status).toBe('submitted'));
  });

  test('creates empty batch for count 0', () => {
    const batch = createBatch(createUser, 0);
    expect(batch).toHaveLength(0);
  });
});

describe('factories - createJWTPayload', () => {
  test('creates a JWT payload with defaults', () => {
    const payload = createJWTPayload();
    expect(payload.userId).toBeDefined();
    expect(payload.email).toBe('test@example.com');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test('accepts overrides', () => {
    const payload = createJWTPayload({
      userId: 'custom-id',
      email: 'custom@test.com',
    });
    expect(payload.userId).toBe('custom-id');
    expect(payload.email).toBe('custom@test.com');
  });
});

describe('factories - createLinkedInProfile', () => {
  beforeEach(() => {
    resetCounter();
  });

  test('creates a LinkedIn profile with defaults', () => {
    const profile = createLinkedInProfile();
    expect(profile.id).toContain('linkedin_');
    expect(profile.firstName).toBe('Test');
    expect(profile.lastName).toContain('User');
    expect(profile.email).toContain('@example.com');
    expect(profile.profilePicture).toBeDefined();
    expect(profile.headline).toContain('Software Engineer');
  });

  test('accepts overrides', () => {
    const profile = createLinkedInProfile({
      firstName: 'Jane',
      headline: 'Product Manager',
    });
    expect(profile.firstName).toBe('Jane');
    expect(profile.headline).toBe('Product Manager');
  });
});
