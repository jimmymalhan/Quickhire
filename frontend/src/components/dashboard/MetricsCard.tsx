interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: 'up' | 'down' | 'neutral';
}

function MetricsCard({ title, value, change, icon }: MetricsCardProps) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        {change !== undefined && (
          <span
            className={`flex items-center text-sm font-medium ${
              change > 0
                ? 'text-green-600 dark:text-green-400'
                : change < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500'
            }`}
          >
            {icon === 'up' && (
              <svg className="mr-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {icon === 'down' && (
              <svg className="mr-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {change > 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricsCard;
