import ProjectTrackerBoard from '../components/dashboard/ProjectTrackerBoard';
import RuntimeProgressPanel from '../components/dashboard/RuntimeProgressPanel';
import { useRuntimeProgress } from '../hooks/useRuntimeProgress';

function TrackerPage() {
  const runtimeProgress = useRuntimeProgress();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
          Localhost project tracker
        </p>
        <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          Backlog execution board
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Live project progress, blockers, product use cases, and business pressure from the runtime feed.
        </p>
      </div>

      <ProjectTrackerBoard snapshot={runtimeProgress} />
      <RuntimeProgressPanel snapshot={runtimeProgress} />
    </div>
  );
}

export default TrackerPage;
