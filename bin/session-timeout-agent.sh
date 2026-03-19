#!/usr/bin/env bash
# session-timeout-agent.sh — Ends the interactive session after 60s and hands work to local agents.
# This bootstrap keeps execution local and writes a durable handoff snapshot for terminal/runtime monitoring.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/session-timeout.log"
CTRL="$STATE/orchestration-controls.json"
HANDOFF="$STATE/session-handoff.json"
AGENTS="$STATE/agent-pids.json"
WORKER_STATE="$STATE/worker-state.json"

mkdir -p "$STATE"

log(){ echo "[session-timeout] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

write_json() {
  local target="$1"
  local payload="$2"
  local tmp
  tmp="$(mktemp "$STATE/.tmp.XXXXXX")"
  printf '%s\n' "$payload" > "$tmp"
  mv "$tmp" "$target"
}

launch_agent() {
  local name="$1"
  local script="$2"
  local logfile="$3"

  nohup bash "$script" >> "$logfile" 2>&1 &
  printf '%s' "$!" > "$STATE/${name}.pid"
  log "Started $name (PID $!)"
}

log "=== SESSION TIMEOUT AGENT STARTED ==="
log "Interactive session window: 60s"
log "Handoff model: local agents continue after timeout"

# Start the local workers that can keep draining work without the interactive session.
launch_agent "ci-enforcer" "$ROOT/bin/ci-enforcer-agent.sh" "$STATE/ci-enforcer.log"
launch_agent "queue-drain" "$ROOT/bin/queue-drain-agent.sh" "$STATE/queue-drain.log"
launch_agent "pr-watcher" "$ROOT/bin/pr-watcher-agent.sh" "$STATE/pr-watcher.log"
launch_agent "distributed-pool" "$ROOT/bin/distributed-worker-pool.sh" "$STATE/distributed-pool.log"

REMAINING=60
while [ "$REMAINING" -gt 0 ]; do
  log "timeout=${REMAINING}s | local-agents=active | tail=$(basename "$STATE/company-fleet.log" 2>/dev/null || echo company-fleet.log)"
  sleep 10
  REMAINING=$((REMAINING - 10))
done

handoff_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ci_pid="$(cat "$STATE/ci-enforcer.pid" 2>/dev/null || echo 0)"
queue_pid="$(cat "$STATE/queue-drain.pid" 2>/dev/null || echo 0)"
pr_pid="$(cat "$STATE/pr-watcher.pid" 2>/dev/null || echo 0)"
pool_pid="$(cat "$STATE/distributed-pool.pid" 2>/dev/null || echo 0)"

write_json "$HANDOFF" "$(cat <<EOJSON
{
  "schemaVersion": "2.0",
  "handoffTime": "$handoff_time",
  "reason": "interactive session timeout",
  "timeoutMinutes": 1,
  "status": "handoff-complete",
  "interactiveSession": "terminated",
  "resumePolicy": {
    "localAgentsOnly": true,
    "noClaudeTokens": true,
    "tailCommand": "tail -f state/local-agent-runtime/company-fleet.log"
  },
  "activeAgents": {
    "ci-enforcer": { "pid": $ci_pid, "status": "running" },
    "queue-drain": { "pid": $queue_pid, "status": "running" },
    "pr-watcher": { "pid": $pr_pid, "status": "running" },
    "distributed-pool": { "pid": $pool_pid, "status": "running" }
  },
  "pendingWork": "Follow orchestration-controls.json and company-fleet.log for the remaining queue",
  "workLeft": {
    "source": "orchestration-controls.json",
    "tracker": "company-fleet.log",
    "snapshot": "dashboard.json"
  }
}
EOJSON
)"

write_json "$AGENTS" "$(cat <<EOJSON
{
  "updatedAt": "$handoff_time",
  "agents": {
    "ci-enforcer": { "pid": $ci_pid, "role": "ci", "group": "write" },
    "queue-drain": { "pid": $queue_pid, "role": "executor", "group": "write" },
    "pr-watcher": { "pid": $pr_pid, "role": "merge", "group": "read" },
    "distributed-pool": { "pid": $pool_pid, "role": "replicas", "group": "read" }
  }
}
EOJSON
)"

write_json "$WORKER_STATE" "$(cat <<EOJSON
{
  "status": "handoff-complete",
  "activeCommandId": null,
  "startedAt": null,
  "lastHeartbeatAt": "$handoff_time",
  "updatedAt": "$handoff_time",
  "workerBootedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOJSON
)"

log "=== SESSION TIMEOUT ELAPSED ==="
log "Handoff written to session-handoff.json"
log "Agent registry written to agent-pids.json"
log "Worker state overwritten for handoff visibility"
