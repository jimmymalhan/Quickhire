import ClawbotSessionsPanel from '../components/dashboard/ClawbotSessionsPanel';
import MetricsCard from '../components/dashboard/MetricsCard';
import { useRuntimeProgress } from '../hooks/useRuntimeProgress';

function ClawbotPage() {
  const runtimeProgress = useRuntimeProgress();
  const liveSessions = runtimeProgress.sessions.filter(
    (session) => session.status !== 'idle',
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
          Localhost clawbot
        </p>
        <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          Agent session control room
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Session ownership, model usage, queue pressure, and runtime flow for local-agent execution.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricsCard title="Live Sessions" value={liveSessions} />
        <MetricsCard
          title="Local Agent Util"
          value={`${runtimeProgress.roiMetrics.localAgentUtilization}%`}
        />
        <MetricsCard
          title="Blockers"
          value={runtimeProgress.blockerCount}
        />
        <MetricsCard
          title="ETA To Clear"
          value={`${runtimeProgress.etaTotalMinutes}m`}
        />
      </div>

      <ClawbotSessionsPanel snapshot={runtimeProgress} />
    </div>
  );
}

export default ClawbotPage;
