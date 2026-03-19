#!/usr/bin/env bash
# orchestration-monitor.sh — writes a single overwrite-only runtime snapshot.
# The snapshot is the canonical state source for terminal progress and tailing.

set -uo pipefail

ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
CTRL="$STATE/orchestration-controls.json"
PROGRESS="$STATE/progress.json"
WORKFLOW="$STATE/workflow-state.json"
HANDOFF="$STATE/session-handoff.json"
AGENT_HEALTH="$STATE/agent-health.json"
CHIEF_ASSIGNMENTS="$STATE/chief-assignments.json"
CHIEF_SUMMARY="$STATE/chief-summary.json"
WORKER_STATE="$STATE/worker-state.json"
CI_STATUS="$STATE/ci-status.json"
PR_STATUS="$STATE/pr-status.json"
DASHBOARD="$STATE/dashboard.json"
STATUS_LINE="$STATE/dashboard.status"
TRACKER_LOG="$STATE/project-tracker.log"
RUN_ONCE=0

if [ "${1:-}" = "--once" ]; then
  RUN_ONCE=1
fi

mkdir -p "$STATE"

render_snapshot() {
  python3 - \
    "$CTRL" \
    "$PROGRESS" \
    "$WORKFLOW" \
    "$HANDOFF" \
    "$AGENT_HEALTH" \
    "$CHIEF_ASSIGNMENTS" \
    "$CHIEF_SUMMARY" \
    "$WORKER_STATE" \
    "$CI_STATUS" \
    "$PR_STATUS" \
    "$DASHBOARD" \
    "$STATUS_LINE" \
    "$TRACKER_LOG" <<'PY'
import datetime as dt
import json
import pathlib
import sys

(
    ctrl_path,
    progress_path,
    workflow_path,
    handoff_path,
    agent_health_path,
    chief_assignments_path,
    chief_summary_path,
    worker_state_path,
    ci_path,
    pr_path,
    dashboard_path,
    status_line_path,
    tracker_log_path,
) = [pathlib.Path(p) for p in sys.argv[1:14]]


def read_json(path, fallback):
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path, value):
    path.write_text(value.rstrip() + "\n", encoding="utf-8")


def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def clamp(value, low, high, default):
    return max(low, min(high, as_int(value, default)))


def percent_to_eta(percent):
    if percent >= 100:
        return 0
    if percent >= 95:
        return 1
    if percent >= 85:
        return 3
    if percent >= 70:
        return 5
    return max(1, round((100 - percent) * 0.2))


def normalize_status(value, fallback="unknown"):
    value = (value or fallback).lower()
    if value in {"ready", "queued", "running", "blocked", "done", "failed", "complete", "completed", "idle"}:
        return value
    return fallback


def summary_of_commands(commands):
    pending = []
    running = []
    completed = []
    for item in commands:
        status = str(item.get("status", "")).upper()
        label = item.get("label") or item.get("id") or "untitled"
        if status.startswith("READY") or status.startswith("QUEUED"):
            pending.append(label)
        elif status.startswith("RUNNING"):
            running.append(label)
        elif status.startswith("DONE") or status.startswith("COMPLETE"):
            completed.append(label)
    return pending, running, completed


