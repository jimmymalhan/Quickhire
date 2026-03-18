import type { AutoApplyProgress } from '../../types/savedJobs';

interface AutoApplyPanelProps {
  progress: AutoApplyProgress;
  percentComplete: number;
  isStarting: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onReset: () => void;
}

function AutoApplyPanel({
  progress,
  percentComplete,
  isStarting,
  onPause,
  onResume,
  onCancel,
  onReset,
}: AutoApplyPanelProps) {
  if (progress.state === 'idle' && !isStarting) {
    return null;
  }

  const formatEta = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return 'Calculating...';
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m remaining`;
  };

  const stateColors: Record<string, string> = {
    running: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30',
    paused: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/30',
    completed: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30',
    error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30',
  };

  const stateLabels: Record<string, string> = {
    running: 'Auto-applying to jobs...',
    paused: 'Auto-apply paused',
    completed: 'Auto-apply completed',
    error: 'Auto-apply encountered an error',
  };

  const progressBarColor =
    progress.state === 'error'
      ? 'bg-red-500'
      : progress.state === 'completed'
        ? 'bg-green-500'
        : progress.state === 'paused'
          ? 'bg-yellow-500'
          : 'bg-blue-500';

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${stateColors[progress.state] || stateColors.running}`}
      role="region"
      aria-label="Auto-apply progress"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {isStarting ? 'Starting auto-apply...' : stateLabels[progress.state] || 'Auto-apply'}
        </h3>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Auto-apply progress: ${percentComplete}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Status details */}
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Processed</span>
          <p className="font-medium text-gray-900 dark:text-white">
            {progress.processedJobs} / {progress.totalJobs}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Successful</span>
          <p className="font-medium text-green-600 dark:text-green-400">
            {progress.successCount}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Failed</span>
          <p className="font-medium text-red-600 dark:text-red-400">
            {progress.failCount}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">ETA</span>
          <p className="font-medium text-gray-900 dark:text-white">
            {progress.state === 'running' ? formatEta(progress.etaSeconds) : '--'}
          </p>
        </div>
      </div>

      {/* Current job */}
      {progress.currentJob && progress.state === 'running' && (
        <p className="mb-3 truncate text-xs text-gray-500 dark:text-gray-400">
          Applying to: {progress.currentJob.title} at {progress.currentJob.company}
        </p>
      )}

      {/* Error message */}
      {progress.error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">
          {progress.error}
        </p>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {progress.state === 'running' && (
          <>
            <button
              onClick={onPause}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Pause
            </button>
            <button
              onClick={onCancel}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              Cancel
            </button>
          </>
        )}
        {progress.state === 'paused' && (
          <>
            <button
              onClick={onResume}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              Resume
            </button>
            <button
              onClick={onCancel}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              Cancel
            </button>
          </>
        )}
        {(progress.state === 'completed' || progress.state === 'error') && (
          <button
            onClick={onReset}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export default AutoApplyPanel;
