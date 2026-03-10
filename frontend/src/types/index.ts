export interface User {
  id: string;
  email: string;
  linkedinId: string;
  firstName: string;
  lastName: string;
  profilePicUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  linkedinJobId: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  jobLevel: string;
  experienceYears: number | null;
  postedAt: string;
  url: string;
  createdAt: string;
}

export type ApplicationStatus =
  | 'pending'
  | 'submitted'
  | 'viewed'
  | 'rejected'
  | 'archived';

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  job?: Job;
  status: ApplicationStatus;
  appliedAt: string | null;
  responseReceivedAt: string | null;
  submissionAttempts: number;
  errorMessage: string | null;
  resumeVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  autoApplyEnabled: boolean;
  targetRoles: string[];
  targetLocations: string[];
  minSalary: number | null;
  maxSalary: number | null;
  experienceLevel: string[];
  excludedCompanies: string[];
  applyIntervalMinutes: number;
  notificationEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  dailyLimit: number;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  code: number;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    timestamp: string;
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface DashboardMetrics {
  totalApplications: number;
  pendingApplications: number;
  viewedApplications: number;
  interviewsScheduled: number;
  offersReceived: number;
  successRate: number;
}
