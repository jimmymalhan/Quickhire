import type { RuntimeBlocker, RuntimeProgressSnapshot, RuntimeTask } from '../../types';

interface StakeholderViewsPanelProps {
  snapshot: RuntimeProgressSnapshot;
}

type StakeholderRole = 'cto' | 'vp' | 'director' | 'manager';

interface StakeholderView {
  role: StakeholderRole;
  title: string;
  audience: string;
  summary: string;
  signalLabel: string;
  signalValue: string;
  metrics: Array<{ label: string; value: string }>;
  blocker?: RuntimeBlocker | RuntimeTask | null;
  action: string;
  emphasis: string;
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

function severityTone(severity?: string) {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
  }
}

function blockerTone(blocker: RuntimeBlocker | RuntimeTask) {
  if ('severity' in blocker) {
    return severityTone(blocker.severity);
  }

  return blocker.status === 'blocked'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
}

function blockerLabel(blocker: RuntimeBlocker | RuntimeTask) {
  if ('severity' in blocker) {
    return blocker.severity;
  }

  return blocker.status;
}

function stakeholderHue(role: StakeholderRole) {
  switch (role) {
    case 'cto':
      return 'from-indigo-600 via-slate-900 to-slate-800';
    case 'vp':
      return 'from-emerald-600 via-teal-700 to-slate-800';
    case 'director':
      return 'from-blue-600 via-cyan-700 to-slate-800';
    case 'manager':
      return 'from-amber-500 via-orange-600 to-slate-800';
    default:
      return 'from-gray-600 via-gray-800 to-gray-900';
  }
}

function buildStakeholderViews(snapshot: RuntimeProgressSnapshot): StakeholderView[] {
  const healthyReplicas = snapshot.orgChart.replicas.filter((replica) => replica.status === 'healthy');
  const highSeverityBlockers = snapshot.blockers.filter((blocker) => blocker.severity === 'high');
  const activeTasks = snapshot.tasks.filter((task) => task.status === 'in_progress');
  const blockedTasks = snapshot.tasks.filter((task) => task.status === 'blocked');
  const staleSessions = snapshot.sessions.filter(
    (session) => Date.now() - new Date(session.lastHeartbeatAt).getTime() > 60000,
  );
  const blockedTeams = snapshot.orgChart.teams.filter((team) => team.status === 'blocked');
  const busiestTeam = [...snapshot.orgChart.teams].sort((a, b) => b.activeTasks - a.activeTasks)[0];
  const deepestBlocker = [...snapshot.blockers].sort((a, b) => b.etaMinutes - a.etaMinutes)[0];
  const topDecision = snapshot.executiveDecisions[0] ?? null;

  return [
    {
      role: 'cto',
      title: 'CTO view',
      audience: 'System risk and merge gate',
      summary: 'Keep the runtime local-first, protect the merge gate, and verify failover is ready.',
      signalLabel: 'Risk posture',
      signalValue:
        highSeverityBlockers.length > 0 ? `${highSeverityBlockers.length} critical blockers` : 'Guardrails green',
      metrics: [
        {
          label: 'Capacity band',
          value: `${snapshot.orgChart.capacityBand.currentPercent}% / target ${snapshot.orgChart.capacityBand.targetPercent}%`,
        },
        {
          label: 'Failover',
          value: snapshot.orgChart.failover.enabled ? 'Armed' : 'Off',
        },
        {
          label: 'Healthy replicas',
          value: `${healthyReplicas.length}/${snapshot.orgChart.replicas.length}`,
        },
        {
          label: 'Resource pressure',
          value: `${snapshot.resourceUsage.cpuPercent}% CPU · ${snapshot.resourceUsage.memoryPercent}% memory`,
        },
      ],
      blocker: highSeverityBlockers[0] ?? deepestBlocker ?? null,
      action:
        highSeverityBlockers.length > 0
          ? `Resolve ${highSeverityBlockers[0].title}`
          : 'Hold the local-first guardrails and monitor failover coverage.',
      emphasis: topDecision?.outcome
        ? `Latest decision: ${topDecision.owner} - ${topDecision.outcome}`
        : 'Latest decision feed is stable.',
    },
    {
      role: 'vp',
      title: 'VP view',
      audience: 'Shipping momentum and ROI',
      summary: 'Track throughput, delivery ETA, and whether the team is burning down work fast enough.',
      signalLabel: 'Momentum',
      signalValue: `${snapshot.roiMetrics.tasksCompletedPerHour} tasks/hour`,
      metrics: [
        {
          label: 'Delivery progress',
          value: `${snapshot.overallProgress}% complete`,
        },
        {
          label: 'ETA',
          value: formatMinutes(snapshot.etaTotalMinutes),
        },
        {
          label: 'Cloud calls saved',
          value: `${snapshot.roiMetrics.cloudApiCallsSaved}`,
        },
        {
          label: 'Blocker resolution',
          value: `${snapshot.roiMetrics.blockersResolvedPerHour} blockers/hour`,
        },
      ],
      blocker: blockedTasks[0] ?? snapshot.blockers[0] ?? null,
      action:
        snapshot.upcomingTasks[0] ?? 'Keep the queue moving and prioritize the next deliverable.',
      emphasis: `${activeTasks.length} active tasks and ${snapshot.completedWorkflows.length} completed workflows`,
    },
    {
      role: 'director',
      title: 'Director view',
      audience: 'Team flow and escalation routing',
      summary: 'Keep each lane staffed, rebalance bottlenecks, and isolate the team with the longest queue.',
      signalLabel: 'Team health',
      signalValue: blockedTeams.length > 0 ? `${blockedTeams.length} blocked teams` : 'All teams moving',
      metrics: [
        {
          label: 'Active sessions',
          value: `${snapshot.orgChart.capacityBand.activeAgents}`,
        },
        {
          label: 'Teams running',
          value: `${snapshot.orgChart.teams.filter((team) => team.status === 'running').length}/${snapshot.orgChart.teams.length}`,
        },
        {
          label: 'Peak lane',
          value: busiestTeam ? `${busiestTeam.name} (${busiestTeam.activeTasks} tasks)` : 'No active lanes',
        },
        {
          label: 'Fallback lane',
          value: snapshot.orgChart.failover.fallbackLane,
        },
      ],
      blocker:
        busiestTeam?.blockedTasks > 0
          ? snapshot.blockers.find((blocker) => blocker.assignedTo) ?? null
          : snapshot.blockers[0] ?? null,
      action:
        busiestTeam && busiestTeam.blockedTasks > 0
          ? `Escalate ${busiestTeam.name}`
          : 'Keep routing work toward the healthiest lane.',
      emphasis: `${snapshot.orgChart.teams.reduce((sum, team) => sum + team.activeTasks, 0)} active team tasks`,
    },
    {
      role: 'manager',
      title: 'Manager view',
      audience: 'Execution detail and blockers',
      summary: 'Watch current assignments, stale sessions, and the next concrete handoff required to keep progress moving.',
      signalLabel: 'Execution focus',
      signalValue: `${activeTasks.length} active / ${blockedTasks.length} blocked`,
      metrics: [
        {
          label: 'Stale sessions',
          value: `${staleSessions.length}`,
        },
        {
          label: 'Current blockers',
          value: `${snapshot.blockers.length}`,
        },
        {
          label: 'Next task',
          value: snapshot.upcomingTasks[0] ?? 'No queued work',
        },
        {
          label: 'Assigned decisions',
          value: `${snapshot.executiveDecisions.filter((decision) => decision.role === 'manager').length}`,
        },
      ],
      blocker:
        blockedTasks[0] ?? (staleSessions.length > 0 ? snapshot.blockers[0] ?? null : null),
      action:
        blockedTasks[0]?.title ??
        (staleSessions.length > 0 ? 'Refresh stale sessions and hand off to a healthy replica.' : 'Keep the current sprint moving.'),
      emphasis:
        snapshot.executiveDecisions.find((decision) => decision.role === 'manager')?.action ??
        'No manager-specific decision queued right now.',
    },
  ];
}

