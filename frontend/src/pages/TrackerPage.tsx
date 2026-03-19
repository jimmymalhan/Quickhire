import ProjectTrackerBoard from '../components/dashboard/ProjectTrackerBoard';
import StakeholderViewsPanel from '../components/dashboard/StakeholderViewsPanel';
import RuntimeProgressPanel from '../components/dashboard/RuntimeProgressPanel';
import { useRuntimeProgress } from '../hooks/useRuntimeProgress';

function TrackerPage() {
  const runtimeProgress = useRuntimeProgress();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
          Localhost project tracker
        </p>
        <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          Backlog execution board
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Live project progress, blockers, product use cases, and business pressure from the runtime feed.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              High-level command
            </p>
            <p className="mt-1 font-mono text-gray-900 dark:text-white">
              bash bin/live-progress.sh
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Detailed tail surface
            </p>
            <p className="mt-1 font-mono text-gray-900 dark:text-white">
              tail -f state/local-agent-runtime/company-fleet.log
            </p>
          </div>
        </div>
      </div>

      <ProjectTrackerBoard snapshot={runtimeProgress} />
      <StakeholderViewsPanel snapshot={runtimeProgress} />
      <RuntimeProgressPanel snapshot={runtimeProgress} />
    </div>
  );
}

export default TrackerPage;
