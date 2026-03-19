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
export type RuntimeAgentStatus = 'healthy' | 'degraded' | 'stalled' | 'offline' | 'unknown';
export type RuntimeOrgTeamStatus = 'idle' | 'running' | 'blocked';

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
  role?: string;
  provider?: string;
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

export interface RuntimeOrchestrationCommand {
  id: string;
  label: string;
  action: string;
  scope: string;
  requestedBy: string;
  target: string;
  value: unknown;
  status: string;
  createdAt: string;
}

export interface RuntimeToolLink {
  id: string;
  label: string;
  href: string;
  category: string;
}

export interface RuntimeAgentReplica {
  id: string;
  name: string;
  role: string;
  team: string;
  scope: string;
  owner: string;
  status: RuntimeAgentStatus;
  recentFailures: number;
  recentSuccesses: number;
  totalRecentRuns: number;
  minutesSinceSuccess: number | null;
  checkedAt: string | null;
  active: boolean;
  provider: string;
  model: string;
  lane: string;
  isPrimary: boolean;
}

export interface RuntimeOrgTeam {
  id: string;
  name: string;
  lead: string;
  scope: string;
  status: RuntimeOrgTeamStatus;
  replicaCount: number;
  healthyReplicas: number;
  activeSessions: number;
  activeTasks: number;
  blockedTasks: number;
  workLeftPercent: number;
  etaMinutes: number | null;
  agents: RuntimeAgentReplica[];
}

export interface RuntimeOrgChainNode {
  role: ExecutiveRole | 'engineer';
  owner: string;
  focus: string;
  status: string;
}

export interface RuntimeOrgCapacityBand {
  minPercent: number;
  targetPercent: number;
  maxPercent: number;
  currentPercent: number;
  activeAgents: number;
  healthyAgents: number;
  totalAgents: number;
}

export interface RuntimeOrgFailover {
  enabled: boolean;
  takeoverEnabled: boolean;
  primaryLane: string;
  fallbackLane: string;
  hotStandby: string[];
  replicas: number;
}

export interface RuntimeOrgChart {
  capacityBand: RuntimeOrgCapacityBand;
  roleChain: RuntimeOrgChainNode[];
  teams: RuntimeOrgTeam[];
  replicas: RuntimeAgentReplica[];
  failover: RuntimeOrgFailover;
}

export interface RuntimeOrchestration {
  schemaVersion: string;
  controller: {
    mode: string;
    owner: string;
    preferredProvider: string;
    preferredLane: string;
    targetAgentScale: number;
    maxAgentScale: number;
    mainSessionCapPercent: number;
    cloudFallbackEnabled: boolean;
    takeoverEnabled: boolean;
    backlogStrategy: string;
    status: string;
    updatedAt: string;
  };
  guardrails: {
    cpuLimitPercent: number;
    memoryLimitPercent: number;
    requireApprovalForDestructive: boolean;
    autoRestoreDryRun: boolean;
    roiKillSwitch: boolean;
  };
  pendingCommands: RuntimeOrchestrationCommand[];
  toolLinks: RuntimeToolLink[];
  lastCommandAt: string | null;
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
  project?: {
    name: string;
    currentStage: string | null;
    status: string;
    percent: number;
    remainingPercent: number;
    stageCount: number;
    completedStageCount: number;
    activeStageCount: number;
    blockedStageCount: number;
    etaMinutes: number | null;
    startedAt: string | null;
    updatedAt: string | null;
  };
  projectProgress?: {
    totalStages: number;
    completedStageCount: number;
    activeStageCount: number;
    blockedStageCount: number;
    remainingStageCount: number;
    status: string;
    currentStage: string | null;
  };
  overallProgress: number;
  remainingPercent: number;
  workLeftPercent?: number;
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
  orchestration: RuntimeOrchestration;
  orgChart: RuntimeOrgChart;
  source?: {
    provider: string;
    stateDir: string;
    connected: boolean;
    refreshIntervalMs?: number;
    schemaVersion?: string;
    files?: Record<string, string>;
    fields?: Record<string, string>;
    capturedAt?: string;
  };
}
