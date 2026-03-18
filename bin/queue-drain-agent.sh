#!/usr/bin/env bash
# queue-drain-agent.sh — Reads orchestration-controls.json, executes pending tasks
# This is the actual WORKER that consumes the task queue.
# Picks up tasks in sequence order, executes them, marks complete.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
CTRL="$STATE/orchestration-controls.json"
LOG="$STATE/queue-drain.log"

mkdir -p "$STATE"

log(){ echo "[queue-drain] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

execute_task() {
  local task_id="$1"
  local command="$2"
  local label="$3"

  log "▶️ Executing: $label"
  log "  Command: $command"

  # Execute the command
  local output
  output=$(cd "$ROOT" && eval "$command" 2>&1)
  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    log "✅ $task_id completed (exit 0)"
  else
    log "❌ $task_id failed (exit $exit_code): $output"
  fi

  # Write task result
  cat > "$STATE/task-result-${task_id}.json" << EOJSON
{
  "taskId": "$task_id",
  "label": "$label",
  "exitCode": $exit_code,
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "output": $(echo "$output" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()[:500]))" 2>/dev/null || echo "\"truncated\"")
}
EOJSON

  return $exit_code
}

# ─── MAIN ─────────────────────────────────────────────────────
log "=== QUEUE DRAIN AGENT STARTED ==="

while true; do
  if [ ! -f "$CTRL" ]; then
    log "No orchestration-controls.json found. Waiting..."
    sleep 10
    continue
  fi

  # Get first READY task
  TASK=$(python3 << 'PYEOF'
import json, sys
try:
    d = json.load(open("CTRL_FILE"))
    for t in d.get("pendingCommands", []):
        status = t.get("status", "READY")
        if status == "READY" and "command" in t.get("value", {}):
            print(f"{t['id']}|||{t['value']['command']}|||{t['label']}")
            break
except:
    pass
PYEOF
  )
  TASK=$(echo "$TASK" | sed "s|CTRL_FILE|$CTRL|g")
  TASK=$(python3 -c "
import json
try:
    d = json.load(open('$CTRL'))
    for t in d.get('pendingCommands', []):
        status = t.get('status', 'READY')
        if status == 'READY' and 'command' in t.get('value', {}):
            print(f\"{t['id']}|||{t['value']['command']}|||{t['label']}\")
            break
except:
    pass
" 2>/dev/null || echo "")

  if [ -z "$TASK" ]; then
    log "No READY tasks with commands. Sleeping 15s..."
    sleep 15
    continue
  fi

  TASK_ID=$(echo "$TASK" | cut -d'|||' -f1)
  TASK_CMD=$(echo "$TASK" | cut -d'|||' -f2)
  TASK_LABEL=$(echo "$TASK" | cut -d'|||' -f3)

  execute_task "$TASK_ID" "$TASK_CMD" "$TASK_LABEL"

  sleep 5
done
