#!/usr/bin/env bash
# team-quality.sh — Quality team: lint scan, secret scan, code health.
# Parallel worker. No Claude tokens. No npm (broken).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/team-quality.log"
TFILE="$STATE/team-quality.json"
mkdir -p "$STATE"; echo $$ > "$STATE/team-quality.pid"
log(){ printf '[%s] [QUALITY] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
status(){ python3 -c "import json,datetime; json.dump({'team':'quality','status':'$1','task':'$2',
  'todos':$3,'secrets':$4,'aiFiles':$5,
  'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$TFILE','w'),indent=2)" 2>/dev/null||true; }
log "=== TEAM-QUALITY pid=$$ ==="; cd "$ROOT"
while true; do
  TODOS=$(grep -rl "TODO\|FIXME" "$ROOT/src" --include="*.js" --include="*.ts" 2>/dev/null|wc -l|tr -d ' '||echo 0)
  SEC=$(git ls-files 2>/dev/null|python3 -c "import sys;l=sys.stdin.read().splitlines();print(sum(1 for x in l if x=='.env' or(x.startswith('.env.')and not x.endswith('.example'))))" 2>/dev/null||echo 0)
  AI=$(git ls-files 2>/dev/null|python3 -c "import sys;l=sys.stdin.read().splitlines();print(sum(1 for x in l if any(k in x for k in ['.claude/','.cursor/','.codex/','CLAUDE.md'])))" 2>/dev/null||echo 0)
  log "scan: todos=$TODOS secrets=$SEC ai-in-git=$AI"
  status "idle" "scan complete" "$TODOS" "$SEC" "$AI"
  sleep 45; done
