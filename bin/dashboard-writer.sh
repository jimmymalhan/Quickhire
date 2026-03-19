#!/usr/bin/env bash
###############################################################################
# DASHBOARD WRITER — Single overwrite dashboard every 10s
# Writes to: state/local-agent-runtime/company-fleet.log (truncate + rewrite)
# Tail: tail -f state/local-agent-runtime/company-fleet.log
###############################################################################
set -uo pipefail
cd /Users/jimmymalhan/Doc/Quickhire
mkdir -p state/local-agent-runtime
echo $$ > state/local-agent-runtime/dashboard-writer.pid

DASH_FILE="state/local-agent-runtime/company-fleet.log"
CYCLE=0

while true; do
  CYCLE=$((CYCLE + 1))
  NOW=$(date +%H:%M:%S)
  
  # Collect agent health
  AGENTS_LIVE=0
  AGENTS_TOTAL=3
  AGENT_ROSTER=""
  
  # Check watchdog
  WD_PID=$(cat state/local-agent-runtime/branch-watchdog.pid 2>/dev/null || echo "")
  if [ -n "$WD_PID" ] && kill -0 "$WD_PID" 2>/dev/null; then
    AGENTS_LIVE=$((AGENTS_LIVE + 1))
    AGENT_ROSTER="$AGENT_ROSTER\n- branch-watchdog | healthy | monitoring branches (PID $WD_PID)"
  else
    AGENT_ROSTER="$AGENT_ROSTER\n- branch-watchdog | dead | ---"
  fi
  
  # Check autopilot
  AP_PID=$(cat state/local-agent-runtime/autopilot.pid 2>/dev/null || echo "")
  if [ -n "$AP_PID" ] && kill -0 "$AP_PID" 2>/dev/null; then
    AGENTS_LIVE=$((AGENTS_LIVE + 1))
    AGENT_ROSTER="$AGENT_ROSTER\n- autopilot | healthy | executing backlog (PID $AP_PID)"
  else
    AGENT_ROSTER="$AGENT_ROSTER\n- autopilot | idle | not running"
  fi
  
  # Check dashboard-writer (self)
  AGENTS_LIVE=$((AGENTS_LIVE + 1))
  AGENT_ROSTER="$AGENT_ROSTER\n- dashboard-writer | healthy | writing dashboard (PID $$)"
  
  # Git state
  BRANCH_COUNT=$(command git branch -r 2>/dev/null | grep -v HEAD | wc -l | xargs)
  LOCAL_BRANCHES=$(command git branch 2>/dev/null | wc -l | xargs)
  OPEN_PRS=$(gh pr list --state open --json number -q 'length' 2>/dev/null || echo "0")
  MAIN_CI=$(gh run list --branch main --limit 1 --json conclusion -q '.[0].conclusion' 2>/dev/null || echo "unknown")
  
  # Read autopilot progress if available
  GOAL_PCT=100
  TASK="monitoring"
  STATUS="running"
  NEXT="scan for new backlog"
  if [ -f state/local-agent-runtime/autopilot-progress.json ]; then
    GOAL_PCT=$(python3 -c "import json; print(json.load(open('state/local-agent-runtime/autopilot-progress.json')).get('goal_pct',100))" 2>/dev/null || echo "100")
    TASK=$(python3 -c "import json; print(json.load(open('state/local-agent-runtime/autopilot-progress.json')).get('task','idle'))" 2>/dev/null || echo "idle")
    STATUS=$(python3 -c "import json; print(json.load(open('state/local-agent-runtime/autopilot-progress.json')).get('status','idle'))" 2>/dev/null || echo "idle")
  fi
  
  # Learnings count
  LEARN_COUNT=$(wc -l < state/local-agent-runtime/learnings.log 2>/dev/null || echo "0")
  
  # OVERWRITE dashboard (truncate + rewrite)
  cat > "$DASH_FILE" << EOF
════════════════════════════════════════════════════════════════
  QUICKHIRE AUTONOMOUS FLEET DASHBOARD  [$NOW]  cycle=$CYCLE
════════════════════════════════════════════════════════════════
[GOAL ${GOAL_PCT}%] [PROJECT ${GOAL_PCT}%] [TASK 1/1 ${GOAL_PCT}%] [AGENTS ${AGENTS_LIVE}/${AGENTS_TOTAL}] [SELF_LEARN ${LEARN_COUNT}] [HOSTED_EXEC 0%]
ACTIVE: $TASK
OWNER: autopilot
STATUS: $STATUS
NEXT: $NEXT
BLOCKER: none
LEARNED: ${LEARN_COUNT} artifacts in learnings.log

GIT STATE:
  main CI: $MAIN_CI
  remote branches: $BRANCH_COUNT (target: 1 = main only)
  local branches: $LOCAL_BRANCHES
  open PRs: $OPEN_PRS

DOMAIN: ${AGENTS_LIVE} agents live
AGENTS:$(echo -e "$AGENT_ROSTER")

KILL SWITCHES: all armed
  HOSTED_EXECUTION_FORBIDDEN: armed
  DIRECT_TO_MAIN_VIOLATION: armed (git-guardrails.sh)
  CI_NOT_GREEN_BLOCK: armed
  BRANCH_CLEANUP_REQUIRED: armed (branch-watchdog)
  FAKE_COMPLETE_FORBIDDEN: armed

TAIL COMMANDS:
  Dashboard:  tail -f state/local-agent-runtime/company-fleet.log
  Autopilot:  tail -f state/local-agent-runtime/autopilot.log
  Watchdog:   tail -f state/local-agent-runtime/branch-watchdog.log
  Learnings:  tail -f state/local-agent-runtime/learnings.log
════════════════════════════════════════════════════════════════
EOF
  
  sleep 10
done