def build_stakeholder_views(project, controls, queue, agent_summary, ci, handoff, workflow):
    capacity = controls.get("capacity", {})
    active = agent_summary
    summary_line = {
        "overall": f"{project.get('overallPercent', 0)}%",
        "eta": project.get("etaLabel", "unknown"),
        "capacity": f"{capacity.get('currentPercent', 0)}%",
        "target": f"{capacity.get('targetMinPercent', 80)}-{capacity.get('targetMaxPercent', 90)}%",
        "agents": f"{active.get('alive', 0)}/{active.get('total', 0)}",
        "queue": f"{queue.get('pendingCount', 0)} pending / {queue.get('runningCount', 0)} running",
    }

    risks = []
    if ci.get("failing", 0):
        risks.append(f"{ci['failing']} CI checks failing")
    if handoff.get("status") not in {"none", "complete", "done"}:
        risks.append(f"handoff status: {handoff.get('status')}")
    if queue.get("pendingCount", 0) > 0:
        risks.append(f"{queue['pendingCount']} queued items awaiting execution")
    if not risks:
        risks.append("no blocking risks")

    return {
        "cto": {
            "title": "Merge gate and release confidence",
            "headline": "Protect the release path and block merges until the gate is green.",
            "metrics": [
                f"mergeAllowed={ci.get('mergeAllowed', False)}",
                f"tests={ci.get('tests', 'unknown')} lint={ci.get('lint', 'unknown')}",
                f"overall={summary_line['overall']} eta={summary_line['eta']}",
                f"capacity={summary_line['capacity']} target={summary_line['target']}",
            ],
            "risks": risks[:3],
            "ask": "Keep CI green before merge and preserve the 80-90% capacity band.",
        },
        "vp": {
            "title": "Quality, security, and delivery health",
            "headline": "Focus on test, lint, and security status with no noisy regressions.",
            "metrics": [
                f"tests={ci.get('tests', 'unknown')} lint={ci.get('lint', 'unknown')}",
                f"workflow completed={workflow.get('completed', 0)} in-progress={workflow.get('inProgress', 0)}",
                f"healthy agents={active.get('healthy', 0)}/{active.get('healthChecked', 0)}",
                f"local-agents-only={controls.get('localAgentsOnly', True)}",
            ],
            "risks": [
                "track any red CI check or lint regression",
                "watch for stale health-check failures",
            ],
            "ask": "Hold the quality gate until the repo is fully clean.",
        },
        "director": {
            "title": "Execution flow and ownership",
            "headline": "Keep the queue moving and make sure every task has a clear owner.",
            "metrics": [
                f"queue pending={queue.get('pendingCount', 0)} running={queue.get('runningCount', 0)} completed={queue.get('completedCount', 0)}",
                f"active agents={active.get('alive', 0)}/{active.get('total', 0)}",
                f"current stage={project.get('currentStage', 'unknown')}",
                f"top running={', '.join(queue.get('topRunning', [])[:3]) or 'none'}",
            ],
            "risks": [
                "watch blocked or stalled queue items",
                "confirm ownership stays on the latest checkpoint",
            ],
            "ask": "Keep the handoff chain moving and avoid idle replicas.",
        },
        "manager": {
            "title": "Near-term work and ETA",
            "headline": "See what is happening now, what is next, and when it finishes.",
            "metrics": [
                f"eta={summary_line['eta']} remaining={project.get('remainingPercent', 0)}%",
                f"top pending={', '.join(queue.get('topPending', [])[:3]) or 'none'}",
                f"handoff={handoff.get('status', 'none')}",
                f"healthy agents={active.get('healthy', 0)}/{active.get('healthChecked', 0)}",
            ],
            "risks": [
                "clear the current top pending item first",
                "reassign if a handoff times out",
            ],
            "ask": "Keep local agents busy on the next highest-ROI task.",
        },
    }


ctrl = read_json(ctrl_path, {})
progress = read_json(progress_path, {})
workflow = read_json(workflow_path, {})
handoff = read_json(handoff_path, {})
agent_health = read_json(agent_health_path, {})
chief_assignments = read_json(chief_assignments_path, [])
chief_summary = read_json(chief_summary_path, {})
worker_state = read_json(worker_state_path, {})
ci = read_json(ci_path, {})
pr = read_json(pr_path, {})

overall = clamp(progress.get("overall", {}).get("percent", ctrl.get("workerProgress", 0)), 0, 100, 0)
remaining = clamp(progress.get("overall", {}).get("remaining_percent", 100 - overall), 0, 100, max(0, 100 - overall))
eta_minutes = progress.get("eta_minutes")
if not isinstance(eta_minutes, int) or eta_minutes < 0:
    eta_minutes = percent_to_eta(overall)
