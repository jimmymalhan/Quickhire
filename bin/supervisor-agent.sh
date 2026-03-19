#!/usr/bin/env bash
# supervisor-agent.sh — Self-heals stale workers.
# Detects if running Node process has stale module cache (registry files newer than process start),
# restarts it gracefully, waits for health, reports result.
#
# Called by supervisor-agent entry in agentRegistry.js.
# AGENT_PROMPT injected by agentRouter.spawnAgent().

set -euo pipefail

ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG="$ROOT/state/local-agent-runtime/supervisor.log"
STATE_FILE="$ROOT/state/local-agent-runtime/worker-state.json"
HEALTH_URL="http://localhost:8000/api/health"
POLL_MAX=20
POLL_INTERVAL=2

log() { echo "[supervisor] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

write_state() {
  local status="$1"
  local action="$2"
  local pid="$3"
  python3 - "$STATE_FILE" "$status" "$action" "$pid" <<'PY'
import datetime as dt
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
payload = {
    "status": sys.argv[2],
    "action": sys.argv[3],
    "activeCommandId": "supervisor-agent",
    "pid": int(sys.argv[4]) if sys.argv[4].isdigit() else None,
    "startedAt": None,
    "lastHeartbeatAt": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "updatedAt": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
}
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
}

# ── find the running server PID ───────────────────────────────────────────────
find_pid() {
  pgrep -f "node src/index.js" 2>/dev/null | head -1 || true
}

# ── check if restart is needed ────────────────────────────────────────────────
needs_restart() {
  local pid
  pid=$(find_pid)
  [[ -z "$pid" ]] && { log "No running process found — restart needed"; return 0; }

  # Get process start time in epoch seconds
  local proc_start
  proc_start=$(ps -o lstart= -p "$pid" 2>/dev/null || echo "")
  [[ -z "$proc_start" ]] && return 0

  local proc_epoch
  proc_epoch=$(date -j -f "%c" "$proc_start" "+%s" 2>/dev/null || date -d "$proc_start" "+%s" 2>/dev/null || echo "0")

  # Check if any registry/router file is newer than the process
  local newest=0
  for f in "$ROOT/src/automation/agentRegistry.js" \
            "$ROOT/src/automation/agentRouter.js" \
            "$ROOT/src/automation/agentWorker.js" \
            "$ROOT/src/automation/agentWatchdog.js"; do
    [[ -f "$f" ]] || continue
    local mtime
    mtime=$(stat -f "%m" "$f" 2>/dev/null || stat -c "%Y" "$f" 2>/dev/null || echo "0")
    (( mtime > newest )) && newest=$mtime
  done

  if (( newest > proc_epoch )); then
    log "Stale worker detected: files modified after process start (proc=$proc_epoch, files=$newest)"
    return 0
  fi

  log "Worker is fresh — no restart needed (proc=$proc_epoch >= files=$newest)"
  return 1
}

# ── health check ──────────────────────────────────────────────────────────────
wait_healthy() {
  local i=0
  while (( i < POLL_MAX )); do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      log "Health check passed after ${i}x${POLL_INTERVAL}s"
      return 0
    fi
    sleep "$POLL_INTERVAL"
    (( i++ ))
  done
  log "ERROR: server did not become healthy after $((POLL_MAX * POLL_INTERVAL))s"
  return 1
}

# ── restart ───────────────────────────────────────────────────────────────────
do_restart() {
  local pid
  pid=$(find_pid)

  if [[ -n "$pid" ]]; then
    log "Sending SIGTERM to PID $pid"
    kill -TERM "$pid" 2>/dev/null || true
    local i=0
    while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do
      sleep 1; (( i++ ))
    done
    if kill -0 "$pid" 2>/dev/null; then
      log "Process did not exit after SIGTERM, sending SIGKILL"
      kill -KILL "$pid" 2>/dev/null || true
    fi
    log "Old process stopped"
  fi

  # Start fresh
  log "Starting node src/index.js"
  nohup node "$ROOT/src/index.js" >> "$ROOT/state/local-agent-runtime/server.log" 2>&1 &
  disown
  write_state "running" "restart" "$pid"

  wait_healthy && log "Restart complete — new worker loaded fresh module cache" || {
    log "ERROR: restart failed — server not healthy"
    write_state "blocked" "restart_failed" "$pid"
    exit 1
  }
}

# ── main ──────────────────────────────────────────────────────────────────────
ACTION="${AGENT_PROMPT:-check}"

case "$ACTION" in
  *restart*|*reload*|*stale*|*refresh*)
    log "Forced restart requested"
    do_restart
    write_state "running" "forced_restart" "$(find_pid)"
    echo "supervisor-agent: restart complete, worker running with fresh module cache"
    ;;
  *)
    if needs_restart; then
      do_restart
      write_state "running" "auto_restart" "$(find_pid)"
      echo "supervisor-agent: auto-restart complete, stale module cache cleared"
    else
      write_state "idle" "health_check" "$(find_pid)"
      echo "supervisor-agent: worker is current, no restart needed"
    fi
    ;;
esac
