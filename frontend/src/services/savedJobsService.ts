import { apiClient } from './apiClient';
import type { ApiResponse, PaginatedResponse } from '../types';
import type {
  SavedJob,
  SavedJobFilters,
  SavedJobStats,
  AutoApplyProgress,
} from '../types/savedJobs';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface SaveJobData {
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
  customResumeId?: string;
}

export interface BulkApplyOptions {
  customResumeId?: string;
  delayBetweenMs?: number;
  skipAlreadyApplied?: boolean;
}

export const savedJobsService = {
  async getSavedJobs(
    filters: SavedJobFilters,
  ): Promise<PaginatedResponse<SavedJob>> {
    const response = await apiClient.get<PaginatedResponse<SavedJob>>(
      '/saved-jobs',
      { params: filters },
    );
    return response.data;
  },

  async saveJob(
    jobId: string,
    data?: SaveJobData,
  ): Promise<ApiResponse<SavedJob>> {
    const response = await apiClient.post<ApiResponse<SavedJob>>(
      '/saved-jobs',
      { jobId, ...data },
    );
    return response.data;
  },

  async updateSavedJob(
    id: string,
    data: Partial<SaveJobData>,
  ): Promise<ApiResponse<SavedJob>> {
    const response = await apiClient.patch<ApiResponse<SavedJob>>(
      `/saved-jobs/${id}`,
      data,
    );
    return response.data;
  },

  async removeSavedJob(id: string): Promise<void> {
    await apiClient.delete(`/saved-jobs/${id}`);
  },

  async getSavedJobStats(): Promise<ApiResponse<SavedJobStats>> {
    const response = await apiClient.get<ApiResponse<SavedJobStats>>(
      '/saved-jobs/stats',
    );
    return response.data;
  },

  async startBulkApply(
    jobIds: string[],
    options?: BulkApplyOptions,
  ): Promise<ApiResponse<{ sessionId: string }>> {
    const response = await apiClient.post<
      ApiResponse<{ sessionId: string }>
    >('/saved-jobs/bulk-apply', { jobIds, ...options });
    return response.data;
  },

  streamAutoApplyProgress(
    onMessage: (progress: AutoApplyProgress) => void,
    onError?: () => void,
  ) {
    const source = new EventSource(`${BASE_URL}/saved-jobs/auto-apply/stream`);

    source.addEventListener('progress', (event) => {
      const messageEvent = event as MessageEvent<string>;
      onMessage(JSON.parse(messageEvent.data) as AutoApplyProgress);
    });

    source.addEventListener('complete', (event) => {
      const messageEvent = event as MessageEvent<string>;
      onMessage(JSON.parse(messageEvent.data) as AutoApplyProgress);
      source.close();
    });

    source.onerror = () => {
      source.close();
      if (onError) {
        onError();
      }
    };

    return () => {
      source.close();
    };
  },

  async pauseAutoApply(): Promise<void> {
    await apiClient.post('/saved-jobs/auto-apply/pause');
  },

  async resumeAutoApply(): Promise<void> {
    await apiClient.post('/saved-jobs/auto-apply/resume');
  },

  async cancelAutoApply(): Promise<void> {
    await apiClient.post('/saved-jobs/auto-apply/cancel');
  },
};
