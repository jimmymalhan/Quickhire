import { apiClient } from './apiClient';
import type { ApiResponse } from '../types';
import type { Resume, ResumeCustomization } from '../types/savedJobs';

export const resumeService = {
  async uploadResume(file: File): Promise<ApiResponse<Resume>> {
    const formData = new FormData();
    formData.append('resume', file);
    const response = await apiClient.post<ApiResponse<Resume>>(
      '/resumes',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  async getResumes(): Promise<ApiResponse<Resume[]>> {
    const response =
      await apiClient.get<ApiResponse<Resume[]>>('/resumes');
    return response.data;
  },

  async customizeForJob(
    resumeId: string,
    jobId: string,
  ): Promise<ApiResponse<ResumeCustomization>> {
    const response = await apiClient.post<ApiResponse<ResumeCustomization>>(
      `/resumes/${resumeId}/customize`,
      { jobId },
    );
    return response.data;
  },

  async previewCustomization(
    resumeId: string,
    jobId: string,
  ): Promise<ApiResponse<ResumeCustomization>> {
    const response = await apiClient.get<ApiResponse<ResumeCustomization>>(
      `/resumes/${resumeId}/preview`,
      { params: { jobId } },
    );
    return response.data;
  },

  async deleteResume(id: string): Promise<void> {
    await apiClient.delete(`/resumes/${id}`);
  },

  async generateCoverLetter(
    resumeId: string,
    jobId: string,
  ): Promise<ApiResponse<{ coverLetter: string }>> {
    const response = await apiClient.post<
      ApiResponse<{ coverLetter: string }>
    >(`/resumes/${resumeId}/cover-letter`, { jobId });
    return response.data;
  },
};
