#!/usr/bin/env bash
# live-progress.sh — 10-second terminal dashboard for the local-agent runtime.
# Reads the overwrite-only dashboard snapshot when available and falls back to
# the underlying runtime state if the monitor has not started yet.

set -uo pipefail

ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
MONITOR_PID_FILE="$STATE/orchestration-monitor.pid"
MONITOR_LOG="$STATE/monitor-output.log"
LATEST_STATUS="$STATE/latest-status.txt"
MONITOR_STARTED_BY_SCRIPT=0

mkdir -p "$STATE"

start_monitor_if_needed() {
  local pid=""

  if [ -f "$MONITOR_PID_FILE" ]; then
    pid=$(cat "$MONITOR_PID_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi

  bash "$ROOT/bin/orchestration-monitor.sh" >> "$MONITOR_LOG" 2>&1 &
  pid=$!
  echo "$pid" > "$MONITOR_PID_FILE"
  MONITOR_STARTED_BY_SCRIPT=1
}

cleanup_monitor() {
  if [ "$MONITOR_STARTED_BY_SCRIPT" -eq 1 ] && [ -f "$MONITOR_PID_FILE" ]; then
    local pid
    pid=$(cat "$MONITOR_PID_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$MONITOR_PID_FILE"
  fi
}

refresh_board_async() {
  bash "$ROOT/bin/orchestration-monitor.sh" --once >> "$MONITOR_LOG" 2>&1 &
}

render_recent_activity() {
  python3 - "$STATE/company-fleet.log" <<'PY'
import pathlib
import sys

log_path = pathlib.Path(sys.argv[1])

lines = []
if log_path.exists():
    try:
        lines = [line.rstrip() for line in log_path.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip()]
    except Exception:
        lines = []

tail = lines[-8:]

print("")
print("  ── RECENT FLEET ACTIVITY ───────────────────────────────")
if tail:
    for line in tail:
        print(f"  {line}")
else:
    print("  no fleet activity yet")
PY
}

render_dashboard() {
  python3 - "$STATE/dashboard.json" "$STATE/progress.json" "$STATE/orchestration-controls.json" "$STATE/chief-summary.json" "$STATE/worker-state.json" "$STATE/session-handoff.json" "$STATE/agent-health.json" <<'PY'
import json
import pathlib
import sys

dashboard_path = pathlib.Path(sys.argv[1])
progress_path = pathlib.Path(sys.argv[2])
controls_path = pathlib.Path(sys.argv[3])
chief_path = pathlib.Path(sys.argv[4])
worker_state_path = pathlib.Path(sys.argv[5])
handoff_path = pathlib.Path(sys.argv[6])
agent_health_path = pathlib.Path(sys.argv[7])


def read_json(path, fallback):
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def clamp(value, low, high, fallback):
    try:
        value = int(value)
    except Exception:
        value = fallback
    return max(low, min(high, value))


def bar(percent, width=30):
    percent = clamp(percent, 0, 100, 0)
    filled = int(width * percent / 100)
    return "[" + ("█" * filled) + ("░" * (width - filled)) + "]"


def eta_from(percent):
    if percent >= 100:
        return "DONE"
    if percent >= 95:
        return "<1 min"
    if percent >= 85:
        return "~1-3 min"
    if percent >= 70:
        return "~3-5 min"
    return "~5+ min"


def build_stakeholder_views(project, controls, queue, agents, ci, handoff, workflow):
    capacity = controls.get("capacity", {})
    summary = agents.get("summary", {})
    overall = clamp(project.get("overallPercent", 0), 0, 100, 0)
    remaining = clamp(project.get("remainingPercent", 100 - overall), 0, 100, max(0, 100 - overall))
    eta_label = project.get("etaLabel") or eta_from(overall)
    pending = queue.get("pendingCount", 0)
    running = queue.get("runningCount", 0)
    completed = queue.get("completedCount", 0)
    top_pending = ", ".join(queue.get("topPending", [])[:3]) or "none"
    top_running = ", ".join(queue.get("topRunning", [])[:3]) or "none"
    local_only = controls.get("localAgentsOnly", True)
    merge_allowed = ci.get("mergeAllowed", False)
    risks = []
    if ci.get("checks", {}).get("failing", 0):
        risks.append(f"{ci['checks']['failing']} failing checks")
    if handoff.get("status") not in {"none", "complete", "done"}:
        risks.append(f"handoff {handoff.get('status')}")
    if pending:
        risks.append(f"{pending} queued items")
    if not risks:
        risks.append("no blocking risks")

    return {
        "cto": {
            "title": "Merge gate and release confidence",
            "headline": "Keep the release safe, the gate green, and the capacity band intact.",
            "metrics": [
                f"mergeAllowed={merge_allowed}",
                f"tests={ci.get('tests', 'unknown')} lint={ci.get('lint', 'unknown')}",
                f"overall={overall}% eta={eta_label}",
                f"capacity={capacity.get('currentPercent', overall)}% target={capacity.get('targetMinPercent', 80)}-{capacity.get('targetMaxPercent', 90)}%",
            ],
            "risks": risks[:3],
            "ask": "Hold merge until the gate is fully green and capacity stays inside the target band.",
        },
        "vp": {
            "title": "Quality, security, and health",
            "headline": "Watch test/lint quality, resource health, and any regression noise.",
            "metrics": [
                f"tests={ci.get('tests', 'unknown')} lint={ci.get('lint', 'unknown')}",
                f"healthy agents={summary.get('healthy', 0)}/{summary.get('healthChecked', 0)}",
                f"workflow completed={workflow.get('completed', 0)} in-progress={workflow.get('inProgress', 0)}",
                f"local-agents-only={local_only}",
            ],
            "risks": [
                "watch for fresh lint or test regressions",
                "watch for stale health or DB noise",
            ],
            "ask": "Keep quality gates clean before any merge action.",
        },
        "director": {
            "title": "Execution flow and ownership",
            "headline": "Track queue flow, stage ownership, and whether replicas are doing useful work.",
            "metrics": [
                f"queue pending={pending} running={running} completed={completed}",
                f"active agents={summary.get('alive', 0)}/{summary.get('total', 0)}",
                f"current stage={project.get('currentStage', 'unknown')}",
                f"top running={top_running}",
            ],
            "risks": [
                "watch for stalled queue items",
                "confirm ownership on the latest checkpoint",
            ],
            "ask": "Keep the handoff chain moving and avoid idle replicas.",
        },
        "manager": {
            "title": "Near-term work and ETA",
            "headline": "See the immediate work, the remaining load, and the next few actions.",
            "metrics": [
                f"eta={eta_label} remaining={remaining}%",
                f"top pending={top_pending}",
                f"handoff={handoff.get('status', 'none')}",
                f"queue completed={completed}",
            ],
            "risks": [
                "clear the current top pending item first",
                "reassign if a handoff times out",
            ],
            "ask": "Keep the local agents focused on the next highest-ROI task.",
        },
    }


def default_tail_commands():
    return [
        "tail -f state/local-agent-runtime/company-fleet.log",
        "tail -f state/local-agent-runtime/dashboard.status",
        "jq '.' state/local-agent-runtime/dashboard.json",
        "bash bin/orchestration-monitor.sh",
    ]


def normalize_snapshot():
    snapshot = read_json(dashboard_path, {})
    if snapshot:
        controls = snapshot.setdefault("controls", {})
        tail_commands = controls.get("tailCommands", [])
        if not isinstance(tail_commands, list) or "tail -f state/local-agent-runtime/company-fleet.log" not in tail_commands:
            controls["tailCommands"] = default_tail_commands()
        snapshot.setdefault(
            "stakeholderViews",
            build_stakeholder_views(
                snapshot.get("project", {}),
                snapshot.get("controls", {}),
                snapshot.get("queue", {}),
                snapshot.get("agents", {}),
                snapshot.get("ci", {}),
                snapshot.get("handoff", {}),
                snapshot.get("workflow", {}),
            ),
        )
        return snapshot

    progress = read_json(progress_path, {})
    controls = read_json(controls_path, {})
    chief = read_json(chief_path, {})
    worker_state = read_json(worker_state_path, {})
    handoff = read_json(handoff_path, {})
    agent_health = read_json(agent_health_path, {})

    overall = clamp(progress.get("overall", {}).get("percent", controls.get("workerProgress", 0)), 0, 100, 0)
    remaining = clamp(progress.get("overall", {}).get("remaining_percent", 100 - overall), 0, 100, max(0, 100 - overall))
    eta_label = eta_from(overall)
    agents = agent_health.get("agents", []) if isinstance(agent_health, dict) else []
    healthy = sum(1 for item in agents if str(item.get("status", "")).lower() == "healthy")
    active_agents = handoff.get("activeAgents", {}) if isinstance(handoff, dict) else {}
    queue = controls.get("pendingCommands", []) if isinstance(controls, dict) else []

    return {
        "generatedAt": snapshot.get("generatedAt") if snapshot else None,
        "project": {
            "name": progress.get("task") or controls.get("controller", {}).get("mode", "Quickhire local-agent runtime"),
            "status": progress.get("overall", {}).get("status", "running"),
            "overallPercent": overall,
            "remainingPercent": remaining,
            "etaMinutes": eta_label,
            "etaLabel": eta_label,
            "currentStage": progress.get("current_stage") or "running",
        },
        "controls": {
            "mode": controls.get("orchestration", {}).get("mode", "LOCAL_AGENTS_ONLY"),
            "localAgentsOnly": True,
            "capacity": {
                "currentPercent": clamp(worker_state.get("capacity", overall), 0, 100, overall),
                "targetMinPercent": 80,
                "targetMaxPercent": 90,
            },
            "replicas": {"read": 3, "write": 3, "monitor": 2, "merge": 2},
            "tailCommands": default_tail_commands(),
        },
        "queue": {
            "pendingCount": sum(1 for item in queue if str(item.get("status", "")).upper().startswith(("READY", "QUEUED"))),
            "runningCount": sum(1 for item in queue if str(item.get("status", "")).upper().startswith("RUNNING")),
            "completedCount": sum(1 for item in queue if str(item.get("status", "")).upper().startswith(("DONE", "COMPLETE"))),
            "topPending": [item.get("label", item.get("id", "untitled")) for item in queue if str(item.get("status", "")).upper().startswith(("READY", "QUEUED"))][:5],
            "topRunning": [item.get("label", item.get("id", "untitled")) for item in queue if str(item.get("status", "")).upper().startswith("RUNNING")][:5],
        },
        "agents": {
            "summary": {
                "alive": sum(1 for item in active_agents.values() if isinstance(item, dict) and item.get("status", "").lower() == "running"),
                "total": len(active_agents),
                "healthChecked": len(agents),
                "healthy": healthy,
            },
            "health": [
                {
                    "id": item.get("id", "agent"),
                    "name": item.get("name", item.get("id", "agent")),
                    "status": item.get("status", "unknown"),
                    "checkedAt": item.get("checkedAt"),
                }
                for item in agents
            ],
            "roles": [
                {"name": "orchestrator-monitor", "status": "running", "doing": "refreshing dashboard.json every 10s", "replicas": 2},
                {"name": "session-chief", "status": str(chief.get("status", "running")).lower(), "doing": chief.get("selected", "choosing next highest-ROI task"), "replicas": 1},
                {"name": "supervisor", "status": str(worker_state.get("status", "idle")).lower(), "doing": worker_state.get("action") or "health-checking local workers", "replicas": 1},
            ],
            "active": active_agents,
        },
        "ci": {
            "tests": read_json(pathlib.Path("/dev/null"), {}).get("tests", {}).get("status", "unknown"),
            "lint": read_json(pathlib.Path("/dev/null"), {}).get("lint", {}).get("status", "unknown"),
            "mergeAllowed": False,
            "checks": {},
        },
        "handoff": {
            "status": handoff.get("status", "none"),
            "timedOutAt": handoff.get("timedOutAt"),
            "timeoutMinutes": handoff.get("timeoutMinutes", 1),
            "owners": active_agents,
        },
        "stakeholderViews": build_stakeholder_views(
            {
                "overallPercent": overall,
                "remainingPercent": remaining,
                "etaLabel": eta_label,
                "currentStage": progress.get("current_stage") or "running",
            },
            {
                "capacity": {
                    "currentPercent": clamp(worker_state.get("capacity", overall), 0, 100, overall),
                    "targetMinPercent": 80,
                    "targetMaxPercent": 90,
                },
                "localAgentsOnly": True,
            },
            {
                "pendingCount": sum(1 for item in queue if str(item.get("status", "")).upper().startswith(("READY", "QUEUED"))),
                "runningCount": sum(1 for item in queue if str(item.get("status", "")).upper().startswith("RUNNING")),
                "completedCount": sum(1 for item in queue if str(item.get("status", "")).upper().startswith(("DONE", "COMPLETE"))),
                "topPending": [item.get("label", item.get("id", "untitled")) for item in queue if str(item.get("status", "")).upper().startswith(("READY", "QUEUED"))][:5],
                "topRunning": [item.get("label", item.get("id", "untitled")) for item in queue if str(item.get("status", "")).upper().startswith("RUNNING")][:5],
            },
            {
                "summary": {
                    "alive": sum(1 for item in active_agents.values() if isinstance(item, dict) and item.get("status", "").lower() == "running"),
                    "total": len(active_agents),
                    "healthChecked": len(agents),
                    "healthy": healthy,
                },
                "health": [
                    {
                        "id": item.get("id", "agent"),
                        "name": item.get("name", item.get("id", "agent")),
                        "status": item.get("status", "unknown"),
                        "checkedAt": item.get("checkedAt"),
                    }
                    for item in agents
                ],
            },
            {
                "tests": ci.get("tests", {}).get("status", "unknown"),
                "lint": ci.get("lint", {}).get("status", "unknown"),
                "mergeAllowed": ci.get("mergeAllowed", False),
                "checks": pr.get("checks", {}),
            },
            {
                "status": handoff.get("status", "none"),
                "timedOutAt": handoff.get("timedOutAt"),
                "timeoutMinutes": handoff.get("timeoutMinutes", 1),
            },
            {
                "completed": len(workflow.get("completedWorkflows", [])),
                "inProgress": len(workflow.get("inProgressWorkflows", [])),
                "resourceUsage": runtime,
            },
        ),
        "summaryLine": f"TRACKER|overall={overall}%|left={remaining}%|eta={eta_label}|agents={len(active_agents)}",
    }


snapshot = normalize_snapshot()
project = snapshot.get("project", {})
controls = snapshot.get("controls", {})
queue = snapshot.get("queue", {})
agents = snapshot.get("agents", {})
ci = snapshot.get("ci", {})
handoff = snapshot.get("handoff", {})

overall = clamp(project.get("overallPercent", 0), 0, 100, 0)
remaining = clamp(project.get("remainingPercent", 100 - overall), 0, 100, max(0, 100 - overall))
eta_label = project.get("etaLabel") or eta_from(overall)
capacity = controls.get("capacity", {})
target_min = clamp(capacity.get("targetMinPercent", 80), 0, 100, 80)
target_max = clamp(capacity.get("targetMaxPercent", 90), 0, 100, 90)
current_capacity = clamp(capacity.get("currentPercent", overall), 0, 100, overall)

def icon(status):
    status = str(status).lower()
    if status in {"done", "complete", "completed"}:
        return "✅"
    if status in {"running", "in_progress"}:
        return "🔄"
    if status in {"blocked", "failed"}:
        return "❌"
    return "⏳"

print("╔══════════════════════════════════════════════════════════════╗")
print(f"║  QUICKHIRE LOCAL AGENT DASHBOARD                            ║")
print("╠══════════════════════════════════════════════════════════════╣")
print("")
print("  ┌──────────────────────┬───────────────────────────────────┐")
print(f"  │ OVERALL              │ {bar(overall)} {overall:3d}% │")
print(f"  │ LEFT                 │ {bar(remaining)} {remaining:3d}% │")
print("  └──────────────────────┴───────────────────────────────────┘")
print("")
print("  ── PROJECT ───────────────────────────────────────────────")
print("  ┌──────────────────────┬───────────────────────────────────┐")
print(f"  │ Name                 │ {project.get('name', 'Quickhire runtime integration')}")
print(f"  │ Stage                │ {project.get('currentStage', 'running')}")
print(f"  │ Status / ETA         │ {project.get('status', 'unknown')} / {eta_label}")
print("  └──────────────────────┴───────────────────────────────────┘")
print("")
print("  ── QUEUE ────────────────────────────────────────────────")
print("  ┌────────────┬────────────┬────────────┐")
print(f"  │ Pending    │ Running    │ Completed  │")
print(f"  │ {queue.get('pendingCount', 0):<10} │ {queue.get('runningCount', 0):<10} │ {queue.get('completedCount', 0):<10} │")
print("  └────────────┴────────────┴────────────┘")
if queue.get("topPending"):
    print("  Top pending:")
    for item in queue["topPending"][:5]:
        print(f"    - {item}")
if queue.get("topRunning"):
    print("  Top running:")
    for item in queue["topRunning"][:5]:
        print(f"    - {item}")
print("")
print("  ── AGENTS ───────────────────────────────────────────────")
summary = agents.get("summary", {})
print("  ┌────────────┬────────────┐")
print(f"  │ Alive      │ {summary.get('alive', 0)}/{summary.get('total', 0)}")
print(f"  │ Healthy    │ {summary.get('healthy', 0)}/{summary.get('healthChecked', 0)}")
print("  └────────────┴────────────┘")
for role in agents.get("roles", []):
    print(f"  {icon(role.get('status'))} {role.get('name', 'agent'):<20} {role.get('doing', '')}")
print("")
print("  ── STAKEHOLDER VIEWS ───────────────────────────────────")
stakeholder_views = snapshot.get("stakeholderViews", {})
role_order = [
    ("cto", "CTO"),
    ("vp", "VP"),
    ("director", "DIRECTOR"),
    ("manager", "MANAGER"),
]
for key, label in role_order:
    view = stakeholder_views.get(key, {})
    metrics = " | ".join(view.get("metrics", [])[:2]) or "no metrics"
    headline = view.get("headline", "")
    print(f"  {label:<10} {view.get('title', headline)}")
    print(f"  {'':<10} {metrics}")
    if view.get("risks"):
        print(f"  {'':<10} risk: {view['risks'][0]}")
    if view.get("ask"):
        print(f"  {'':<10} ask: {view['ask']}")
print("")
print("  ── CI / GATE ────────────────────────────────────────────")
print("  ┌────────────┬────────────┬────────────┬────────────┐")
print(f"  │ Tests      │ {ci.get('tests', 'unknown'):<10} │ Lint       │ {ci.get('lint', 'unknown'):<10} │")
print(f"  │ Merge      │ {str(ci.get('mergeAllowed', False)):<10} │ Handoff    │ {handoff.get('status', 'none'):<10} │")
print("  └────────────┴────────────┴────────────┴────────────┘")
print("")
print("  ── CAPACITY ─────────────────────────────────────────────")
print("  ┌────────────┬───────────────────────────────────┐")
print(f"  │ Current    │ {bar(current_capacity)} {current_capacity:3d}% │")
print(f"  │ Target     │ {target_min}-{target_max}%")
print("  └────────────┴───────────────────────────────────┘")
print("  Target policy: stay inside 80-90% while work remains")
print("")
print("  ── TAIL COMMANDS ───────────────────────────────────────")
for cmd in controls.get("tailCommands", [
    "tail -f state/local-agent-runtime/company-fleet.log",
    "tail -f state/local-agent-runtime/dashboard.status",
    "jq '.' state/local-agent-runtime/dashboard.json",
    "bash bin/orchestration-monitor.sh",
]):
    print(f"  {cmd}")
print("")
print("  ── ORG CHART ───────────────────────────────────────────")
print("  session-chief -> assigns next work slice")
print("  supervisor -> restarts or refreshes stale local workers")
print("  orchestrator-monitor -> overwrites runtime snapshot every 10s")
print("  replicas -> read/write/monitor/merge lanes")
print("")
print(f"  WORK LEFT: {eta_label}   LOCAL AGENTS: 100%   CLAUDE: 0%")
print("╚══════════════════════════════════════════════════════════════╝")
PY
}

render_combined_status() {
  render_dashboard
  render_recent_activity
}

trap cleanup_monitor EXIT INT TERM
start_monitor_if_needed

while true; do
  refresh_board_async
  tmp_file=$(mktemp "$STATE/latest-status.XXXXXX")
  render_combined_status > "$tmp_file"
  cp "$tmp_file" "$LATEST_STATUS"
  clear
  cat "$tmp_file"
  rm -f "$tmp_file"
  sleep 10
done
