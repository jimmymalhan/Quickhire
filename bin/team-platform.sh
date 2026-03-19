#!/usr/bin/env bash
# team-platform.sh — Platform team: git ops, branch cleanup, CI monitoring.
# Parallel worker. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/team-platform.log"
TFILE="$STATE/team-platform.json"
mkdir -p "$STATE"; echo $$ > "$STATE/team-platform.pid"
log(){ printf '[%s] [PLATFORM] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
status(){ python3 -c "import json,datetime; json.dump({'team':'platform','status':'$1','task':'$2',
  'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$TFILE','w'),indent=2)" 2>/dev/null||true; }
log "=== TEAM-PLATFORM pid=$$ ==="; cd "$ROOT"
while true; do
  # Clean merged branches
  status "running" "cleanup merged branches"
  MERGED=$(git branch --merged main 2>/dev/null | grep -v "^\*\|main" | tr -d ' ' || true)
  for b in $MERGED; do git branch -d "$b" 2>/dev/null && log "Deleted local: $b"||true; done
  # Check CI status via gh
  RUN=$(gh run list --limit 1 --json status,conclusion,name 2>/dev/null || echo "[]")
  CI=$(python3 -c "import json;r=json.loads('$RUN');print(r[0].get('conclusion','pending') if r else 'none')" 2>/dev/null||echo "none")
  log "CI last run: $CI | merged branches cleaned"
  status "idle" "monitoring"
  sleep 60; done
