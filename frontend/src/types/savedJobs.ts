import type { Job } from './index';

export type SavedJobPriority = 'high' | 'medium' | 'low';
export type SavedJobStatus = 'saved' | 'applied' | 'skipped';
export type AutoApplyState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface SavedJob {
  id: string;
  jobId: string;
  job: Job;
  notes: string;
  priority: SavedJobPriority;
  status: SavedJobStatus;
  customResumeId: string | null;
  savedAt: string;
  updatedAt: string;
}

export interface SavedJobFilters {
  status?: SavedJobStatus;
  priority?: SavedJobPriority;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'savedAt' | 'priority' | 'company' | 'title';
  page?: number;
  pageSize?: number;
}

export interface SavedJobStats {
  totalSaved: number;
  applied: number;
  skipped: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
}

export interface AutoApplyProgress {
  state: AutoApplyState;
  totalJobs: number;
  processedJobs: number;
  successCount: number;
  failCount: number;
  skippedCount: number;
  currentJob: Pick<Job, 'id' | 'title' | 'company'> | null;
  etaSeconds: number | null;
  startedAt: string | null;
  error: string | null;
}

export interface ResumeCustomization {
  id: string;
  resumeId: string;
  jobId: string;
  originalFileName: string;
  customizedFileName: string;
  keywordMatches: string[];
  fitScore: number;
  coverLetter: string | null;
  createdAt: string;
}

export interface Resume {
  id: string;
  fileName: string;
  uploadedAt: string;
  isDefault: boolean;
  fileSize: number;
}
