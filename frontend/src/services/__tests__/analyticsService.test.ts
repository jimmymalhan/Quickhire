import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsService } from '../analyticsService';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../apiClient';

const mockedGet = vi.mocked(apiClient.get);

describe('analyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAnalytics', () => {
    it('calls GET /analytics with date params', async () => {
      const mockData = { metrics: {}, applicationTimeline: [] };
      mockedGet.mockResolvedValue({ data: { data: mockData } } as never);

      const result = await analyticsService.getAnalytics('2024-01-01', '2024-12-31');

      expect(mockedGet).toHaveBeenCalledWith('/analytics', {
        params: { dateFrom: '2024-01-01', dateTo: '2024-12-31' },
      });
      expect(result).toEqual(mockData);
    });

    it('calls without date params', async () => {
      mockedGet.mockResolvedValue({ data: { data: {} } } as never);

      await analyticsService.getAnalytics();

      expect(mockedGet).toHaveBeenCalledWith('/analytics', {
        params: { dateFrom: undefined, dateTo: undefined },
      });
    });
  });

  describe('getMetrics', () => {
    it('calls GET /analytics/metrics', async () => {
      const metrics = { totalApplications: 100 };
      mockedGet.mockResolvedValue({ data: { data: metrics } } as never);

      const result = await analyticsService.getMetrics();

      expect(mockedGet).toHaveBeenCalledWith('/analytics/metrics');
      expect(result).toEqual(metrics);
    });
  });

  describe('exportReport', () => {
    it('calls GET /analytics/export with pdf format', async () => {
      const blob = new Blob(['pdf']);
      mockedGet.mockResolvedValue({ data: blob } as never);

      const result = await analyticsService.exportReport('pdf', '2024-01-01', '2024-06-30');

      expect(mockedGet).toHaveBeenCalledWith('/analytics/export', {
        params: { format: 'pdf', dateFrom: '2024-01-01', dateTo: '2024-06-30' },
        responseType: 'blob',
      });
      expect(result).toBe(blob);
    });

    it('calls with csv format', async () => {
      const blob = new Blob(['csv']);
      mockedGet.mockResolvedValue({ data: blob } as never);

      await analyticsService.exportReport('csv');

      expect(mockedGet).toHaveBeenCalledWith('/analytics/export', {
        params: { format: 'csv', dateFrom: undefined, dateTo: undefined },
        responseType: 'blob',
      });
    });
  });
});