eta_label = "DONE" if overall >= 100 else f"~{eta_minutes} min"

started_at = progress.get("started_at") or progress.get("startedAt")
updated_at = progress.get("updated_at") or progress.get("updatedAt")
current_stage = progress.get("current_stage") or progress.get("currentStage") or ctrl.get("controller", {}).get("status") or "running"
project_name = progress.get("task") or ctrl.get("controller", {}).get("mode", "Quickhire local-agent runtime")
project_status = normalize_status(progress.get("overall", {}).get("status"), "running")
if overall >= 100:
    project_status = "done"
elif handoff.get("timedOutAt") and handoff.get("status") != "complete":
    project_status = "blocked"

runtime = workflow.get("resourceUsage", {})
target_min = clamp(ctrl.get("runtime", {}).get("targetCapacityMin", runtime.get("cpuThreshold", 80)), 0, 100, 80)
target_max = clamp(ctrl.get("runtime", {}).get("targetCapacityMax", runtime.get("memoryThreshold", 90)), 0, 100, 90)
current_capacity = clamp(
    ctrl.get("runtime", {}).get("currentCapacity", runtime.get("cpuPercent", ctrl.get("workerProgress", overall))),
    0,
    100,
    overall,
)

replicas = ctrl.get("runtime", {}).get("replicas")
if not isinstance(replicas, dict):
    replicas = {"read": 3, "write": 3, "monitor": 2, "merge": 2}

pending_commands = ctrl.get("pendingCommands", [])
pending_labels, running_labels, completed_labels = summary_of_commands(pending_commands)

agent_entries = []
for entry in agent_health.get("agents", []) if isinstance(agent_health, dict) else []:
    agent_entries.append(
        {
            "id": entry.get("id", "agent"),
            "name": entry.get("name", entry.get("id", "agent")),
            "status": entry.get("status", "unknown"),
            "recentFailures": entry.get("recentFailures", 0),
            "recentSuccesses": entry.get("recentSuccesses", 0),
            "checkedAt": entry.get("checkedAt"),
        }
    )

active_agents = handoff.get("activeAgents", {})
roles = [
    {
        "name": "orchestrator-monitor",
        "status": "running",
        "doing": "writing dashboard.json every 10s",
        "replicas": replicas.get("monitor", 1),
    },
    {
        "name": "session-chief",
        "status": normalize_status(chief_summary.get("status"), "running"),
        "doing": chief_summary.get("selected", "choosing next highest-ROI task"),
        "replicas": 1,
    },
    {
        "name": "supervisor",
        "status": normalize_status(worker_state.get("status"), "idle"),
        "doing": worker_state.get("action") or "health-checking local workers",
        "replicas": 1,
    },
]

agent_summary = {
    "alive": sum(1 for item in active_agents.values() if isinstance(item, dict) and item.get("status", "").lower() == "running"),
    "total": len(active_agents),
    "healthChecked": len(agent_entries),
    "healthy": sum(1 for item in agent_entries if str(item.get("status", "")).lower() == "healthy"),
}

queued = sum(1 for item in pending_commands if str(item.get("status", "")).upper().startswith(("READY", "QUEUED")))
running = sum(1 for item in pending_commands if str(item.get("status", "")).upper().startswith("RUNNING"))
done = sum(1 for item in pending_commands if str(item.get("status", "")).upper().startswith(("DONE", "COMPLETE")))

tail_commands = [
    "tail -f state/local-agent-runtime/company-fleet.log",
    "tail -f state/local-agent-runtime/dashboard.status",
    "jq '.' state/local-agent-runtime/dashboard.json",
    "bash bin/live-progress.sh",
]

