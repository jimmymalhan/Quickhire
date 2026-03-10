import type { DistributionData } from '../../services/analyticsService';

interface BarChartProps {
  title: string;
  data: DistributionData[];
  color?: string;
}

function BarChart({ title, data, color = 'bg-primary-500' }: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="card">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <div className="space-y-3">
        {data.map(({ label, value }) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate text-gray-700 dark:text-gray-300">
                {label}
              </span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {value}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
              role="progressbar"
              aria-valuenow={value}
              aria-valuemin={0}
              aria-valuemax={maxValue}
              aria-label={`${label}: ${value}`}
            >
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${(value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BarChart;
