import { apiClient } from './apiClient';
import type { User, UserPreferences } from '../types';

export const settingsService = {
  async getProfile(): Promise<User> {
    const response = await apiClient.get<{ data: User }>('/settings/profile');
    return response.data.data;
  },

  async updateProfile(
    data: Partial<Pick<User, 'firstName' | 'lastName' | 'email'>>,
  ): Promise<User> {
    const response = await apiClient.put<{ data: User }>(
      '/settings/profile',
      data,
    );
    return response.data.data;
  },

  async getPreferences(): Promise<UserPreferences> {
    const response = await apiClient.get<{ data: UserPreferences }>(
      '/settings/preferences',
    );
    return response.data.data;
  },

  async updatePreferences(
    data: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const response = await apiClient.put<{ data: UserPreferences }>(
      '/settings/preferences',
      data,
    );
    return response.data.data;
  },

  async uploadResume(file: File): Promise<{ url: string; version: number }> {
    const formData = new FormData();
    formData.append('resume', file);
    const response = await apiClient.post<{
      data: { url: string; version: number };
    }>('/settings/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async deleteAccount(): Promise<void> {
    await apiClient.delete('/settings/account');
  },
};
