#!/usr/bin/env bash
# session-timeout-agent.sh — Kills Claude session after 1 minute, agents continue
# Hard rule: Claude gets 60 seconds max, then local agents take over completely.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/session-timeout.log"
CTRL="$STATE/orchestration-controls.json"

mkdir -p "$STATE"

log(){ echo "[session-timeout] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

log "=== SESSION TIMEOUT AGENT STARTED ==="
log "Claude has 60 seconds. After that, local agents only."
log "Timer started at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Start all other agents immediately (they work in parallel with Claude's 60s)
log "Starting CI-enforcer agent..."
nohup bash "$ROOT/bin/ci-enforcer-agent.sh" >> "$STATE/ci-enforcer.log" 2>&1 &
CI_PID=$!
log "CI-enforcer started (PID: $CI_PID)"

log "Starting orchestration monitor..."
nohup bash "$ROOT/bin/orchestration-monitor.sh" >> "$STATE/monitor.log" 2>&1 &
MON_PID=$!
log "Monitor started (PID: $MON_PID)"

# Wait 60 seconds
REMAINING=60
while [ "$REMAINING" -gt 0 ]; do
  log "⏱️  Claude session timeout in ${REMAINING}s | CI-enforcer: running | Monitor: running"
  sleep 10
  REMAINING=$((REMAINING - 10))
done

log "=== 60 SECONDS ELAPSED ==="
log "Claude session TERMINATED. Local agents continue."
log "Active agents: ci-enforcer (PID $CI_PID), monitor (PID $MON_PID)"

# Update orchestration state
cat > "$STATE/session-handoff.json" << EOJSON
{
  "handoffTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "60-second session timeout",
  "claudeStatus": "TERMINATED",
  "activeAgents": {
    "ci-enforcer": { "pid": $CI_PID, "status": "running" },
    "monitor": { "pid": $MON_PID, "status": "running" }
  },
  "pendingWork": "Read orchestration-controls.json for remaining tasks"
}
EOJSON

log "Handoff state written to session-handoff.json"
log "Local agents will continue autonomously. No Claude tokens consumed."