summary_line = (
    f"TRACKER|{dt.datetime.utcnow().isoformat(timespec='seconds')}Z"
    f"|overall={overall}%|left={remaining}%|eta={eta_label}"
    f"|capacity={current_capacity}%|target={target_min}-{target_max}%"
    f"|agents={agent_summary['alive']}/{agent_summary['total']}"
    f"|ci={ci.get('tests', {}).get('status', 'unknown')}/{ci.get('lint', {}).get('status', 'unknown')}"
    f"|pr={pr.get('pr', pr.get('number', 'none'))}"
    f"|monitor={worker_state.get('status', 'idle')}"
    f"|stage={current_stage}"
)

snapshot = {
    "generatedAt": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "project": {
        "name": project_name,
        "status": project_status,
        "overallPercent": overall,
        "remainingPercent": remaining,
        "etaMinutes": eta_minutes,
        "etaLabel": eta_label,
        "currentStage": current_stage,
        "startedAt": started_at,
        "updatedAt": updated_at,
    },
    "controls": {
        "mode": ctrl.get("orchestration", {}).get("mode", ctrl.get("controller", {}).get("mode", "LOCAL_AGENTS_ONLY")),
        "localAgentsOnly": bool(ctrl.get("guardrails", {}).get("LOCAL_AGENTS_ONLY", True)),
        "capacity": {
            "currentPercent": current_capacity,
            "targetMinPercent": target_min,
            "targetMaxPercent": target_max,
        },
        "replicas": replicas,
        "tailCommands": tail_commands,
    },
    "queue": {
        "pendingCount": queued,
        "runningCount": running,
        "completedCount": done,
        "topPending": pending_labels[:5],
        "topRunning": running_labels[:5],
    },
    "agents": {
        "summary": agent_summary,
        "health": agent_entries,
        "roles": roles,
        "active": active_agents,
        "chiefAssignments": chief_assignments[:10] if isinstance(chief_assignments, list) else [],
    },
    "ci": {
        "tests": ci.get("tests", {}).get("status", "unknown"),
        "lint": ci.get("lint", {}).get("status", "unknown"),
        "mergeAllowed": ci.get("mergeAllowed", False),
        "checks": pr.get("checks", {}),
    },
    "handoff": {
        "status": handoff.get("status", "none"),
        "timedOutAt": handoff.get("timedOutAt"),
        "timeoutMinutes": handoff.get("timeoutMinutes", 1),
        "owners": active_agents,
        "reason": handoff.get("reason"),
    },
    "workflow": {
        "completed": len(workflow.get("completedWorkflows", [])),
        "inProgress": len(workflow.get("inProgressWorkflows", [])),
        "resourceUsage": runtime,
    },
    "stakeholderViews": build_stakeholder_views(
        {
            "overallPercent": overall,
            "remainingPercent": remaining,
            "etaLabel": eta_label,
            "currentStage": current_stage,
        },
        {
            "capacity": {
                "currentPercent": current_capacity,
                "targetMinPercent": target_min,
                "targetMaxPercent": target_max,
            },
            "localAgentsOnly": bool(ctrl.get("guardrails", {}).get("LOCAL_AGENTS_ONLY", True)),
        },
        {
            "pendingCount": queued,
            "runningCount": running,
            "completedCount": done,
            "topPending": pending_labels,
            "topRunning": running_labels,
        },
        agent_summary,
        {
            "tests": ci.get("tests", {}).get("status", "unknown"),
            "lint": ci.get("lint", {}).get("status", "unknown"),
            "mergeAllowed": ci.get("mergeAllowed", False),
            "failing": ci.get("checks", {}).get("failing", 0),
        },
        handoff,
        {
            "completed": len(workflow.get("completedWorkflows", [])),
            "inProgress": len(workflow.get("inProgressWorkflows", [])),
        },
    ),
    "summaryLine": summary_line,
    "tailCommands": tail_commands,
}

write_json(dashboard_path, snapshot)
write_text(status_line_path, summary_line)
write_text(tracker_log_path, summary_line)

print(summary_line)
PY
}

if [ "$RUN_ONCE" -eq 1 ]; then
  render_snapshot
  exit 0
fi

while true; do
  render_snapshot
  sleep 10
done
