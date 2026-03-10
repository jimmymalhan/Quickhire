/**
 * Integration tests for database models.
 * Tests User, Job, Application, and UserPreference models with mocked DB.
 */

// Mock database connection
jest.mock('../../../src/database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn() },
}));

const { query } = require('../../../src/database/connection');
const User = require('../../../src/database/models/User');
const Job = require('../../../src/database/models/Job');
const Application = require('../../../src/database/models/Application');
const UserPreference = require('../../../src/database/models/UserPreference');

const { createUser, createJob, createApplication } = require('../../factories');

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// User Model
// ============================================================
describe('Integration - User Model', () => {
  describe('findById', () => {
    test('returns user when found', async () => {
      const mockUser = createUser();
      query.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      const result = await User.findById(mockUser.id);
      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = $1'),
        [mockUser.id]
      );
    });

    test('returns null when user not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await User.findById('nonexistent-id');
      expect(result).toBeNull();
    });

    test('filters out soft-deleted users', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      await User.findById('deleted-user-id');
      expect(query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    });
  });

  describe('findByEmail', () => {
    test('returns user when found by email', async () => {
      const mockUser = createUser({ email: 'test@example.com' });
      query.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      const result = await User.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('email = $1'),
        ['test@example.com']
      );
    });

    test('returns null when email not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await User.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findByLinkedInId', () => {
    test('returns user when found by LinkedIn ID', async () => {
      const mockUser = createUser({ linkedin_id: 'li_123' });
      query.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      const result = await User.findByLinkedInId('li_123');
      expect(result).toEqual(mockUser);
    });

    test('returns null when LinkedIn ID not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await User.findByLinkedInId('li_unknown');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('creates a new user', async () => {
      const userData = {
        email: 'new@example.com',
        linkedinId: 'li_new',
        firstName: 'New',
        lastName: 'User',
        profilePicUrl: 'https://pic.com/new.jpg',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        tokenExpiresAt: new Date().toISOString(),
      };
      const mockResult = createUser(userData);
      query.mockResolvedValue({ rows: [mockResult], rowCount: 1 });

      const result = await User.create(userData);
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([userData.email, userData.linkedinId])
      );
    });
  });

  describe('update', () => {
    test('updates user fields', async () => {
      const mockUser = createUser({ first_name: 'Updated' });
      query.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      const result = await User.update('user-id', { first_name: 'Updated' });
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['user-id', 'Updated'])
      );
    });

    test('returns null when user not found for update', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await User.update('nonexistent', { first_name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    test('soft deletes a user', async () => {
      const mockUser = createUser({ deleted_at: new Date().toISOString() });
      query.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      const result = await User.softDelete('user-id');
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SET deleted_at = NOW()'),
        ['user-id']
      );
    });

    test('returns null when user not found for deletion', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await User.softDelete('nonexistent');
      expect(result).toBeNull();
    });
  });
});

