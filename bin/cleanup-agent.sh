#!/usr/bin/env bash
# cleanup-agent.sh — Deletes merged branches, stale PRs, old logs, temp files.
# Runs every 5min. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
LOG="$S/cleanup-agent.log"
mkdir -p "$S"; echo $$ > "$S/cleanup-agent.pid"
cd "$ROOT"
git config user.name "Jimmy Malhan"; git config user.email "jimmymalhan999@gmail.com"
log(){ printf '[%s] [CLEANUP] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== CLEANUP-AGENT pid=$$ ==="

while true; do
  log "--- cleanup cycle ---"

  # 1. Delete merged local branches (keep main only)
  MERGED=$(git branch --merged main 2>/dev/null | grep -v '^\*\|main' | tr -d ' ' || true)
  for b in $MERGED; do
    git branch -d "$b" 2>/dev/null && log "Deleted local: $b" || true
  done

  # 2. Delete merged remote branches
  git fetch --prune 2>/dev/null || true
  REMOTE_MERGED=$(git branch -r --merged origin/main 2>/dev/null \
    | grep -v 'HEAD\|main' | sed 's|origin/||' | tr -d ' ' || true)
  for b in $REMOTE_MERGED; do
    git push origin --delete "$b" 2>/dev/null && log "Deleted remote: $b" || true
  done

  # 3. Close stale PRs older than 7 days with no activity
  gh pr list --state open --json number,title,updatedAt \
    --jq '.[] | select(.updatedAt < (now - 604800 | strftime("%Y-%m-%dT%H:%M:%SZ"))) | .number' \
    2>/dev/null | while read -r pr; do
    gh pr close "$pr" --comment "Auto-closed: no activity in 7 days." 2>/dev/null && \
      log "Closed stale PR #$pr" || true
  done

  # 4. Truncate large log files (keep last 500 lines)
  for lf in "$S"/*.log; do
    [ -f "$lf" ] || continue
    [ "$(wc -l < "$lf" 2>/dev/null)" -gt 500 ] || continue
    tail -500 "$lf" > "$lf.tmp" && mv "$lf.tmp" "$lf" && log "Trimmed: $(basename "$lf")"
  done

  # 5. Delete old worker logs for dead workers
  for wlog in "$S"/worker-*.log; do
    [ -f "$wlog" ] || continue
    wname=$(basename "$wlog" .log)
    pid=$(cat "$S/${wname}.pid" 2>/dev/null || echo "")
    kill -0 "$pid" 2>/dev/null && continue  # alive — keep log
    age=$(( $(date +%s) - $(date -r "$wlog" +%s 2>/dev/null || echo 0) ))
    [ "$age" -gt 3600 ] && rm -f "$wlog" "$S/${wname}.pid" && \
      log "Purged dead worker: $wname (age=${age}s)"
  done

  # 6. Remove stale feature stub files (src/features/feature-*.js)
  find "$ROOT/src/features" -name "feature-*.js" -mmin +60 \
    -exec rm -f {} \; 2>/dev/null && log "Cleaned feature stubs" || true

  # 7. Write cleanup status
  python3 -c "
import json,datetime,subprocess
try:
  local_b=subprocess.check_output('git -C \"$ROOT\" branch | wc -l',shell=True).decode().strip()
  remote_b=subprocess.check_output('git -C \"$ROOT\" branch -r | wc -l',shell=True).decode().strip()
except: local_b=remote_b='?'
json.dump({'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'local_branches':local_b,'remote_branches':remote_b,'status':'clean'},
  open('$S/cleanup-status.json','w'),indent=2)" 2>/dev/null || true

  log "Done. Next in 300s."
  sleep 300
done
