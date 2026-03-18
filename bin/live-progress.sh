#!/usr/bin/env bash
# live-progress.sh — Real-time progress dashboard, updates every 10s
set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
CHECKPOINT="$STATE/fleet-checkpoint.json"

bar() {
  local pct="$1" label="$2" w=30
  local filled=$((pct * w / 100))
  local empty=$((w - filled))
  printf "  %-16s [" "$label"
  local i=0
  while [ $i -lt $filled ]; do printf "█"; i=$((i+1)); done
  while [ $i -lt $w ]; do printf "░"; i=$((i+1)); done
  printf "] %3d%%\n" "$pct"
}

FIRST=true
while true; do
  if [ "$FIRST" = true ]; then
    clear
    FIRST=false
  else
    tput home
  fi
  NOW=$(date -u +%H:%M:%S)

  # Read checkpoint
  STEP=$(python3 -c "import json; print(json.load(open('$CHECKPOINT')).get('step','none'))" 2>/dev/null || echo "none")
  STATUS=$(python3 -c "import json; print(json.load(open('$CHECKPOINT')).get('status','?'))" 2>/dev/null || echo "?")
  AGENT=$(python3 -c "import json; print(json.load(open('$CHECKPOINT')).get('agent','?'))" 2>/dev/null || echo "?")

  # Map step to progress
  case "$STEP" in
    none)              OVERALL=0;  CI_FIX=0;   COMMIT=0;  WAIT=0;   MERGE=0;  CLEAN=0;  VERIFY=0 ;;
    ci_fix)            OVERALL=10; CI_FIX=$( [ "$STATUS" = "done" ] && echo 100 || echo 50 ); COMMIT=0; WAIT=0; MERGE=0; CLEAN=0; VERIFY=0 ;;
    commit_push)       OVERALL=25; CI_FIX=100; COMMIT=$( [ "$STATUS" = "done" ] && echo 100 || echo 50 ); WAIT=0; MERGE=0; CLEAN=0; VERIFY=0 ;;
    wait_ci)           OVERALL=45; CI_FIX=100; COMMIT=100; WAIT=$( [ "$STATUS" = "done" ] && echo 100 || echo 50 ); MERGE=0; CLEAN=0; VERIFY=0 ;;
    merge_pr)          OVERALL=65; CI_FIX=100; COMMIT=100; WAIT=100; MERGE=$( [ "$STATUS" = "done" ] && echo 100 || echo 50 ); CLEAN=0; VERIFY=0 ;;
    cleanup)           OVERALL=80; CI_FIX=100; COMMIT=100; WAIT=100; MERGE=100; CLEAN=$( [ "$STATUS" = "done" ] && echo 100 || echo 50 ); VERIFY=0 ;;
    verify)            OVERALL=95; CI_FIX=100; COMMIT=100; WAIT=100; MERGE=100; CLEAN=100; VERIFY=$( [ "$STATUS" = "done" ] && echo 100 || echo 50 ) ;;
    all_done)          OVERALL=100; CI_FIX=100; COMMIT=100; WAIT=100; MERGE=100; CLEAN=100; VERIFY=100 ;;
    *)                 OVERALL=0;  CI_FIX=0;   COMMIT=0;  WAIT=0;   MERGE=0;  CLEAN=0;  VERIFY=0 ;;
  esac

  # CI status
  TEST_ST=$(python3 -c "import json; print(json.load(open('$STATE/ci-status.json')).get('tests',{}).get('status','?'))" 2>/dev/null || echo "?")
  LINT_ST=$(python3 -c "import json; print(json.load(open('$STATE/ci-status.json')).get('lint',{}).get('status','?'))" 2>/dev/null || echo "?")

  # PR status
  PR_NUM=$(gh pr list --state open --json number --jq '.[0].number' 2>/dev/null || echo "none")
  if [ "$PR_NUM" != "none" ] && [ "$PR_NUM" != "null" ] && [ -n "$PR_NUM" ]; then
    PR_CHECKS=$(gh pr checks "$PR_NUM" 2>&1 || echo "")
    PR_PASS=$(echo "$PR_CHECKS" | grep -ci "pass" || true)
    PR_FAIL=$(echo "$PR_CHECKS" | grep -v "Auto-Merge" | grep -ci "fail" || true)
    PR_PEND=$(echo "$PR_CHECKS" | grep -ci "pending\|running\|queued" || true)
    PR_TOTAL=$((PR_PASS + PR_FAIL + PR_PEND))
    PR_LABEL="PR #$PR_NUM"
  else
    PR_PASS=0; PR_FAIL=0; PR_PEND=0; PR_TOTAL=0; PR_LABEL="No open PR"
  fi

  # Git status
  BRANCH=$(git -C "$ROOT" branch --show-current 2>/dev/null || echo "?")
  UNCOMMITTED=$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  LOCAL_BR=$(git -C "$ROOT" branch 2>/dev/null | wc -l | tr -d ' ')

  # Agent count
  ALIVE=0; TOTAL_AGENTS=0
  if [ -d "$STATE/pids" ]; then
    for pf in "$STATE/pids"/*; do
      [ -f "$pf" ] || continue
      TOTAL_AGENTS=$((TOTAL_AGENTS + 1))
      p=$(cat "$pf" 2>/dev/null || echo "0")
      if [ "$p" -gt 0 ] && kill -0 "$p" 2>/dev/null; then
        ALIVE=$((ALIVE + 1))
      fi
    done
  fi
  if [ "$TOTAL_AGENTS" -gt 0 ]; then
    CAPACITY=$((ALIVE * 100 / TOTAL_AGENTS))
  else
    CAPACITY=0
  fi

  # ETA
  case "$STEP" in
    none|ci_fix|commit_push) ETA="~3-5 min" ;;
    wait_ci)                 ETA="~2-4 min (waiting CI)" ;;
    merge_pr)                ETA="~1 min" ;;
    cleanup|verify)          ETA="<30 sec" ;;
    all_done)                ETA="DONE" ;;
    *)                       ETA="unknown" ;;
  esac

  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  [$NOW] QUICKHIRE — LIVE AGENT PROGRESS                ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  echo "║                                                          ║"
  bar "$OVERALL" "OVERALL"
  echo "║                                                          ║"
  echo "║  ── AGENT TASKS ─────────────────────────────────────── ║"
  bar "$CI_FIX"  "CI Fix"
  bar "$COMMIT"  "Commit & Push"
  bar "$WAIT"    "Wait CI Green"
  bar "$MERGE"   "Merge PR"
  bar "$CLEAN"   "Cleanup"
  bar "$VERIFY"  "Final Verify"
  echo "║                                                          ║"
  echo "║  ── STATUS ──────────────────────────────────────────── ║"
  printf "  Active Agent:   %-20s Status: %s\n" "$AGENT" "$STATUS"
  printf "  Current Step:   %-20s ETA:    %s\n" "$STEP" "$ETA"
  printf "  Branch:         %-20s Uncommitted: %s\n" "$BRANCH" "$UNCOMMITTED"
  printf "  Local Tests:    %-20s Lint: %s\n" "$TEST_ST" "$LINT_ST"
  echo "║                                                          ║"
  echo "║  ── CI PIPELINE ($PR_LABEL) ─────────────────────────── ║"
  printf "  Passing: %-3s  Failing: %-3s  Pending: %-3s  Total: %s\n" "$PR_PASS" "$PR_FAIL" "$PR_PEND" "$PR_TOTAL"
  echo "║                                                          ║"
  echo "║  ── AGENTS ──────────────────────────────────────────── ║"
  printf "  Live: %s/%s  Capacity: %s%%  (target: 80-90%%)\n" "$ALIVE" "$TOTAL_AGENTS" "$CAPACITY"
  echo "║                                                          ║"
  echo "║  ── ORG CHART ───────────────────────────────────────── ║"
  echo "  Fleet Supervisor"
  echo "  ├── ci-fixer     (3 replicas) — fix CI workflows"
  echo "  ├── committer    (3 replicas) — commit + push"
  echo "  ├── ci-waiter    (3 replicas) — poll CI green"
  echo "  ├── merger       (3 replicas) — merge PR"
  echo "  ├── cleaner      (3 replicas) — branch + process cleanup"
  echo "  └── verifier     (3 replicas) — final verification"
  echo "║                                                          ║"
  printf "  CLAUDE: 0%%  |  LOCAL AGENTS: 100%%  |  WORK LEFT: %s\n" "$ETA"
  echo "╚══════════════════════════════════════════════════════════╝"

  sleep 10
done
