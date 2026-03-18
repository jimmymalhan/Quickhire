#!/usr/bin/env bash
# orchestration-monitor.sh — Prints live status every 10 seconds
# Reads orchestrator-system.json + orchestration-controls.json
# Reports: progress, orchestrator states, CI checks, task counts

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
ORCH="$STATE/orchestrator-system.json"
CTRL="$STATE/orchestration-controls.json"
LOG="$STATE/monitor-output.log"

mkdir -p "$STATE"

log(){ echo "$*" | tee -a "$LOG"; }

while true; do
  TIMESTAMP=$(date -u +%H:%M:%S)

  # Read orchestrator stats
  COMPLETED=$(cat "$CTRL" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('completedTasks',[])))" 2>/dev/null || echo "0")
  PENDING=$(cat "$CTRL" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('pendingCommands',[])))" 2>/dev/null || echo "0")
  PROGRESS=$(cat "$CTRL" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('workerProgress',0))" 2>/dev/null || echo "0")

  # Read orchestrator statuses
  ORCH_COUNT=$(cat "$ORCH" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('orchestrators',[])))" 2>/dev/null || echo "0")

  # Check PR #3 CI status
  PR_STATUS=$(cd "$ROOT" && gh pr checks 3 2>/dev/null | head -5 || echo "unknown")

  # Print dashboard
  log "═══════════════════════════════════════════════════════"
  log "[$TIMESTAMP] QUICKHIRE AGENT ORCHESTRATION"
  log "═══════════════════════════════════════════════════════"
  log "Progress: ${PROGRESS}% | Completed: $COMPLETED | Pending: $PENDING"
  log "Orchestrators: $ORCH_COUNT active"
  log "PR #3 CI: $PR_STATUS"
  log "Claude: BLOCKED (0 tokens) | Agents: ACTIVE"
  log "═══════════════════════════════════════════════════════"
  log ""

  sleep 10
done
