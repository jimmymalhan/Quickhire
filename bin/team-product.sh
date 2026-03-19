#!/usr/bin/env bash
# team-product.sh — Product team: tracks feature backlog, writes progress.
# Parallel worker. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/team-product.log"
TFILE="$STATE/team-product.json"
mkdir -p "$STATE"; echo $$ > "$STATE/team-product.pid"
log(){ printf '[%s] [PRODUCT] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== TEAM-PRODUCT pid=$$ ==="; cd "$ROOT"
while true; do
  # Check which features exist
  HAS_SCRAPER=$([ -f "$ROOT/src/automation/linkedinScraper.js" ] && echo 1||echo 0)
  HAS_FORM=$([ -f "$ROOT/src/automation/formSubmitter.js" ] && echo 1||echo 0)
  HAS_RATE=$(grep -rl "rateLimiter\|rate-limit" "$ROOT/src" --include="*.js" 2>/dev/null|wc -l|tr -d ' '||echo 0)
  HAS_SESSION=$(grep -rl "sessionManager\|session-mgmt" "$ROOT/src" --include="*.js" 2>/dev/null|wc -l|tr -d ' '||echo 0)
  OPEN_PRS=$(gh pr list --state open --json number --jq 'length' 2>/dev/null||echo 0)
  python3 -c "
import json,datetime
json.dump({'team':'product','status':'monitoring',
  'backlog':[
    {'id':1,'title':'Real LinkedIn scraper','done':$HAS_SCRAPER==1,'priority':1},
    {'id':2,'title':'Form submission engine','done':$HAS_FORM==1,'priority':2},
    {'id':3,'title':'Rate limiting','done':$HAS_RATE>0,'priority':3},
    {'id':4,'title':'Session management','done':$HAS_SESSION>0,'priority':4}],
  'openPRs':$OPEN_PRS,
  'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$TFILE','w'),indent=2)" 2>/dev/null||true
  log "backlog: scraper=$HAS_SCRAPER form=$HAS_FORM rate=$HAS_RATE session=$HAS_SESSION prs=$OPEN_PRS"
  sleep 45; done
