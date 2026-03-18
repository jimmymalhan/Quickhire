import type { TimeSeriesData } from '../../services/analyticsService';

interface TimelineChartProps {
  title: string;
  data: TimeSeriesData[];
}

function TimelineChart({ title, data }: TimelineChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="card">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No data available
        </p>
      ) : (
        <div className="flex items-end gap-1" style={{ height: '200px' }} role="img" aria-label={`${title} chart`}>
          {data.map(({ date, count }) => (
            <div
              key={date}
              className="group relative flex flex-1 flex-col items-center"
              style={{ height: '100%' }}
            >
              <div className="flex flex-1 items-end w-full">
                <div
                  className="w-full rounded-t bg-primary-500 transition-colors group-hover:bg-primary-600"
                  style={{
                    height: `${(count / maxCount) * 100}%`,
                    minHeight: count > 0 ? '4px' : '0',
                  }}
                  title={`${date}: ${count}`}
                />
              </div>
              <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TimelineChart;
