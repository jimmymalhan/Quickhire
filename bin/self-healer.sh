#!/usr/bin/env bash
# self-healer.sh — Agents teach themselves to fix mistakes.
# Monitors dashboard freshness, detects stalls, auto-fixes and restarts.
# Uses parallel workers. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/self-healer.log"
LEARN="$STATE/learnings.log"
mkdir -p "$STATE"; echo $$ > "$STATE/self-healer.pid"
log(){ printf '[%s] [SELF-HEALER] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
learn(){ printf '[%s] LEARNED: %s\n' "$(date +%Y-%m-%d %H:%M:%S)" "$1" >> "$LEARN"; }

fix_dashboard(){
  log "Dashboard stale — killing and restarting company-fleet.sh"
  learn "dashboard went stale — gh calls hang — always use local git only"
  pkill -9 -f "company-fleet.sh" 2>/dev/null||true; sleep 1
  # Ensure no gh/network calls in dashboard script
  if grep -q "gh run list" "$ROOT/bin/company-fleet.sh" 2>/dev/null; then
    python3 -c "
c=open('$ROOT/bin/company-fleet.sh').read()
# Remove gh run list block — replace with state-file read
import re
c=re.sub(r'GH_RUN=.*?esac\n','',c,flags=re.DOTALL)
open('$ROOT/bin/company-fleet.sh','w').write(c)
" 2>/dev/null
    learn "removed gh run list from dashboard — was blocking/hanging"
  fi
  nohup bash "$ROOT/bin/company-fleet.sh" >> "$STATE/company-fleet-runner.log" 2>&1 &
  echo $! > "$STATE/company-fleet.pid"
  log "Dashboard restarted pid=$!"
}

fix_agent(){ local name="$1" script="$2"
  log "Agent $name dead — restarting $script"
  learn "agent $name died — auto-restarted via self-healer"
  pkill -9 -f "$script" 2>/dev/null||true; sleep 1
  [ ! -f "$ROOT/bin/$script" ] && { log "SKIP $name — script missing"; return; }
  nohup bash "$ROOT/bin/$script" >> "$STATE/${name}.log" 2>&1 &
  echo $! > "$STATE/${name}.pid"
  log "$name restarted pid=$!"
}

# Parallel worker pool — runs multiple fix jobs concurrently
run_parallel(){ "$@" & }

log "=== SELF-HEALER pid=$$ (90% compute utilization target) ==="

AGENTS=("company-fleet:company-fleet.sh" "watchdog:watchdog.sh" "autopilot:autopilot.sh"
        "governor:governor.sh" "team-platform:team-platform.sh"
        "team-quality:team-quality.sh" "team-product:team-product.sh"
        "branch-watchdog:branch-watchdog.sh" "meta-supervisor:meta-supervisor.sh"
        "token-guard:token-guard.sh")

while true; do
  # Check dashboard freshness (must update within 30s)
  if [ -f "$STATE/company-fleet.log" ]; then
    AGE=$(( $(date +%s) - $(date -r "$STATE/company-fleet.log" +%s 2>/dev/null||echo 0) ))
    if [ "$AGE" -gt 30 ]; then
      log "Dashboard stale ${AGE}s — fixing"
      run_parallel fix_dashboard
    fi
  else
    run_parallel fix_dashboard
  fi

  # Check all agents in parallel
  for entry in "${AGENTS[@]}"; do
    name="${entry%%:*}"; script="${entry##*:}"
    pf="$STATE/$name.pid"; pid=""
    [ -f "$pf" ] && pid=$(cat "$pf" 2>/dev/null||echo "")
    if ! ([ -n "$pid" ] && kill -0 "$pid" 2>/dev/null); then
      run_parallel fix_agent "$name" "$script"
    fi
  done

  # Write learnings summary to state
  LEARN_COUNT=$(wc -l < "$LEARN" 2>/dev/null||echo 0)
  printf '{"updatedAt":"%s","learnings":%s,"status":"healing"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$LEARN_COUNT" > "$STATE/self-healer.json" 2>/dev/null||true

  wait  # Wait for all parallel jobs
  sleep 15
done