function StakeholderViewsPanel({ snapshot }: StakeholderViewsPanelProps) {
  const views = buildStakeholderViews(snapshot);

  return (
    <section className="space-y-4" aria-label="Stakeholder views">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
            Stakeholder views
          </p>
          <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            Realtime lens by role
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            The same live snapshot is reframed for CTO, VP, Director, and Manager so each level sees the metrics and blockers that matter most.
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-right dark:bg-gray-800">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Refresh cadence
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            10s live snapshot
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {views.map((view) => (
          <article
            key={view.role}
            className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className={`bg-gradient-to-r ${stakeholderHue(view.role)} px-5 py-5 text-white`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                    {view.title}
                  </p>
                  <h4 className="mt-1 text-2xl font-bold">{view.audience}</h4>
                  <p className="mt-2 max-w-2xl text-sm text-white/80">
                    {view.summary}
                  </p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  {view.signalValue}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
                    Signal
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {view.signalLabel}
                  </p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {view.emphasis}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {view.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Next move
                  </p>
                  <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    {view.action}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Current blocker
                  </p>
                  {view.blocker ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {view.blocker.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${blockerTone(view.blocker)}`}>
                          {blockerLabel(view.blocker)}
                        </span>
                        <span>ETA {formatMinutes(view.blocker.etaMinutes)}</span>
                        {'assignedTo' in view.blocker && view.blocker.assignedTo ? (
                          <span>Assigned {view.blocker.assignedTo}</span>
                        ) : 'owner' in view.blocker ? (
                          <span>Owner {view.blocker.owner}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      No active blocker for this view.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default StakeholderViewsPanel;
