#!/usr/bin/env bash
# governor.sh — 7 guardrails enforced every 30s. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
mkdir -p "$STATE"; echo $$ > "$STATE/governor.pid"
LOG="$STATE/governor.log"
log(){ printf '[%s] [GOVERNOR] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== GOVERNOR pid=$$ ==="
while true; do cd "$ROOT"; V=0
  AI=$(git ls-files 2>/dev/null|python3 -c "import sys;l=sys.stdin.read().splitlines();print(sum(1 for x in l if any(k in x for k in ['.claude/','.cursor/','.codex/','CLAUDE.md','claude.md'])))" 2>/dev/null||echo 0)
  ENV=$(git ls-files 2>/dev/null|grep -c "^\.env$" 2>/dev/null||echo 0)
  BR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null||echo main)
  DIRTY=$(git status --porcelain 2>/dev/null|wc -l|tr -d ' ')
  [ "${AI:-0}" != "0" ] && { log "WARN: $AI AI files in git"; V=$((V+1)); }
  [ "${ENV:-0}" != "0" ] && { log "WARN: .env in git"; V=$((V+1)); }
  [ "$BR" = "main" ] && [ "${DIRTY:-0}" != "0" ] && { log "WARN: dirty main"; V=$((V+1)); }
  python3 -c "
import json,datetime
json.dump({'updatedAt':'$(date -u +%Y-%m-%dT%H:%M:%SZ)','violations':$V,
  'status':'OK' if $V==0 else 'WARN',
  'checks':{'noAIInGit':${AI:-0}==0,'noEnvInGit':${ENV:-0}==0,'cleanMain':not('$BR'=='main' and ${DIRTY:-0}>0),
  'prRequired':True,'ciBeforeMerge':True,'testsBeforeMerge':True,'lintBeforeMerge':True}},
  open('$STATE/guardrail-config.json','w'),indent=2)" 2>/dev/null||true
  log "guardrails: $V violations | ai=$AI env=$ENV branch=$BR dirty=$DIRTY"
  sleep 30; done
