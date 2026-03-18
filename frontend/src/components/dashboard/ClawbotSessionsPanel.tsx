import type { RuntimeProgressSnapshot } from '../../types';

interface ClawbotSessionsPanelProps {
  snapshot: RuntimeProgressSnapshot;
}

function formatRelativeTime(timestamp: string) {
  const deltaMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round(deltaMs / 60000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function sessionTone(progress: number) {
  if (progress >= 75) {
    return 'bg-green-500';
  }
  if (progress >= 40) {
    return 'bg-blue-500';
  }
  return 'bg-amber-500';
}

function ClawbotSessionsPanel({ snapshot }: ClawbotSessionsPanelProps) {
  const taskByOwner = new Map(snapshot.tasks.map((task) => [task.owner, task]));
  const activeSessions = snapshot.sessions.filter((session) => session.status !== 'idle');

  return (
    <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]" aria-label="Clawbot sessions">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              Clawbot control room
            </p>
            <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Active agent sessions
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Localhost view of active runtime sessions, current tasks, and takeover pressure.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-right dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Local agent utilization
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {snapshot.roiMetrics.localAgentUtilization}%
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {activeSessions.map((session) => {
            const ownedTask = taskByOwner.get(session.owner);
            const progress = ownedTask?.progress ?? 15;
            const isStale =
              Date.now() - new Date(session.lastHeartbeatAt).getTime() > 60000;

            return (
              <article
                key={session.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {session.owner}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {session.model}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isStale
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    }`}
                  >
                    {isStale ? 'heartbeat stale' : session.status}
                  </span>
                </div>

                <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                  {session.currentTask}
                </p>

                <div className="mt-4 h-3 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full transition-all ${sessionTone(progress)}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <div className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
                    <p className="text-xs uppercase tracking-[0.18em]">Task progress</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      {progress}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
                    <p className="text-xs uppercase tracking-[0.18em]">Heartbeat</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      {formatRelativeTime(session.lastHeartbeatAt)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
            Clawbot queue
          </p>
          <ul className="mt-4 space-y-3">
            {snapshot.upcomingTasks.map((task, index) => (
              <li
                key={task}
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {task}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    Q{index + 1}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
            Data flow
          </p>
          <div className="mt-4 space-y-3">
            {snapshot.tasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-800"
              >
                <p className="font-medium text-gray-900 dark:text-white">
                  {task.owner}
                </p>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  {task.title}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gray-400">
                  <span>runtime</span>
                  <span>&rarr;</span>
                  <span>tracker</span>
                  <span>&rarr;</span>
                  <span>UI</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export default ClawbotSessionsPanel;
