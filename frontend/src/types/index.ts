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

export type RuntimeTaskStatus = 'queued' | 'in_progress' | 'blocked' | 'done';
export type RuntimeSessionStatus = 'running' | 'idle' | 'stalled';
export type RuntimeBlockerSeverity = 'low' | 'medium' | 'high';
export type ExecutiveRole = 'ceo' | 'cto' | 'director' | 'manager' | 'engineer';

export interface RuntimeTask {
  id: string;
  title: string;
  status: RuntimeTaskStatus;
  progress: number;
  owner: string;
  etaMinutes: number | null;
  blockerId?: string | null;
}

export interface RuntimeSession {
  id: string;
  owner: string;
  model: string;
  status: RuntimeSessionStatus;
  currentTask: string;
  startedAt: string;
  lastHeartbeatAt: string;
}

export interface RuntimeBlocker {
  id: string;
  title: string;
  severity: RuntimeBlockerSeverity;
  etaMinutes: number;
  options: string[];
  assignedTo?: string;
}

export interface ExecutiveDecision {
  id: string;
  role: ExecutiveRole;
  owner: string;
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  outcome?: string;
}

export interface RuntimeProgressSnapshot {
  generatedAt: string;
  overallProgress: number;
  remainingPercent: number;
  blockerCount: number;
  etaTotalMinutes: number;
  tasks: RuntimeTask[];
  sessions: RuntimeSession[];
  blockers: RuntimeBlocker[];
  upcomingTasks: string[];
  completedWorkflows: string[];
  executiveDecisions: ExecutiveDecision[];
  resourceUsage: {
    cpuPercent: number;
    memoryPercent: number;
    cpuThreshold: number;
    memoryThreshold: number;
  };
  lessons: string[];
  decisions: string[];
  roiMetrics: {
    tasksCompletedPerHour: number;
    blockersResolvedPerHour: number;
    localAgentUtilization: number;
    cloudApiCallsSaved: number;
  };
  source?: {
    provider: string;
    stateDir: string;
    connected: boolean;
  };
}
