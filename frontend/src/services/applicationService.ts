import { apiClient } from './apiClient';
import type {
  Application,
  ApplicationStatus,
  PaginatedResponse,
} from '../types';

export interface ApplicationSearchParams {
  status?: ApplicationStatus;
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'date' | 'status' | 'company';
  page?: number;
  pageSize?: number;
}

export const applicationService = {
  async getApplications(
    params: ApplicationSearchParams,
  ): Promise<PaginatedResponse<Application>> {
    const response = await apiClient.get<PaginatedResponse<Application>>(
      '/applications',
      { params },
    );
    return response.data;
  },

  async getApplication(id: string): Promise<Application> {
    const response = await apiClient.get<{ data: Application }>(
      `/applications/${id}`,
    );
    return response.data.data;
  },

  async applyToJob(jobId: string): Promise<Application> {
    const response = await apiClient.post<{ data: Application }>(
      '/applications',
      { jobId },
    );
    return response.data.data;
  },

  async bulkArchive(applicationIds: string[]): Promise<void> {
    await apiClient.post('/applications/bulk-archive', { applicationIds });
  },

  async bulkRetry(applicationIds: string[]): Promise<void> {
    await apiClient.post('/applications/bulk-retry', { applicationIds });
  },

  async exportCsv(params: ApplicationSearchParams): Promise<Blob> {
    const response = await apiClient.get('/applications/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};