// ============================================================
// Job Model
// ============================================================
describe('Integration - Job Model', () => {
  describe('findById', () => {
    test('returns job when found', async () => {
      const mockJob = createJob();
      query.mockResolvedValue({ rows: [mockJob], rowCount: 1 });

      const result = await Job.findById(mockJob.id);
      expect(result).toEqual(mockJob);
    });

    test('returns null when job not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await Job.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByLinkedInJobId', () => {
    test('returns job by LinkedIn job ID', async () => {
      const mockJob = createJob({ linkedin_job_id: 'li_job_1' });
      query.mockResolvedValue({ rows: [mockJob], rowCount: 1 });

      const result = await Job.findByLinkedInJobId('li_job_1');
      expect(result).toEqual(mockJob);
    });
  });

  describe('findByHash', () => {
    test('returns job by hash', async () => {
      const mockJob = createJob({ hash: 'abc123' });
      query.mockResolvedValue({ rows: [mockJob], rowCount: 1 });

      const result = await Job.findByHash('abc123');
      expect(result).toEqual(mockJob);
    });
  });

  describe('search', () => {
    test('searches with no filters', async () => {
      const mockJobs = [createJob(), createJob()];
      query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: mockJobs }); // data query

      const result = await Job.search({});
      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('searches with title filter', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createJob({ title: 'React Developer' })] });

      const result = await Job.search({ title: 'React' });
      expect(result.total).toBe(1);
      expect(query.mock.calls[0][0]).toContain('ILIKE');
    });

    test('searches with company filter', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createJob({ company: 'Google' })] });

      const result = await Job.search({ company: 'Google' });
      expect(result.total).toBe(1);
    });

    test('searches with location filter', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createJob()] });

      await Job.search({ location: 'Remote' });
      expect(query.mock.calls[0][1]).toContain('%Remote%');
    });

    test('searches with salary range', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createJob()] });

      await Job.search({ salaryMin: 80000, salaryMax: 150000 });
      expect(query.mock.calls[0][0]).toContain('salary_max >=');
      expect(query.mock.calls[0][0]).toContain('salary_min <=');
    });

    test('searches with job level filter', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createJob()] });

      await Job.search({ jobLevel: 'senior' });
      expect(query.mock.calls[0][0]).toContain('job_level =');
    });

    test('respects pagination', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [createJob()] });

      const result = await Job.search({ page: 3, limit: 10 });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    test('combines multiple filters', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createJob()] });

      await Job.search({ title: 'Engineer', location: 'SF', jobLevel: 'mid' });
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('ILIKE');
      expect(sql).toContain('job_level =');
    });
  });

  describe('create', () => {
    test('creates a new job', async () => {
      const jobData = {
        linkedinJobId: 'li_new',
        title: 'New Job',
        company: 'Company',
        location: 'Remote',
        salaryMin: 80000,
        salaryMax: 150000,
        description: 'Description',
        jobLevel: 'mid',
        experienceYears: 3,
        postedAt: new Date().toISOString(),
        scrapeDate: new Date().toISOString(),
        url: 'https://linkedin.com/jobs/1',
        hash: 'unique-hash',
      };
      const mockJob = createJob();
      query.mockResolvedValue({ rows: [mockJob], rowCount: 1 });

      const result = await Job.create(jobData);
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO jobs'),
        expect.any(Array)
      );
    });

    test('returns null on duplicate hash (ON CONFLICT DO NOTHING)', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await Job.create({ hash: 'existing-hash' });
      expect(result).toBeNull();
    });
  });

  describe('bulkCreate', () => {
    test('creates multiple jobs', async () => {
      const jobs = [
        { hash: 'h1', title: 'Job 1' },
        { hash: 'h2', title: 'Job 2' },
      ];
      const mockJob1 = createJob();
      const mockJob2 = createJob();
      query
        .mockResolvedValueOnce({ rows: [mockJob1], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockJob2], rowCount: 1 });

      const results = await Job.bulkCreate(jobs);
      expect(results).toHaveLength(2);
    });

    test('skips duplicate jobs in bulk create', async () => {
      query
        .mockResolvedValueOnce({ rows: [createJob()], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // duplicate

      const results = await Job.bulkCreate([
        { hash: 'h1' },
        { hash: 'h1' }, // duplicate
      ]);
      expect(results).toHaveLength(1);
    });
  });
});

