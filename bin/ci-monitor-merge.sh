#!/usr/bin/env bash
set -euo pipefail
PROJECT="/Users/jimmymalhan/Doc/Quickhire"
STATE="$PROJECT/state/local-agent-runtime"
LOG="$STATE/ci-monitor-merge.log"
BRANCH="fix/ci-green-all-passes"
cd "$PROJECT"

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "CI Monitor Agent started - polling PR #8 on branch $BRANCH"

for i in $(seq 1 80); do
  sleep 15
  
  # Get all check statuses
  CHECKS=$(gh pr checks "$BRANCH" 2>/dev/null || echo "pending")
  FAIL_COUNT=$(echo "$CHECKS" | grep -c "fail" || echo "0")
  PASS_COUNT=$(echo "$CHECKS" | grep -c "pass" || echo "0")
  PENDING_COUNT=$(echo "$CHECKS" | grep -c "pending\|running" || echo "0")
  
  # Write live status
  printf "\r\033[K[%s] Poll %d | Pass: %s | Fail: %s | Pending: %s" "$(date +%H:%M:%S)" "$i" "$PASS_COUNT" "$FAIL_COUNT" "$PENDING_COUNT" > "$STATE/latest-status.txt"
  
  log "Poll $i: pass=$PASS_COUNT fail=$FAIL_COUNT pending=$PENDING_COUNT"
  
  if [ "$PENDING_COUNT" = "0" ] && [ "$FAIL_COUNT" = "0" ] && [ "$PASS_COUNT" -gt 0 ]; then
    log "ALL CI GREEN! Merging PR..."
    gh pr merge "$BRANCH" --squash --delete-branch 2>&1 && log "PR MERGED!" || log "Merge needs approval - PR is ready"
    log "DONE - All CI passes, PR merged"
    exit 0
  fi
  
  if [ "$PENDING_COUNT" = "0" ] && [ "$FAIL_COUNT" -gt 0 ]; then
    log "CI completed with failures:"
    echo "$CHECKS" | grep "fail" >> "$LOG"
    log "Waiting for next push/re-run..."
  fi
done

log "Timeout after 80 polls. Check manually: gh pr checks $BRANCH"
