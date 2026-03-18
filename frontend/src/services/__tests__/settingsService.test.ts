import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingsService } from '../settingsService';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPut = vi.mocked(apiClient.put);
const mockedPost = vi.mocked(apiClient.post);
const mockedDelete = vi.mocked(apiClient.delete);

describe('settingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('calls GET /settings/profile', async () => {
      const user = { id: '1', firstName: 'John' };
      mockedGet.mockResolvedValue({ data: { data: user } } as never);

      const result = await settingsService.getProfile();

      expect(mockedGet).toHaveBeenCalledWith('/settings/profile');
      expect(result).toEqual(user);
    });
  });

  describe('updateProfile', () => {
    it('calls PUT /settings/profile with data', async () => {
      const user = { id: '1', firstName: 'Jane' };
      mockedPut.mockResolvedValue({ data: { data: user } } as never);

      const result = await settingsService.updateProfile({ firstName: 'Jane' });

      expect(mockedPut).toHaveBeenCalledWith('/settings/profile', { firstName: 'Jane' });
      expect(result).toEqual(user);
    });
  });

  describe('getPreferences', () => {
    it('calls GET /settings/preferences', async () => {
      const prefs = { autoApplyEnabled: true };
      mockedGet.mockResolvedValue({ data: { data: prefs } } as never);

      const result = await settingsService.getPreferences();

      expect(mockedGet).toHaveBeenCalledWith('/settings/preferences');
      expect(result).toEqual(prefs);
    });
  });

  describe('updatePreferences', () => {
    it('calls PUT /settings/preferences', async () => {
      const prefs = { autoApplyEnabled: false };
      mockedPut.mockResolvedValue({ data: { data: prefs } } as never);

      const result = await settingsService.updatePreferences({ autoApplyEnabled: false });

      expect(mockedPut).toHaveBeenCalledWith('/settings/preferences', { autoApplyEnabled: false });
      expect(result).toEqual(prefs);
    });
  });

  describe('uploadResume', () => {
    it('calls POST /settings/resume with FormData', async () => {
      const response = { url: '/uploads/resume.pdf', version: 2 };
      mockedPost.mockResolvedValue({ data: { data: response } } as never);

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
      const result = await settingsService.uploadResume(file);

      expect(mockedPost).toHaveBeenCalledWith(
        '/settings/resume',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      expect(result).toEqual(response);
    });
  });

  describe('deleteAccount', () => {
    it('calls DELETE /settings/account', async () => {
      mockedDelete.mockResolvedValue({} as never);

      await settingsService.deleteAccount();

      expect(mockedDelete).toHaveBeenCalledWith('/settings/account');
    });
  });
});
