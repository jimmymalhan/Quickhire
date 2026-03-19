#!/usr/bin/env bash
# stop.sh — Stop ALL agents
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
log(){ printf '[%s] [STOP] %s\n' "$(date +%H:%M:%S)" "$1"; }
log "Stopping all agents..."
for n in meta-supervisor watchdog company-fleet branch-watchdog autopilot governor ci-green-orchestrator orchestration-monitor token-guard; do
  pf="$STATE/$n.pid"
  if [ -f "$pf" ]; then pid=$(cat "$pf" 2>/dev/null||echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null && log "Killed $n (pid $pid)"
    else log "Already dead: $n"; fi; rm -f "$pf"; fi
done
pkill -f "company-fleet.sh"     2>/dev/null||true
pkill -f "watchdog.sh"          2>/dev/null||true
pkill -f "meta-supervisor.sh"   2>/dev/null||true
pkill -f "governor.sh"          2>/dev/null||true
pkill -f "token-guard.sh"       2>/dev/null||true
pkill -f "branch-watchdog.sh"   2>/dev/null||true
pkill -f "autopilot.sh"         2>/dev/null||true
pkill -f "ci-enforcer-agent.sh" 2>/dev/null||true
pkill -f "orchestration-monitor.sh" 2>/dev/null||true
log "Done."
