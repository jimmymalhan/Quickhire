#!/usr/bin/env bash
###############################################################################
# BRANCH WATCHDOG — Keeps repo clean, only main survives
#
# Runs every 60s:
#   - Deletes merged remote branches (not main)
#   - Deletes local branches that are gone from remote
#   - Closes stale PRs whose branches are deleted
#   - Logs everything
#
# Usage:
#   nohup bash bin/branch-watchdog.sh >> state/local-agent-runtime/branch-watchdog.log 2>&1 &
#   tail -f state/local-agent-runtime/branch-watchdog.log
# Stop:
#   kill $(cat state/local-agent-runtime/branch-watchdog.pid)
###############################################################################
set -uo pipefail
cd /Users/jimmymalhan/Doc/Quickhire
mkdir -p state/local-agent-runtime
echo $$ > state/local-agent-runtime/branch-watchdog.pid

log() { printf "[%s] [WATCHDOG] %s\n" "$(date +%H:%M:%S)" "$1"; }

log "Branch Watchdog started (PID $$) — polling every 60s"

while true; do
  # Fetch latest
  command git fetch --prune 2>/dev/null

  # Delete merged remote branches
  for br in $(command git branch -r --merged origin/main 2>/dev/null | grep -v HEAD | grep -v "main$" | sed 's|origin/||'); do
    br=$(echo "$br" | xargs)
    [ -z "$br" ] && continue
    command git push origin --delete "$br" 2>/dev/null && log "Deleted merged remote: $br"
  done

  # Delete local branches gone from remote
  for br in $(command git branch -vv 2>/dev/null | grep ': gone]' | awk '{print $1}'); do
    [ -z "$br" ] && continue
    [ "$br" = "main" ] && continue
    command git branch -D "$br" 2>/dev/null && log "Deleted local gone: $br"
  done

  # Delete any local branch that isn't main
  for br in $(command git branch 2>/dev/null | grep -v "main" | grep -v "\\*" | xargs); do
    [ -z "$br" ] && continue
    command git branch -D "$br" 2>/dev/null && log "Deleted local stale: $br"
  done

  # Close stale open PRs whose branches are gone
  for pr_num in $(gh pr list --state open --json number -q '.[].number' 2>/dev/null); do
    pr_branch=$(gh pr view "$pr_num" --json headRefName -q '.headRefName' 2>/dev/null || echo "")
    [ -z "$pr_branch" ] && continue
    if ! command git ls-remote --heads origin "$pr_branch" 2>/dev/null | grep -q .; then
      gh pr close "$pr_num" --comment "Branch deleted. Auto-closing stale PR." 2>/dev/null && log "Closed stale PR #$pr_num"
    fi
  done

  # Report
  remote_count=$(command git branch -r 2>/dev/null | grep -v HEAD | wc -l | xargs)
  local_count=$(command git branch 2>/dev/null | wc -l | xargs)
  open_prs=$(gh pr list --state open --json number -q 'length' 2>/dev/null || echo "?")
  log "Status: remote=$remote_count local=$local_count open_prs=$open_prs"

  sleep 60
done
