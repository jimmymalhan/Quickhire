#!/usr/bin/env bash
# watchdog.sh — Restarts any dead agent within 15s. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
mkdir -p "$STATE"; echo $$ > "$STATE/watchdog.pid"
LOG="$STATE/watchdog.log"
log(){ printf '[%s] [WATCHDOG] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
NAMES=("company-fleet" "branch-watchdog" "autopilot" "governor" "ci-green-orchestrator" "team-platform" "team-quality" "team-product")
SCRIPTS=("company-fleet.sh" "branch-watchdog.sh" "autopilot.sh" "governor.sh" "ci-enforcer-agent.sh" "team-platform.sh" "team-quality.sh" "team-product.sh")
restart(){ local n="$1" s="$2"
  [ ! -f "$ROOT/bin/$s" ] && { log "SKIP $n (missing)"; return; }
  log "RESTART $n"; nohup bash "$ROOT/bin/$s" >> "$STATE/${n}.log" 2>&1 &
  echo $! > "$STATE/${n}.pid"; log "LIVE $n pid=$!"; }
write_health(){
  local out="{\"updatedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"agents\":{"
  local sep=""
  for pf in "$STATE"/*.pid; do [ -f "$pf" ]||continue
    nm=$(basename "$pf" .pid); pid=$(cat "$pf" 2>/dev/null||echo "0")
    kill -0 "$pid" 2>/dev/null && st="LIVE"||st="OFF"
    out="${out}${sep}\"${nm}\":{\"pid\":\"${pid}\",\"status\":\"${st}\"}"
    sep=","; done
  printf '%s}}\n' "$out" > "$STATE/agent-health-live.json" 2>/dev/null||true; }
log "=== WATCHDOG pid=$$ ==="
while true; do alive=0; dead=0
  for i in "${!NAMES[@]}"; do n="${NAMES[$i]}"; s="${SCRIPTS[$i]}"
    pid=""; [ -f "$STATE/$n.pid" ] && pid=$(cat "$STATE/$n.pid" 2>/dev/null||echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then alive=$((alive+1))
    else dead=$((dead+1)); restart "$n" "$s"; fi; done
  write_health; log "alive=$alive dead=$dead"; sleep 15; done
