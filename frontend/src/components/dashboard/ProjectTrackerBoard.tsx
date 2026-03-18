import type { RuntimeProgressSnapshot } from '../../types';

interface ProjectTrackerBoardProps {
  snapshot: RuntimeProgressSnapshot;
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) {
    return 'TBD';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function buildProjects(snapshot: RuntimeProgressSnapshot) {
  const activeTasks = snapshot.tasks.filter((task) => task.status !== 'done');
  const blockedTasks = snapshot.tasks.filter((task) => task.status === 'blocked');

  return [
    {
      id: 'operations',
      title: 'Operations tracker',
      description: 'Live task, blocker, session, and ETA visibility in localhost.',
      progress: snapshot.overallProgress,
      owner: 'frontend-agent',
      etaMinutes: snapshot.etaTotalMinutes,
      status: blockedTasks.length > 0 ? 'At risk' : 'On track',
      metrics: [
        `${activeTasks.length} active tasks`,
        `${snapshot.sessions.length} sessions`,
        `${snapshot.blockers.length} blockers`,
      ],
    },
    {
      id: 'reliability',
      title: 'Product reliability',
      description: 'Frontend build/tests and backend suite cleanup for shippable quality.',
      progress:
        snapshot.tasks.length > 0
          ? Math.round(
              snapshot.tasks.reduce((sum, task) => sum + task.progress, 0) /
                snapshot.tasks.length,
            )
          : 0,
      owner: 'local-agent-lead',
      etaMinutes: blockedTasks.length > 0 ? 90 : 45,
      status: blockedTasks.length > 0 ? 'Needs escalation' : 'Stabilizing',
      metrics: [
        `${snapshot.completedWorkflows.length} workflows done`,
        `${snapshot.roiMetrics.tasksCompletedPerHour} tasks/hour`,
        `${snapshot.roiMetrics.blockersResolvedPerHour} blockers/hour`,
      ],
    },
    {
      id: 'automation',
      title: 'Local automation foundation',
      description: 'Safe browser-control and agent orchestration foundation on localhost.',
      progress: Math.min(
        100,
        Math.round(
          (snapshot.roiMetrics.localAgentUtilization + snapshot.overallProgress) /
            2,
        ),
      ),
      owner: 'clawbot-lead',
      etaMinutes: 60,
      status: snapshot.source?.connected ? 'Streaming live' : 'Fallback data',
      metrics: [
        `${snapshot.roiMetrics.localAgentUtilization}% local agent use`,
        `${snapshot.roiMetrics.cloudApiCallsSaved} calls saved`,
        `${snapshot.source?.provider ?? 'runtime'} source`,
      ],
    },
  ];
}

function statusTone(status: string) {
  if (status === 'On track' || status === 'Streaming live') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  }
  if (status === 'Fallback data') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  }
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
}

function ProjectTrackerBoard({ snapshot }: ProjectTrackerBoardProps) {
  const projects = buildProjects(snapshot);
  const productCompletion = snapshot.overallProgress;
  const businessMomentum = Math.min(
    100,
    Math.round(
      snapshot.roiMetrics.localAgentUtilization * 0.5 +
        snapshot.roiMetrics.tasksCompletedPerHour * 8 +
        Math.min(snapshot.roiMetrics.cloudApiCallsSaved / 4, 30),
    ),
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]" aria-label="Project tracker board">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              Project tracker
            </p>
            <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Backlog execution
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Active product lanes, business leverage, ETA pressure, and current ownership across the localhost runtime.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-right dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Remaining work
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {snapshot.remainingPercent}%
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-900/50 dark:bg-primary-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
                  Product progress
                </p>
                <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
                  {productCompletion}%
                </p>
              </div>
              <div className="text-right text-sm text-gray-600 dark:text-gray-300">
                <p>{snapshot.completedWorkflows.length} workflows done</p>
                <p>{snapshot.remainingPercent}% left to close</p>
              </div>
            </div>
            <div className="mt-3 h-3 rounded-full bg-white/70 dark:bg-gray-900/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all"
                style={{ width: `${productCompletion}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Milestones completed are feeding the tracker, while the remaining work stays visible for the team.
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  Business momentum
                </p>
                <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
                  {businessMomentum}%
                </p>
              </div>
              <div className="text-right text-sm text-gray-600 dark:text-gray-300">
                <p>{snapshot.roiMetrics.tasksCompletedPerHour} tasks/hour</p>
                <p>{snapshot.roiMetrics.cloudApiCallsSaved} cloud calls saved</p>
              </div>
            </div>
            <div className="mt-3 h-3 rounded-full bg-white/70 dark:bg-gray-900/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all"
                style={{ width: `${businessMomentum}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              This shows ROI pressure, local agent utilization, and how much cloud spend the runtime is avoiding.
            </p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {project.title}
                  </h4>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {project.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(project.status)}`}
                >
                  {project.status}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {project.progress}%
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Owned by {project.owner}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                  <p>ETA {formatMinutes(project.etaMinutes)}</p>
                </div>
              </div>

              <div className="mt-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>

              <ul className="mt-4 space-y-2">
                {project.metrics.map((metric) => (
                  <li
                    key={metric}
                    className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {metric}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
            Product use cases
          </p>
          <ul className="mt-4 space-y-4">
            {[
              ['Localhost tracker', snapshot.overallProgress],
              ['Agent coordination', snapshot.roiMetrics.localAgentUtilization],
              ['Backlog cleanup', 100 - snapshot.remainingPercent],
              ['Shipping readiness', Math.max(0, 100 - snapshot.blockerCount * 18)],
            ].map(([label, progress]) => (
              <li key={label as string}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {label}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {progress}%
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-all dark:bg-white"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
            Business pressure
          </p>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <li className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
              Visibility: {snapshot.sessions.length} live sessions exposed in product UI.
            </li>
            <li className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
              Throughput: {snapshot.roiMetrics.tasksCompletedPerHour} tasks/hour with {snapshot.roiMetrics.cloudApiCallsSaved} cloud calls avoided.
            </li>
            <li className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
              Risk: {snapshot.blockerCount} blockers and {formatMinutes(snapshot.etaTotalMinutes)} to clear the current backlog.
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}

export default ProjectTrackerBoard;
