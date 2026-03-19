#!/usr/bin/env bash
# meta-supervisor.sh — Layer 2: watches watchdog + dashboard. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
mkdir -p "$STATE"; echo $$ > "$STATE/meta-supervisor.pid"
LOG="$STATE/meta-supervisor.log"
log(){ printf '[%s] [META-SUP] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== META-SUPERVISOR pid=$$ ==="
while true; do
  for agent in "watchdog" "company-fleet"; do
    pf="$STATE/${agent}.pid"; pid=""
    [ -f "$pf" ] && pid=$(cat "$pf" 2>/dev/null||echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then log "$agent LIVE pid=$pid"
    else log "$agent DEAD — restarting"
      nohup bash "$ROOT/bin/${agent}.sh" >> "$STATE/${agent}.log" 2>&1 &
      echo $! > "$pf"; log "$agent RESTARTED pid=$(cat "$pf")"; fi; done
  sleep 20; done
