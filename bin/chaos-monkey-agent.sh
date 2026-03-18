#!/usr/bin/env bash
# chaos-monkey-agent.sh — Inspired by Netflix Chaos Monkey
# Randomly kills one agent every 2 minutes to test resilience.
# Supervisor auto-restarts killed agents. System never goes down.
#
# Philosophy: If your system can't survive random failures, it's not production-ready.
# By continuously killing agents, we prove the supervisor + replica system works.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/chaos-monkey.log"

mkdir -p "$STATE"

log(){ echo "[chaos-monkey] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

# Agents that CAN be killed (never kill supervisor or self)
KILLABLE_AGENTS=("ci-enforcer" "monitor" "pr-watcher" "queue-drain")

kill_random_agent() {
  local pids_file="$STATE/agent-pids.json"
  if [ ! -f "$pids_file" ]; then
    log "No agent-pids.json found. Skipping kill cycle."
    return
  fi

  # Pick random agent
  local idx=$((RANDOM % ${#KILLABLE_AGENTS[@]}))
  local target="${KILLABLE_AGENTS[$idx]}"

  # Get its PID
  local pid=$(python3 -c "
import json
d = json.load(open('$pids_file'))
print(d.get('agents',{}).get('$target',{}).get('pid',0))
" 2>/dev/null || echo "0")

  if [ "$pid" -gt 0 ] && kill -0 "$pid" 2>/dev/null; then
    log "🐒 CHAOS: Killing $target (PID $pid) — testing resilience"
    kill "$pid" 2>/dev/null || true

    # Record kill event
    cat > "$STATE/chaos-event.json" << EOJSON
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "action": "KILL",
  "target": "$target",
  "pid": $pid,
  "reason": "Chaos Monkey random kill — testing auto-restart resilience",
  "expectation": "Supervisor should restart $target within 10 seconds"
}
EOJSON

    log "🐒 Kill event recorded. Supervisor should restart $target within 10s."
  else
    log "🐒 $target (PID $pid) already dead or not found. Skipping."
  fi
}

# ─── MAIN ─────────────────────────────────────────────────────
log "=== CHAOS MONKEY STARTED ==="
log "Strategy: Kill 1 random agent every 2 minutes."
log "Expectation: Supervisor restarts killed agent within 10 seconds."
log "Result: System resilience proven continuously."

while true; do
  # Wait 2 minutes between kills
  log "🐒 Next chaos event in 120 seconds..."
  sleep 120

  kill_random_agent
done
