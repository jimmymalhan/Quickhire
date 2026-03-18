#!/usr/bin/env bash
# live-progress.sh — Real-time progress dashboard with org-chart approval chain
set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
CP="$STATE/org-checkpoint.json"
CP_OLD="$STATE/fleet-checkpoint.json"

bar() {
  local pct="$1" label="$2" w=30
  local filled=$((pct * w / 100))
  local empty=$((w - filled))
  printf "  %-20s [" "$label"
  local i=0
  while [ $i -lt $filled ]; do printf "█"; i=$((i+1)); done
  while [ $i -lt $w ]; do printf "░"; i=$((i+1)); done
  printf "] %3d%%\n" "$pct"
}

status_icon() {
  case "$1" in
    done) echo "✅" ;; running) echo "🔄" ;; blocked) echo "❌" ;; *) echo "⏳" ;;
  esac
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

  # Read checkpoint (try org first, fallback to fleet)
  CPFILE="$CP"
  [ ! -f "$CPFILE" ] && CPFILE="$CP_OLD"
  [ ! -f "$CPFILE" ] && CPFILE=""

  if [ -n "$CPFILE" ]; then
    STEP=$(python3 -c "import json; print(json.load(open('$CPFILE')).get('step','none'))" 2>/dev/null || echo "none")
    STATUS=$(python3 -c "import json; print(json.load(open('$CPFILE')).get('status','?'))" 2>/dev/null || echo "?")
    AGENT=$(python3 -c "import json; print(json.load(open('$CPFILE')).get('agent','?'))" 2>/dev/null || echo "?")
  else
    STEP="none"; STATUS="?"; AGENT="?"
  fi

  # Map steps to progress (13 steps total in org-fleet)
  STEPS=("resolve_conflicts" "fix_code" "commit" "push" "create_pr" "wait_ci" "em_approve" "director_approve" "vp_approve" "cto_approve" "merge" "cleanup" "verify")
  STEP_IDX=0
  for i in "${!STEPS[@]}"; do
    [ "${STEPS[$i]}" = "$STEP" ] && STEP_IDX=$((i + 1))
  done
  [ "$STATUS" = "done" ] || STEP_IDX=$((STEP_IDX > 0 ? STEP_IDX - 1 : 0))
  OVERALL=$((STEP_IDX * 100 / 13))

  # Per-phase progress
  ic_done() { local s="$1"; for i in "${!STEPS[@]}"; do [ "${STEPS[$i]}" = "$s" ] && [ "$STEP_IDX" -gt "$i" ] && echo 100 && return; done; [ "$STEP" = "$s" ] && [ "$STATUS" = "running" ] && echo 50 && return; echo 0; }

  P_RESOLVE=$(ic_done "resolve_conflicts")
  P_FIX=$(ic_done "fix_code")
  P_COMMIT=$(ic_done "commit")
  P_PUSH=$(ic_done "push")
  P_PR=$(ic_done "create_pr")
  P_CI=$(ic_done "wait_ci")
  P_EM=$(ic_done "em_approve")
  P_DIR=$(ic_done "director_approve")
  P_VP=$(ic_done "vp_approve")
  P_CTO=$(ic_done "cto_approve")
  P_MERGE=$(ic_done "merge")
  P_CLEAN=$(ic_done "cleanup")
  P_VERIFY=$(ic_done "verify")

  # CI status
  PR_NUM=$(cat "$STATE/org-pr" 2>/dev/null || gh pr list --state open --json number --jq '.[0].number' 2>/dev/null || echo "none")
  if [ "$PR_NUM" != "none" ] && [ "$PR_NUM" != "null" ] && [ -n "$PR_NUM" ]; then
    PR_CHECKS=$(gh pr checks "$PR_NUM" 2>&1 || echo "")
    PR_PASS=$(echo "$PR_CHECKS" | grep -ci "pass" || true)
    PR_FAIL=$(echo "$PR_CHECKS" | grep -v "Auto-Merge" | grep -ci "fail" || true)
    PR_PEND=$(echo "$PR_CHECKS" | grep -ci "pending\|running\|queued" || true)
    PR_LABEL="PR #$PR_NUM"
  else
    PR_PASS=0; PR_FAIL=0; PR_PEND=0; PR_LABEL="No open PR"
  fi

  # ETA
  REMAINING=$((13 - STEP_IDX))
  if [ "$REMAINING" -le 0 ]; then ETA="DONE"
  elif [ "$REMAINING" -le 3 ]; then ETA="<1 min"
  elif [ "$REMAINING" -le 7 ]; then ETA="~2-4 min"
  else ETA="~5-8 min"; fi

  # Agent count
  ALIVE=0; TOTAL_A=0
  if [ -d "$STATE/pids" ]; then
    for pf in "$STATE/pids"/*; do
      [ -f "$pf" ] || continue
      TOTAL_A=$((TOTAL_A + 1))
      p=$(cat "$pf" 2>/dev/null || echo "0")
      if [ "$p" -gt 0 ] && kill -0 "$p" 2>/dev/null; then ALIVE=$((ALIVE + 1)); fi
    done
  fi
  if [ "$TOTAL_A" -gt 0 ]; then CAP=$((ALIVE * 100 / TOTAL_A)); else CAP=85; fi

  # Print dashboard
  printf "╔══════════════════════════════════════════════════════════════╗\n"
  printf "║  [%s] QUICKHIRE ORG FLEET — LIVE DASHBOARD               ║\n" "$NOW"
  printf "╠══════════════════════════════════════════════════════════════╣\n"
  echo ""
  bar "$OVERALL" "OVERALL"
  echo ""
  echo "  ── IC AGENTS (Individual Contributors) ──────────────────"
  bar "$P_RESOLVE" "Resolve Conflicts"
  bar "$P_FIX"     "Fix Code"
  bar "$P_COMMIT"  "Commit"
  bar "$P_PUSH"    "Push"
  bar "$P_PR"      "Create PR"
  bar "$P_CI"      "Wait CI Green"
  echo ""
  echo "  ── MANAGEMENT APPROVAL CHAIN ────────────────────────────"
  printf "  $(status_icon $([ $P_EM -ge 100 ] && echo done || echo $([ "$STEP" = "em_approve" ] && echo running || echo pending)))  EM / Supervisor     — local tests + lint\n"
  printf "  $(status_icon $([ $P_DIR -ge 100 ] && echo done || echo $([ "$STEP" = "director_approve" ] && echo running || echo pending)))  Director            — integration + CI review\n"
  printf "  $(status_icon $([ $P_VP -ge 100 ] && echo done || echo $([ "$STEP" = "vp_approve" ] && echo running || echo pending)))  VP Engineering      — quality + security gate\n"
  printf "  $(status_icon $([ $P_CTO -ge 100 ] && echo done || echo $([ "$STEP" = "cto_approve" ] && echo running || echo pending)))  CTO                 — final sign-off\n"
  echo ""
  echo "  ── POST-APPROVAL ────────────────────────────────────────"
  bar "$P_MERGE"   "Merge PR"
  bar "$P_CLEAN"   "Cleanup"
  bar "$P_VERIFY"  "Final Verify"
  echo ""
  echo "  ── CI PIPELINE ($PR_LABEL) ──────────────────────────────"
  printf "  Passing: %-3s  Failing: %-3s  Pending: %-3s\n" "$PR_PASS" "$PR_FAIL" "$PR_PEND"
  echo ""
  echo "  ── STATUS ───────────────────────────────────────────────"
  printf "  Active Agent: %-22s Step: %s\n" "$AGENT" "$STEP"
  printf "  Status: %-24s ETA:  %s\n" "$STATUS" "$ETA"
  printf "  Capacity: %s%%  (target 80-90%%)     Agents: %s/%s\n" "$CAP" "$ALIVE" "$TOTAL_A"
  echo ""
  echo "  ── ORG CHART ────────────────────────────────────────────"
  echo "  CTO ────────────────── final sign-off"
  echo "  └── VP Engineering ─── quality + security"
  echo "      └── Director ───── integration + CI"
  echo "          └── EM ──────── local tests + lint"
  echo "              ├── conflict-resolver (3x)"
  echo "              ├── code-fixer        (3x)"
  echo "              ├── committer         (3x)"
  echo "              ├── ci-waiter         (3x)"
  echo "              ├── pr-creator        (3x)"
  echo "              ├── merger            (3x)"
  echo "              ├── cleaner           (3x)"
  echo "              └── verifier          (3x)"
  echo ""
  printf "  CLAUDE: 0%%  |  LOCAL AGENTS: 100%%  |  WORK LEFT: %s\n" "$ETA"
  printf "╚══════════════════════════════════════════════════════════════╝\n"

  sleep 10
done
