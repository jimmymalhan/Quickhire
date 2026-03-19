#!/usr/bin/env bash
# queue-drain-agent.sh — Reads orchestration-controls.json, executes pending tasks
# This is the actual WORKER that consumes the task queue.
# Picks up tasks in sequence order, executes them, marks complete.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
CTRL="$STATE/orchestration-controls.json"
LOG="$STATE/queue-drain.log"
STATE_SNAPSHOT="$STATE/worker-state.json"

mkdir -p "$STATE"

log(){ echo "[queue-drain] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

write_controls_snapshot() {
  local task_id="$1"
  local status="$2"
  local label="$3"
  local detail="$4"

  python3 - "$CTRL" "$task_id" "$status" "$label" "$detail" <<'PY'
import datetime as dt
import json
import pathlib
import sys

ctrl_path = pathlib.Path(sys.argv[1])
task_id = sys.argv[2]
status = sys.argv[3]
label = sys.argv[4]
detail = sys.argv[5]

try:
    data = json.loads(ctrl_path.read_text())
except Exception:
    data = {"completedTasks": [], "pendingCommands": [], "guardrails": {}, "orchestration": {}}

pending = data.get("pendingCommands", [])
completed = data.setdefault("completedTasks", [])
now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
next_pending = []

for task in pending:
    if task.get("id") == task_id:
        task["status"] = status
        task["updatedAt"] = now
        if detail:
            task["result"] = detail
        if status in {"COMPLETE", "DONE"}:
            continue
    next_pending.append(task)

data["pendingCommands"] = next_pending

if status in {"COMPLETE", "DONE"}:
    if not any(item.get("id") == task_id for item in completed):
        completed.append({
            "id": task_id,
            "status": "DONE",
            "label": label,
            "result": detail or "completed by queue-drain-agent",
            "completedAt": now,
        })

done_count = len(completed)
total_count = len(completed) + len(next_pending)
progress = int((done_count / total_count) * 100) if total_count else int(data.get("workerProgress", 0) or 0)

data["workerProgress"] = progress
data["updatedAt"] = now
data.setdefault("runtime", {})
data["runtime"].update({
    "targetCapacityMin": data["runtime"].get("targetCapacityMin", 80),
    "targetCapacityMax": data["runtime"].get("targetCapacityMax", 90),
    "tailLog": data["runtime"].get("tailLog", "state/local-agent-runtime/company-fleet.log"),
})

ctrl_path.write_text(json.dumps(data, indent=2) + "\n")
PY
}

write_worker_state() {
  local task_id="$1"
  local status="$2"
  local heartbeat="$3"
  cat > "$STATE_SNAPSHOT" << EOJSON
{
  "status": "$status",
  "activeCommandId": "$task_id",
  "startedAt": "$heartbeat",
  "lastHeartbeatAt": "$heartbeat",
  "updatedAt": "$heartbeat",
  "workerBootedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOJSON
}

execute_task() {
  local task_id="$1"
  local command="$2"
  local label="$3"
  local started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  log "▶️ Executing: $label"
  log "  Command: $command"
  write_controls_snapshot "$task_id" "RUNNING" "$label" "started"
  write_worker_state "$task_id" "running" "$started_at"

  # Execute the command
  local output
  output=$(cd "$ROOT" && eval "$command" 2>&1)
  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    log "✅ $task_id completed (exit 0)"
  else
    log "❌ $task_id failed (exit $exit_code): $output"
  fi

  if [ $exit_code -eq 0 ]; then
    write_controls_snapshot "$task_id" "COMPLETE" "$label" "exit=0"
  else
    write_controls_snapshot "$task_id" "FAILED" "$label" "exit=$exit_code"
  fi
  write_worker_state "$task_id" "idle" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

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
  TASK=$(python3 -c "
import json
try:
    d = json.load(open('$CTRL'))
    for t in d.get('pendingCommands', []):
        status = t.get('status', 'READY')
        if status in ('READY', 'ready') and 'command' in t.get('value', {}):
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
