import { apiClient } from './apiClient';
import type { Job, PaginatedResponse } from '../types';

export interface JobSearchParams {
  query?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  experienceLevel?: string;
  sortBy?: 'newest' | 'relevance' | 'salary';
  page?: number;
  pageSize?: number;
}

export const jobService = {
  async searchJobs(params: JobSearchParams): Promise<PaginatedResponse<Job>> {
    const response = await apiClient.get<PaginatedResponse<Job>>('/jobs', {
      params,
    });
    return response.data;
  },

  async getJob(id: string): Promise<Job> {
    const response = await apiClient.get<{ data: Job }>(`/jobs/${id}`);
    return response.data.data;
  },

  async getRecommendedJobs(
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResponse<Job>> {
    const response = await apiClient.get<PaginatedResponse<Job>>(
      '/jobs/recommended',
      { params: { page, pageSize } },
    );
    return response.data;
  },

  async bookmarkJob(jobId: string): Promise<void> {
    await apiClient.post(`/jobs/${jobId}/bookmark`);
  },

  async removeBookmark(jobId: string): Promise<void> {
    await apiClient.delete(`/jobs/${jobId}/bookmark`);
  },
};
