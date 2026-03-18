import { apiClient } from './apiClient';
import type { DashboardMetrics } from '../types';

export interface TimeSeriesData {
  date: string;
  count: number;
}

export interface DistributionData {
  label: string;
  value: number;
}

export interface AnalyticsData {
  metrics: DashboardMetrics;
  applicationTimeline: TimeSeriesData[];
  companyDistribution: DistributionData[];
  statusDistribution: DistributionData[];
  responseRateByCompany: DistributionData[];
  salaryDistribution: DistributionData[];
}

export const analyticsService = {
  async getAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<AnalyticsData> {
    const response = await apiClient.get<{ data: AnalyticsData }>(
      '/analytics',
      { params: { dateFrom, dateTo } },
    );
    return response.data.data;
  },

  async getMetrics(): Promise<DashboardMetrics> {
    const response = await apiClient.get<{ data: DashboardMetrics }>(
      '/analytics/metrics',
    );
    return response.data.data;
  },

  async exportReport(
    format: 'pdf' | 'csv',
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Blob> {
    const response = await apiClient.get('/analytics/export', {
      params: { format, dateFrom, dateTo },
      responseType: 'blob',
    });
    return response.data;
  },
};
