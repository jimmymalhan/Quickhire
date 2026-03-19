import type { RuntimeProgressSnapshot, RuntimeTaskStatus } from '../../types';

interface RuntimeProgressPanelProps {
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

function formatRefreshInterval(intervalMs: number | undefined) {
  if (!intervalMs) {
    return '10s';
  }

  const seconds = Math.max(1, Math.round(intervalMs / 1000));
  return `${seconds}s`;
}

function formatRelativeTime(timestamp: string | null) {
  if (!timestamp) {
    return 'just now';
  }

  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60000));
  if (elapsedMinutes < 1) {
    return 'just now';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  return `${Math.round(elapsedMinutes / 60)}h ago`;
}

function statusColor(status: RuntimeTaskStatus) {
  switch (status) {
    case 'done':
      return 'bg-green-500';
    case 'in_progress':
      return 'bg-blue-500';
    case 'blocked':
      return 'bg-red-500';
    case 'queued':
      return 'bg-gray-400';
    default:
      return 'bg-gray-300';
  }
}

function statusBadge(status: RuntimeTaskStatus) {
  const colors: Record<RuntimeTaskStatus, string> = {
    done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    in_progress:
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    queued: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };
  return colors[status] || colors.queued;
}

function severityColor(severity: string) {
  switch (severity) {
    case 'high':
      return 'border-l-red-500 bg-red-50 dark:bg-red-950';
    case 'medium':
      return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950';
    default:
      return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950';
  }
}

function roleBg(role: string) {
  switch (role) {
    case 'ceo':
      return 'bg-purple-600';
    case 'cto':
      return 'bg-indigo-600';
    case 'director':
      return 'bg-blue-600';
    case 'manager':
      return 'bg-teal-600';
    default:
      return 'bg-gray-600';
  }
}

function roleIcon(role: string) {
  switch (role) {
    case 'ceo':
      return 'C';
    case 'cto':
      return 'T';
    case 'director':
      return 'D';
    case 'manager':
      return 'M';
    default:
      return 'E';
  }
}

