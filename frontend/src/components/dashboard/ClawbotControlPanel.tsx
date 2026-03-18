import { useEffect, useState } from 'react';
import type { RuntimeOrchestration, RuntimeProgressSnapshot } from '../../types';
import { runtimeService } from '../../services/runtimeService';

interface ClawbotControlPanelProps {
  snapshot: RuntimeProgressSnapshot;
}

function formatRelativeTime(timestamp: string | null) {
  if (!timestamp) {
    return 'no commands yet';
  }

  const deltaMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round(deltaMs / 60000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.round(minutes / 60)}h ago`;
}

function ClawbotControlPanel({ snapshot }: ClawbotControlPanelProps) {
  const [orchestration, setOrchestration] = useState<RuntimeOrchestration>(
    snapshot.orchestration,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Control plane synced to runtime state.');

  useEffect(() => {
    setOrchestration(snapshot.orchestration);
  }, [snapshot.orchestration]);

  const queueCommand = async (
    label: string,
    action: string,
    value?: unknown,
    target?: string,
  ) => {
    setIsSubmitting(true);
    try {
      const response = await runtimeService.queueCommand({
        label,
        action,
        scope: 'clawbot',
        requestedBy: 'clawbot-ui',
        target,
        value,
      });

      if (response.data) {
        setOrchestration(response.data);
      }
      setStatusMessage(`Queued ${label}.`);
    } catch {
      setStatusMessage(`Failed to queue ${label}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateController = async (
    nextController: Partial<RuntimeOrchestration['controller']>,
    nextGuardrails?: Partial<RuntimeOrchestration['guardrails']>,
  ) => {
    setIsSubmitting(true);
    try {
      const response = await runtimeService.updateControl({
        controller: nextController,
        guardrails: nextGuardrails,
      });

      if (response.data) {
        setOrchestration(response.data);
      }
      setStatusMessage('Updated clawbot orchestration controls.');
    } catch {
      setStatusMessage('Failed to update orchestration controls.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { controller, guardrails, pendingCommands, toolLinks } = orchestration;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]" aria-label="Clawbot control panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              Clawbot orchestration
            </p>
            <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Local control plane
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              These controls write orchestration intent into the local runtime state so a Clawbot-compatible runner can consume it.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-right dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Pending commands
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {pendingCommands.length}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Preferred lane
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {controller.preferredLane}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Local swarm target
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {controller.targetAgentScale}/{controller.maxAgentScale}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Main-session cap
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {controller.mainSessionCapPercent}%
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Last command
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {formatRelativeTime(orchestration.lastCommandAt)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              const targetScale = Math.min(
                controller.maxAgentScale,
                controller.targetAgentScale + 4,
              );
              void updateController({ targetAgentScale: targetScale });
              void queueCommand('scale-local-swarm', 'scale', { targetScale }, 'local-agents');
            }}
            disabled={isSubmitting}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Scale local swarm
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Raise target concurrency by four lanes without changing the hard cap.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              void queueCommand('rebalance-blockers', 'rebalance', {
                blockerCount: snapshot.blockerCount,
              })
            }
            disabled={isSubmitting}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Rebalance blockers
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Push high-priority blocked work to the front of the backlog queue.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              void updateController({
                preferredLane: 'local-agents',
                preferredProvider: 'local',
                cloudFallbackEnabled: false,
              })
            }
            disabled={isSubmitting}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Enforce local-first
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Keep routing on local agents and remove cloud fallback from the control state.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              void queueCommand('takeover-review', 'takeover-review', {
                staleSessions: snapshot.sessions.filter((session) => session.status !== 'idle')
                  .length,
              })
            }
            disabled={isSubmitting}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Queue takeover review
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ask the orchestrator to inspect stale sessions and choose a fallback lane.
            </p>
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
              Guard rules
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>CPU ceiling: {guardrails.cpuLimitPercent}%</li>
              <li>Memory ceiling: {guardrails.memoryLimitPercent}%</li>
              <li>Pre-delete approval gate: {guardrails.requireApprovalForDestructive ? 'on' : 'off'}</li>
              <li>Auto-restore dry run: {guardrails.autoRestoreDryRun ? 'on' : 'off'}</li>
              <li>ROI kill switch: {guardrails.roiKillSwitch ? 'armed' : 'disabled'}</li>
            </ul>
            <button
              type="button"
              onClick={() =>
                void updateController(
                  { mainSessionCapPercent: Math.max(1, controller.mainSessionCapPercent - 1) },
                  {
                    cpuLimitPercent: Math.min(95, guardrails.cpuLimitPercent),
                    memoryLimitPercent: Math.min(95, guardrails.memoryLimitPercent),
                  },
                )
              }
              disabled={isSubmitting}
              className="mt-4 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              Tighten main-session cap
            </button>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
              Runtime hooks
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {toolLinks.map((tool) => (
                <li key={tool.id} className="rounded-xl bg-white px-3 py-2 dark:bg-gray-900">
                  <a
                    href={tool.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300"
                  >
                    {tool.label}
                  </a>
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                    {tool.category}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {statusMessage}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
          Command queue
        </p>
        <div className="mt-4 space-y-3">
          {pendingCommands.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              No queued commands. Use the control plane to write runtime intent.
            </div>
          ) : (
            pendingCommands.map((command) => (
              <article
                key={command.id}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {command.label}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                      {command.action} {'->'} {command.target}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    {command.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Requested by {command.requestedBy} {formatRelativeTime(command.createdAt)}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default ClawbotControlPanel;
