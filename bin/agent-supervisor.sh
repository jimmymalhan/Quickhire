#!/usr/bin/env bash
# agent-supervisor.sh — Master supervisor. bash 3 compatible (macOS).
# Starts ALL agents. Restarts crashed ones. Dashboard every 10s. Never stops.
# Netflix/Amazon Chaos Monkey: agents are disposable, system is immortal.
# START: bash bin/agent-supervisor.sh

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/supervisor.log"

mkdir -p "$STATE"

log(){ echo "[supervisor] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

PID_DIR="$STATE/pids"
RESTART_DIR="$STATE/restarts"
mkdir -p "$PID_DIR" "$RESTART_DIR"

start_agent() {
  local name="$1" script="$2"
  nohup bash "$script" >> "$STATE/${name}.log" 2>&1 &
  echo "$!" > "$PID_DIR/$name"
  touch "$RESTART_DIR/$name" 2>/dev/null
  log "Started $name (PID $(cat "$PID_DIR/$name"))"
}

is_alive() {
  local pid="$1"
  [ "$pid" -gt 0 ] 2>/dev/null && kill -0 "$pid" 2>/dev/null
}

restart_if_dead() {
  local name="$1" script="$2"
  local pid=$(cat "$PID_DIR/$name" 2>/dev/null || echo "0")
  if ! is_alive "$pid"; then
    local count=$(wc -l < "$RESTART_DIR/$name" 2>/dev/null || echo "0")
    echo "r" >> "$RESTART_DIR/$name"
    log "Restarting $name (restart #$count)"
    start_agent "$name" "$script"
  fi
}

# ─── Progress bar helper ─────────────────────────────────────
progress_bar() {
  local percent="$1" width=40 label="$2"
  local filled=$((percent * width / 100))
  local empty=$((width - filled))
  printf "  %-18s [" "$label"
  local i=0
  while [ "$i" -lt "$filled" ]; do printf "#"; i=$((i+1)); done
  while [ "$i" -lt "$width" ]; do printf "."; i=$((i+1)); done
  printf "] %3d%%\n" "$percent"
}

print_dashboard() {
  local now=$(date -u +%H:%M:%S)

  # Read orchestration state
  local progress=$(python3 -c "import json; print(json.load(open('$STATE/orchestration-controls.json')).get('workerProgress',0))" 2>/dev/null || echo "0")
  local completed=$(python3 -c "import json; print(len(json.load(open('$STATE/orchestration-controls.json')).get('completedTasks',[])))" 2>/dev/null || echo "0")
  local pending=$(python3 -c "import json; print(len(json.load(open('$STATE/orchestration-controls.json')).get('pendingCommands',[])))" 2>/dev/null || echo "0")
  local total=$((completed + pending))
  if [ "$total" -eq 0 ]; then total=1; fi

  # Read CI status
  local test_status=$(python3 -c "import json; print(json.load(open('$STATE/ci-status.json')).get('tests',{}).get('status','?'))" 2>/dev/null || echo "?")
  local lint_status=$(python3 -c "import json; print(json.load(open('$STATE/ci-status.json')).get('lint',{}).get('status','?'))" 2>/dev/null || echo "?")
  local merge_ok=$(python3 -c "import json; print(json.load(open('$STATE/ci-status.json')).get('mergeAllowed','?'))" 2>/dev/null || echo "?")

  # Read PR status
  local pr_pass=$(python3 -c "import json; print(json.load(open('$STATE/pr-status.json')).get('checks',{}).get('passing',0))" 2>/dev/null || echo "?")
  local pr_pend=$(python3 -c "import json; print(json.load(open('$STATE/pr-status.json')).get('checks',{}).get('pending',0))" 2>/dev/null || echo "?")
  local pr_fail=$(python3 -c "import json; print(json.load(open('$STATE/pr-status.json')).get('checks',{}).get('failing',0))" 2>/dev/null || echo "?")
  local pr_merge=$(python3 -c "import json; print(json.load(open('$STATE/pr-status.json')).get('mergeReady',False))" 2>/dev/null || echo "?")

  # Calculate sub-progress
  local ci_pct=0
  if [ "$test_status" = "pass" ] && [ "$lint_status" = "pass" ]; then ci_pct=100;
  elif [ "$test_status" = "pass" ] || [ "$lint_status" = "pass" ]; then ci_pct=50;
  fi

  local git_pct=$((completed * 100 / total))

  local pr_pct=0
  if [ "$pr_merge" = "True" ] || [ "$pr_merge" = "true" ]; then pr_pct=100;
  elif [ "$pr_pass" != "?" ] && [ "$pr_pass" -gt 0 ] 2>/dev/null; then pr_pct=60;
  fi

  local agent_alive=0
  local agent_total=5
  for name in ci-enforcer monitor chaos-monkey pr-watcher queue-drain; do
    local pid=$(cat "$PID_DIR/$name" 2>/dev/null || echo "0")
    if is_alive "$pid"; then agent_alive=$((agent_alive + 1)); fi
  done
  local agent_pct=$((agent_alive * 100 / agent_total))

  local overall=$(( (ci_pct + git_pct + pr_pct + agent_pct) / 4 ))

  echo ""
  echo "================================================================"
  echo "  [$now] QUICKHIRE AGENT NETWORK — LIVE DASHBOARD"
  echo "================================================================"
  echo ""
  echo "  GOAL: Ship multi-orchestrator + chaos monkey to main"
  echo ""
  progress_bar "$overall"   "OVERALL"
  echo ""
  echo "  ── PROJECT ──────────────────────────────────────────────"
  progress_bar "$ci_pct"    "CI/CD"
  progress_bar "$git_pct"   "Git Operations"
  progress_bar "$pr_pct"    "PR & Merge"
  echo ""
  echo "  ── TASKS ────────────────────────────────────────────────"
  echo "  Completed: $completed | Pending: $pending | Total: $total"
  echo "  Tests: $test_status | Lint: $lint_status | Merge OK: $merge_ok"
  echo "  PR Checks: pass=$pr_pass pending=$pr_pend fail=$pr_fail merge=$pr_merge"
  echo ""
  echo "  ── AGENTS ($agent_alive/$agent_total alive) ─────────────"
  for name in ci-enforcer monitor chaos-monkey pr-watcher queue-drain; do
    local pid=$(cat "$PID_DIR/$name" 2>/dev/null || echo "0")
    local restarts=$(wc -l < "$RESTART_DIR/$name" 2>/dev/null | tr -d ' ' || echo "0")
    if is_alive "$pid"; then
      printf "    [ALIVE] %-16s PID=%-6s restarts=%s\n" "$name" "$pid" "$restarts"
    else
      printf "    [DEAD]  %-16s              restarts=%s\n" "$name" "$restarts"
    fi
  done
  echo ""
  echo "  CLAUDE=BLOCKED(0 tokens) | AGENTS=ACTIVE | CHAOS=ON"
  echo "================================================================"
}

# === MAIN ===
log "=== SUPERVISOR STARTED (PID $$) ==="

start_agent "ci-enforcer" "$ROOT/bin/ci-enforcer-agent.sh"
start_agent "monitor" "$ROOT/bin/orchestration-monitor.sh"
start_agent "chaos-monkey" "$ROOT/bin/chaos-monkey-agent.sh"
start_agent "pr-watcher" "$ROOT/bin/pr-watcher-agent.sh"
start_agent "queue-drain" "$ROOT/bin/queue-drain-agent.sh"

log "All agents launched. Supervision loop active (10s)."

while true; do
  restart_if_dead "ci-enforcer" "$ROOT/bin/ci-enforcer-agent.sh"
  restart_if_dead "monitor" "$ROOT/bin/orchestration-monitor.sh"
  restart_if_dead "chaos-monkey" "$ROOT/bin/chaos-monkey-agent.sh"
  restart_if_dead "pr-watcher" "$ROOT/bin/pr-watcher-agent.sh"
  restart_if_dead "queue-drain" "$ROOT/bin/queue-drain-agent.sh"
  print_dashboard
  print_dashboard >> "$LOG"
  sleep 10
done