// ============================================================
// Application Model
// ============================================================
describe('Integration - Application Model', () => {
  describe('findById', () => {
    test('returns application with job details', async () => {
      const mockApp = {
        ...createApplication(),
        job_title: 'Engineer',
        job_company: 'Corp',
        job_location: 'Remote',
      };
      query.mockResolvedValue({ rows: [mockApp], rowCount: 1 });

      const result = await Application.findById(mockApp.id);
      expect(result).toEqual(mockApp);
      expect(query.mock.calls[0][0]).toContain('JOIN jobs');
    });

    test('returns null when not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await Application.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    test('returns applications for a user', async () => {
      const mockApps = [createApplication(), createApplication()];
      query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: mockApps });

      const result = await Application.findByUserId('user-123');
      expect(result.applications).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('filters by status', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [createApplication({ status: 'submitted' })] });

      const result = await Application.findByUserId('user-123', { status: 'submitted' });
      expect(result.total).toBe(1);
    });

    test('respects pagination', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await Application.findByUserId('user-123', { page: 2, limit: 10 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe('create', () => {
    test('creates a new application', async () => {
      const mockApp = createApplication({ status: 'pending' });
      query.mockResolvedValue({ rows: [mockApp], rowCount: 1 });

      const result = await Application.create({
        userId: 'user-1',
        jobId: 'job-1',
        resumeVersion: 1,
      });
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO applications'),
        expect.any(Array)
      );
    });

    test('returns null on duplicate application', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await Application.create({ userId: 'u', jobId: 'j' });
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    test('updates application status', async () => {
      const mockApp = createApplication({ status: 'submitted' });
      query.mockResolvedValue({ rows: [mockApp], rowCount: 1 });

      const result = await Application.updateStatus('app-1', 'submitted');
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE applications'),
        ['app-1', 'submitted', null]
      );
    });

    test('updates status with error message', async () => {
      const mockApp = createApplication({ status: 'rejected', error_message: 'Invalid resume' });
      query.mockResolvedValue({ rows: [mockApp], rowCount: 1 });

      const result = await Application.updateStatus('app-1', 'rejected', 'Invalid resume');
      expect(result).toBeDefined();
    });

    test('returns null when application not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await Application.updateStatus('nonexistent', 'submitted');
      expect(result).toBeNull();
    });
  });

  describe('countTodayByUser', () => {
    test('returns count of today submissions', async () => {
      query.mockResolvedValue({ rows: [{ count: '5' }] });
      const result = await Application.countTodayByUser('user-1');
      expect(result).toBe(5);
      expect(query.mock.calls[0][0]).toContain('CURRENT_DATE');
    });

    test('returns 0 when no submissions today', async () => {
      query.mockResolvedValue({ rows: [{ count: '0' }] });
      const result = await Application.countTodayByUser('user-1');
      expect(result).toBe(0);
    });
  });
});

// ============================================================
// UserPreference Model
// ============================================================
describe('Integration - UserPreference Model', () => {
  describe('findByUserId', () => {
    test('returns preferences for a user', async () => {
      const mockPref = {
        user_id: 'user-1',
        auto_apply_enabled: true,
        daily_limit: 20,
      };
      query.mockResolvedValue({ rows: [mockPref], rowCount: 1 });

      const result = await UserPreference.findByUserId('user-1');
      expect(result).toEqual(mockPref);
    });

    test('returns null when preferences not found', async () => {
      query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await UserPreference.findByUserId('user-1');
      expect(result).toBeNull();
    });
  });

  describe('createOrUpdate', () => {
    test('creates new preferences', async () => {
      const mockPref = { user_id: 'user-1', auto_apply_enabled: true };
      query.mockResolvedValue({ rows: [mockPref], rowCount: 1 });

      const result = await UserPreference.createOrUpdate('user-1', {
        autoApplyEnabled: true,
        targetRoles: ['Engineer'],
        targetLocations: ['Remote'],
        minSalary: 80000,
        maxSalary: 200000,
        experienceLevel: ['mid'],
        excludedCompanies: [],
        applyIntervalMinutes: 60,
        notificationEnabled: true,
        emailNotifications: true,
        pushNotifications: false,
        dailyLimit: 20,
      });
      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_preferences'),
        expect.any(Array)
      );
    });

    test('updates existing preferences (upsert)', async () => {
      const mockPref = { user_id: 'user-1', daily_limit: 30 };
      query.mockResolvedValue({ rows: [mockPref], rowCount: 1 });

      const result = await UserPreference.createOrUpdate('user-1', {
        dailyLimit: 30,
      });
      expect(result).toBeDefined();
      expect(query.mock.calls[0][0]).toContain('ON CONFLICT');
    });
  });
});
