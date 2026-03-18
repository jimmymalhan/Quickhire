import type { DashboardMetrics } from '../../types';
import { formatNumber, formatPercentage } from '../../utils/formatters';

interface MetricsOverviewProps {
  metrics: DashboardMetrics;
}

function MetricsOverview({ metrics }: MetricsOverviewProps) {
  const cards = [
    { label: 'Total Applied', value: formatNumber(metrics.totalApplications), color: 'bg-blue-500' },
    { label: 'Pending', value: formatNumber(metrics.pendingApplications), color: 'bg-yellow-500' },
    { label: 'Viewed', value: formatNumber(metrics.viewedApplications), color: 'bg-green-500' },
    { label: 'Interviews', value: formatNumber(metrics.interviewsScheduled), color: 'bg-purple-500' },
    { label: 'Offers', value: formatNumber(metrics.offersReceived), color: 'bg-emerald-500' },
    { label: 'Success Rate', value: formatPercentage(metrics.successRate), color: 'bg-primary-500' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="card">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${color}`} aria-hidden="true" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {label}
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default MetricsOverview;