function RuntimeProgressPanel({ snapshot }: RuntimeProgressPanelProps) {
  const activeTasks = snapshot.tasks.filter((task) => task.status !== 'done');
  const completedTasks = snapshot.tasks.filter((task) => task.status === 'done');
  const blockedTasks = snapshot.tasks.filter(
    (task) => task.status === 'blocked',
  );
  const activeSessions = snapshot.sessions.filter(
    (session) => session.status !== 'idle',
  );
  const healthyReplicas = snapshot.orgChart.replicas.filter(
    (replica) => replica.status === 'healthy',
  );
  const sourceLabel = snapshot.source?.connected
    ? `${snapshot.source.provider} connected`
    : `${snapshot.source?.provider ?? 'runtime'} fallback`;

  const elapsedMs = Date.now() - new Date(snapshot.generatedAt).getTime();
  const elapsedFormatted =
    elapsedMs < 60000
      ? `${Math.round(elapsedMs / 1000)}s ago`
      : `${Math.round(elapsedMs / 60000)}m ago`;

  return (
    <section className="card mb-8" aria-label="Runtime progress">
      {/* TOP BAR - Overall completion with ETA */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-primary-600 to-primary-800 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-200">
              Live runtime snapshot
            </p>
            <p className="mt-1 text-3xl font-bold">
              {snapshot.overallProgress}%
            </p>
            <p className="mt-1 max-w-xl text-sm text-primary-100">
              Product progress, blocker pressure, and session activity pulled from the runtime feed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-xs text-primary-200">ETA to 100%</p>
              <p className="text-lg font-semibold">
                {formatMinutes(snapshot.etaTotalMinutes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-primary-200">Blockers</p>
              <p className="text-lg font-semibold">{snapshot.blockerCount}</p>
            </div>
            <div>
              <p className="text-xs text-primary-200">Work left</p>
              <p className="text-lg font-semibold">{snapshot.remainingPercent}%</p>
            </div>
            <div>
              <p className="text-xs text-primary-200">Source</p>
              <p className="text-lg font-semibold">{sourceLabel}</p>
            </div>
            <div>
              <p className="text-xs text-primary-200">Refresh</p>
              <p className="text-lg font-semibold">
                {formatRefreshInterval(snapshot.source?.refreshIntervalMs)}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-4 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${snapshot.overallProgress}%` }}
              aria-label={`${snapshot.overallProgress}% complete`}
              role="progressbar"
              aria-valuenow={snapshot.overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-primary-200">
            <span>{completedTasks.length} tasks done</span>
            <span>{activeTasks.length} active</span>
            <span>{blockedTasks.length} blocked</span>
            <span>Updated {elapsedFormatted}</span>
          </div>
        </div>
      </div>

      {/* ROI METRICS BAR */}
      {snapshot.roiMetrics && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
            <p className="text-xs text-green-600 dark:text-green-400">
              Tasks/hour
            </p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">
              {snapshot.roiMetrics.tasksCompletedPerHour}
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Blockers resolved/hr
            </p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {snapshot.roiMetrics.blockersResolvedPerHour}
            </p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950">
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Local agent util
            </p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {snapshot.roiMetrics.localAgentUtilization}%
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950">
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Cloud calls saved
            </p>
            <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
              {snapshot.roiMetrics.cloudApiCallsSaved}
            </p>
          </div>
        </div>
      )}

      {/* RESOURCE USAGE */}
      {snapshot.resourceUsage && (
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">CPU</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {snapshot.resourceUsage.cpuPercent}%
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${
                  snapshot.resourceUsage.cpuPercent >
                  snapshot.resourceUsage.cpuThreshold
                    ? 'bg-red-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${snapshot.resourceUsage.cpuPercent}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Memory</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {snapshot.resourceUsage.memoryPercent}%
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${
                  snapshot.resourceUsage.memoryPercent >
                  snapshot.resourceUsage.memoryThreshold
                    ? 'bg-red-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${snapshot.resourceUsage.memoryPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TEAM OWNERSHIP */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
              Org chart
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Active team ownership, replica health, and failover lanes pulled from runtime state.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-4">
            <div className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                Capacity
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                {snapshot.orgChart.capacityBand.currentPercent}%
              </p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                Healthy replicas
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                {healthyReplicas.length}/{snapshot.orgChart.replicas.length}
              </p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                Active agents
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                {snapshot.orgChart.capacityBand.activeAgents}
              </p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                Failover
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                {snapshot.orgChart.failover.enabled ? 'armed' : 'off'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.orgChart.teams.map((team) => (
              <article
                key={team.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {team.name}
                    </h4>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">
                      {team.lead}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      team.status === 'blocked'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : team.status === 'running'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {team.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {team.scope}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-400">
                      Replicas
                    </p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                      {team.healthyReplicas}/{team.replicaCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-400">
                      Active tasks
                    </p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                      {team.activeTasks}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-400">
                      Sessions
                    </p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                      {team.activeSessions}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-400">
                      ETA
                    </p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                      {formatMinutes(team.etaMinutes)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">
                Replica pool
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Local ownership, model lanes, and heartbeat health for each replica.
              </p>
            </div>
            <ul className="space-y-2">
              {snapshot.orgChart.replicas.slice(0, 6).map((replica) => (
                <li
                  key={replica.id}
                  className="rounded-lg bg-gray-50 px-3 py-3 text-sm dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {replica.name}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                        {replica.team} · {replica.model}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        replica.status === 'healthy'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {replica.active ? 'active' : replica.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{replica.owner}</span>
                    <span>Lane {replica.lane}</span>
                    <span>
                      Checked {replica.checkedAt ? formatRelativeTime(replica.checkedAt) : 'now'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* MAIN GRID: Tasks, Blockers, Sessions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* CURRENT TASKS with progress bars */}
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current tasks
            </p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              {activeTasks.length} active
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {snapshot.tasks.map((task) => (
              <li key={task.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                    {task.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(task.status)}`}
                  >
                    {task.status === 'in_progress' ? 'active' : task.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${statusColor(task.status)}`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {task.progress}%
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{task.owner}</span>
                  <span>ETA {formatMinutes(task.etaMinutes)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* BLOCKERS with progress bars and resolution options */}
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Blockers
            </p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">
              {snapshot.blockers.length} active
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {snapshot.blockers.map((blocker) => (
              <li
                key={blocker.id}
                className={`rounded-lg border-l-4 p-3 ${severityColor(blocker.severity)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {blocker.title}
                  </p>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase ${
                      blocker.severity === 'high'
                        ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                        : blocker.severity === 'medium'
                          ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                          : 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                    }`}
                  >
                    {blocker.severity}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Estimated clear time</span>
                  <span>{formatMinutes(blocker.etaMinutes)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-orange-400 transition-all"
                    style={{
                      width: `${Math.max(10, 100 - (blocker.etaMinutes / 60) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Resolution paths
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {blocker.options.map((option, index) => (
                      <span
                        key={option}
                        className={`rounded-full px-2.5 py-1 text-xs shadow-sm ${
                          index === 0
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {index === 0 ? 'Preferred: ' : ''}
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
                {blocker.assignedTo && (
                  <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                    Assigned to {blocker.assignedTo}
                  </div>
                )}
              </li>
            ))}
            {snapshot.blockers.length === 0 && (
              <li className="py-4 text-center text-sm text-gray-400">
                No active blockers
              </li>
            )}
          </ul>
        </div>

        {/* ACTIVE SESSIONS */}
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active sessions
            </p>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-200">
              {activeSessions.length} live
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {snapshot.sessions.map((session) => {
              const heartbeatAge =
                Date.now() - new Date(session.lastHeartbeatAt).getTime();
              const isStale = heartbeatAge > 60000;
              const ownedTask = snapshot.tasks.find(
                (task) => task.owner === session.owner,
              );
              return (
                <li
                  key={session.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {session.owner}
                        </p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                          {session.model}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {session.currentTask}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        session.status === 'running' && !isStale
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                          : isStale
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {isStale ? 'stale' : session.status}
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        session.status === 'running' && !isStale
                          ? 'bg-green-500'
                          : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${ownedTask ? Math.max(15, ownedTask.progress) : 20}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {ownedTask
                        ? `Task progress ${ownedTask.progress}%`
                        : 'No assigned task'}
                    </span>
                    <span>
                      {formatMinutes(Math.max(1, Math.round(heartbeatAge / 60000)))} since heartbeat
                    </span>
                  </div>
                </li>
              );
            })}
            {snapshot.sessions.length === 0 && (
              <li className="py-4 text-center text-sm text-gray-400">
                No active sessions
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* EXECUTIVE DECISIONS */}
      {snapshot.executiveDecisions &&
        snapshot.executiveDecisions.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Executive decisions
            </p>
            <ul className="mt-3 space-y-2">
              {snapshot.executiveDecisions.map((decision) => (
                <li
                  key={decision.id}
                  className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${roleBg(decision.role)}`}
                  >
                    {roleIcon(decision.role)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-semibold">{decision.owner}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {' '}
                        ({decision.role.toUpperCase()})
                      </span>
                      : {decision.action}
                    </p>
                    {decision.outcome && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Outcome: {decision.outcome}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
                      decision.priority === 'critical'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : decision.priority === 'high'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {decision.priority}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* BOTTOM ROW: Upcoming, Completed, Lessons */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-600">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Upcoming work
          </p>
          <ul className="mt-3 space-y-2">
            {snapshot.upcomingTasks.map((task, i) => (
              <li key={task} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {task}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {snapshot.completedWorkflows &&
          snapshot.completedWorkflows.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Completed
              </p>
              <ul className="mt-3 space-y-1">
                {snapshot.completedWorkflows.map((wf) => (
                  <li
                    key={wf}
                    className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
                  >
                    <span className="text-green-500">&#10003;</span>
                    {wf}
                  </li>
                ))}
              </ul>
            </div>
          )}

        {snapshot.lessons && snapshot.lessons.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Lessons learned
            </p>
            <ul className="mt-3 space-y-1">
              {snapshot.lessons.map((lesson) => (
                <li
                  key={lesson}
                  className="text-sm text-amber-600 dark:text-amber-400"
                >
                  {lesson}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default RuntimeProgressPanel;
