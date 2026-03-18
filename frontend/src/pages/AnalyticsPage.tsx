import { useState, useEffect, useCallback } from 'react';
import MetricsOverview from '../components/analytics/MetricsOverview';
import BarChart from '../components/analytics/BarChart';
import TimelineChart from '../components/analytics/TimelineChart';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  analyticsService,
  type AnalyticsData,
} from '../services/analyticsService';
import type { DashboardMetrics } from '../types';

const emptyMetrics: DashboardMetrics = {
  totalApplications: 0,
  pendingApplications: 0,
  viewedApplications: 0,
  interviewsScheduled: 0,
  offersReceived: 0,
  successRate: 0,
};

function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await analyticsService.getAnalytics(
        dateFrom || undefined,
        dateTo || undefined,
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      const blob = await analyticsService.exportReport(
        format,
        dateFrom || undefined,
        dateTo || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handling will be improved
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="analytics-from" className="sr-only">From date</label>
            <input
              id="analytics-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input w-auto text-sm"
              aria-label="From date"
            />
            <span className="text-gray-500">to</span>
            <label htmlFor="analytics-to" className="sr-only">To date</label>
            <input
              id="analytics-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input w-auto text-sm"
              aria-label="To date"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary text-sm">
              Export CSV
            </button>
            <button onClick={() => handleExport('pdf')} className="btn-secondary text-sm">
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : (
        <div className="space-y-6">
          <MetricsOverview metrics={data?.metrics || emptyMetrics} />

          <div className="grid gap-6 lg:grid-cols-2">
            <TimelineChart
              title="Applications Over Time"
              data={data?.applicationTimeline || []}
            />
            <BarChart
              title="Status Distribution"
              data={data?.statusDistribution || []}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BarChart
              title="Top Companies"
              data={data?.companyDistribution || []}
              color="bg-blue-500"
            />
            <BarChart
              title="Response Rate by Company"
              data={data?.responseRateByCompany || []}
              color="bg-green-500"
            />
          </div>

          <BarChart
            title="Salary Distribution"
            data={data?.salaryDistribution || []}
            color="bg-purple-500"
          />
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;
