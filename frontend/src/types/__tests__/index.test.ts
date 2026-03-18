import { describe, it, expect } from 'vitest';
import type {
  User,
  Job,
  Application,
  ApplicationStatus,
  UserPreferences,
  ApiResponse,
  PaginatedResponse,
  AuthTokens,
  DashboardMetrics,
} from '../index';

describe('Type definitions', () => {
  it('User type has expected shape', () => {
    const user: User = {
      id: '1',
      email: 'test@test.com',
      linkedinId: 'li-1',
      firstName: 'John',
      lastName: 'Doe',
      profilePicUrl: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(user.id).toBe('1');
    expect(user.email).toBe('test@test.com');
    expect(user.profilePicUrl).toBeNull();
  });

  it('Job type has expected shape', () => {
    const job: Job = {
      id: '1',
      linkedinJobId: 'li-j1',
      title: 'Engineer',
      company: 'Corp',
      location: 'Remote',
      salaryMin: 80000,
      salaryMax: 150000,
      description: 'Desc',
      jobLevel: 'Senior',
      experienceYears: 5,
      postedAt: '2024-01-01',
      url: 'https://example.com',
      createdAt: '2024-01-01',
    };
    expect(job.title).toBe('Engineer');
    expect(job.salaryMin).toBe(80000);
  });

  it('Application type has expected shape', () => {
    const app: Application = {
      id: '1',
      userId: 'u1',
      jobId: 'j1',
      status: 'pending',
      appliedAt: null,
      responseReceivedAt: null,
      submissionAttempts: 0,
      errorMessage: null,
      resumeVersion: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(app.status).toBe('pending');
    expect(app.submissionAttempts).toBe(0);
  });

  it('ApplicationStatus includes all values', () => {
    const statuses: ApplicationStatus[] = ['pending', 'submitted', 'viewed', 'rejected', 'archived'];
    expect(statuses).toHaveLength(5);
  });

  it('UserPreferences type has expected shape', () => {
    const prefs: UserPreferences = {
      id: '1',
      userId: 'u1',
      autoApplyEnabled: true,
      targetRoles: ['Engineer'],
      targetLocations: ['Remote'],
      minSalary: 80000,
      maxSalary: null,
      experienceLevel: ['Senior'],
      excludedCompanies: [],
      applyIntervalMinutes: 30,
      notificationEnabled: true,
      emailNotifications: true,
      pushNotifications: false,
      dailyLimit: 20,
    };
    expect(prefs.autoApplyEnabled).toBe(true);
    expect(prefs.targetRoles).toContain('Engineer');
  });

  it('ApiResponse type has expected shape', () => {
    const response: ApiResponse<string> = {
      status: 'success',
      code: 200,
      data: 'hello',
    };
    expect(response.status).toBe('success');
    expect(response.data).toBe('hello');
  });

  it('ApiResponse error shape', () => {
    const response: ApiResponse<null> = {
      status: 'error',
      code: 400,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: ['field required'],
      },
    };
    expect(response.error?.code).toBe('VALIDATION_ERROR');
  });

  it('PaginatedResponse type has meta', () => {
    const response: PaginatedResponse<string> = {
      status: 'success',
      code: 200,
      data: ['a', 'b'],
      meta: {
        timestamp: '2024-01-01',
        page: 1,
        pageSize: 20,
        total: 2,
      },
    };
    expect(response.meta.total).toBe(2);
  });

  it('AuthTokens type has expected shape', () => {
    const tokens: AuthTokens = {
      accessToken: 'abc',
      refreshToken: 'def',
      expiresAt: '2024-12-31',
    };
    expect(tokens.accessToken).toBe('abc');
  });

  it('DashboardMetrics type has expected shape', () => {
    const metrics: DashboardMetrics = {
      totalApplications: 100,
      pendingApplications: 30,
      viewedApplications: 45,
      interviewsScheduled: 10,
      offersReceived: 5,
      successRate: 15.5,
    };
    expect(metrics.totalApplications).toBe(100);
    expect(metrics.successRate).toBe(15.5);
  });
});
