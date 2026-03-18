#!/usr/bin/env bash
# pr-watcher-agent.sh — Monitors PRs, auto-merges when CI green
# Polls every 30 seconds. When all checks pass, merges and cleans up.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/pr-watcher.log"

mkdir -p "$STATE"

log(){ echo "[pr-watcher] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

check_and_merge_pr() {
  local pr_num="$1"

  # Get PR state
  local pr_state=$(cd "$ROOT" && gh pr view "$pr_num" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")

  if [ "$pr_state" != "OPEN" ]; then
    log "PR #$pr_num state=$pr_state (not open). Skipping."
    return
  fi

  # Get check results
  local checks=$(cd "$ROOT" && gh pr checks "$pr_num" 2>&1)
  local failing=$(echo "$checks" | grep -c "fail" || true)
  local pending=$(echo "$checks" | grep -c "pending" || true)
  local passing=$(echo "$checks" | grep -c "pass" || true)

  log "PR #$pr_num: pass=$passing pending=$pending fail=$failing"

  # Write status
  cat > "$STATE/pr-status.json" << EOJSON
{
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "pr": $pr_num,
  "state": "$pr_state",
  "checks": { "passing": $passing, "pending": $pending, "failing": $failing },
  "mergeReady": $([ "$pending" -eq 0 ] && [ "$failing" -le 1 ] && echo "true" || echo "false")
}
EOJSON

  # Auto-merge if ready (allow 1 failure for auto-merge job itself)
  if [ "$pending" -eq 0 ] && [ "$failing" -le 1 ]; then
    log "✅ PR #$pr_num CI green! Attempting auto-merge..."
    cd "$ROOT" && gh pr merge "$pr_num" --squash 2>&1 | tee -a "$LOG"

    if [ $? -eq 0 ]; then
      log "✅ PR #$pr_num merged successfully!"
      # Cleanup
      git checkout main 2>/dev/null
      git pull 2>/dev/null
      log "Switched to main and pulled latest."
    else
      log "⚠️ Merge failed. Will retry next cycle."
    fi
  fi
}

# ─── MAIN ─────────────────────────────────────────────────────
log "=== PR WATCHER STARTED ==="

while true; do
  # Check all open PRs
  OPEN_PRS=$(cd "$ROOT" && gh pr list --json number --jq '.[].number' 2>/dev/null || echo "")

  if [ -z "$OPEN_PRS" ]; then
    log "No open PRs found."
  else
    for pr in $OPEN_PRS; do
      check_and_merge_pr "$pr"
    done
  fi

  sleep 30
done
