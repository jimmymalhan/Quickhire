import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applicationService } from '../applicationService';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

describe('applicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getApplications', () => {
    it('calls GET /applications with params', async () => {
      mockedGet.mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, timestamp: '' } } } as never);

      await applicationService.getApplications({ status: 'pending' });

      expect(mockedGet).toHaveBeenCalledWith('/applications', { params: { status: 'pending' } });
    });

    it('returns paginated response', async () => {
      const apps = [{ id: 'a1' }];
      mockedGet.mockResolvedValue({ data: { data: apps, meta: { total: 1 } } } as never);

      const result = await applicationService.getApplications({});
      expect(result.data).toEqual(apps);
    });

    it('passes all filter params', async () => {
      mockedGet.mockResolvedValue({ data: { data: [] } } as never);

      await applicationService.getApplications({
        status: 'submitted',
        company: 'Google',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        sortBy: 'date',
        page: 2,
        pageSize: 50,
      });

      expect(mockedGet).toHaveBeenCalledWith('/applications', {
        params: {
          status: 'submitted',
          company: 'Google',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          sortBy: 'date',
          page: 2,
          pageSize: 50,
        },
      });
    });
  });

  describe('getApplication', () => {
    it('calls GET /applications/:id', async () => {
      const app = { id: 'a1', status: 'pending' };
      mockedGet.mockResolvedValue({ data: { data: app } } as never);

      const result = await applicationService.getApplication('a1');

      expect(mockedGet).toHaveBeenCalledWith('/applications/a1');
      expect(result).toEqual(app);
    });
  });

  describe('applyToJob', () => {
    it('calls POST /applications with jobId', async () => {
      const app = { id: 'a1', jobId: 'j1', status: 'pending' };
      mockedPost.mockResolvedValue({ data: { data: app } } as never);

      const result = await applicationService.applyToJob('j1');

      expect(mockedPost).toHaveBeenCalledWith('/applications', { jobId: 'j1' });
      expect(result).toEqual(app);
    });
  });

  describe('bulkArchive', () => {
    it('calls POST /applications/bulk-archive', async () => {
      mockedPost.mockResolvedValue({} as never);

      await applicationService.bulkArchive(['a1', 'a2']);

      expect(mockedPost).toHaveBeenCalledWith('/applications/bulk-archive', { applicationIds: ['a1', 'a2'] });
    });
  });

  describe('bulkRetry', () => {
    it('calls POST /applications/bulk-retry', async () => {
      mockedPost.mockResolvedValue({} as never);

      await applicationService.bulkRetry(['a1', 'a3']);

      expect(mockedPost).toHaveBeenCalledWith('/applications/bulk-retry', { applicationIds: ['a1', 'a3'] });
    });
  });

  describe('exportCsv', () => {
    it('calls GET /applications/export with blob response', async () => {
      const blob = new Blob(['csv']);
      mockedGet.mockResolvedValue({ data: blob } as never);

      const result = await applicationService.exportCsv({ status: 'submitted' });

      expect(mockedGet).toHaveBeenCalledWith('/applications/export', {
        params: { status: 'submitted' },
        responseType: 'blob',
      });
      expect(result).toBe(blob);
    });
  });
});
