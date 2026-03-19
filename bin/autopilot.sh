#!/usr/bin/env bash
# autopilot.sh — Works backlog 24/7. No Claude tokens. No npm. git+gh only.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
BACKLOG="$STATE/backlog.json"
PROGRESS="$STATE/autopilot-progress.json"
LOG="$STATE/autopilot.log"
mkdir -p "$STATE"; echo $$ > "$STATE/autopilot.pid"
cd "$ROOT"
log(){ printf '[%s] [AUTOPILOT] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
prog(){ python3 -c "
import json,datetime
json.dump({'goal_pct':$1,'phase':'$2','task':'$3','status':'running','updated':
  datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$PROGRESS','w'),indent=2)" 2>/dev/null||true; }
init_backlog(){ [ -f "$BACKLOG" ] && return
  python3 -c "import json; json.dump([
    {'id':1,'priority':1,'title':'Fix: untrack .claude/ from git','status':'ready','branch':'fix/untrack-ai-rules'},
    {'id':2,'priority':2,'title':'Feat: real LinkedIn scraper','status':'ready','branch':'feat/linkedin-scraper'},
    {'id':3,'priority':3,'title':'Feat: form submission engine','status':'ready','branch':'feat/form-submission'},
    {'id':4,'priority':4,'title':'Feat: rate limiting + session mgmt','status':'ready','branch':'feat/rate-limiting'},
    {'id':5,'priority':5,'title':'Release: tag v1.1.0 + changelog','status':'ready','branch':'release/v1.1.0'}
  ],open('$BACKLOG','w'),indent=2)" 2>/dev/null; log "Backlog initialized"; }
next(){ python3 -c "
import json
try:
  t=[x for x in json.load(open('$BACKLOG')) if x.get('status')=='ready']
  t.sort(key=lambda x:x.get('priority',99))
  r=t[0] if t else None
  print(r['id'] if r else 0, r['title'] if r else 'done', r['branch'] if r else 'none')
except: print(0,'error','none')" 2>/dev/null||echo "0 error none"; }
mark_done(){ python3 -c "
import json; tasks=json.load(open('$BACKLOG'))
[t.update({'status':'done'}) for t in tasks if t['id']==$1]
json.dump(tasks,open('$BACKLOG','w'),indent=2)" 2>/dev/null||true; }
do_untrack_ai(){ log "Running: untrack .claude/ from git"
  prog 50 "executing" "Untrack AI rules from git"
  git checkout main 2>/dev/null; git pull origin main 2>/dev/null
  local br="fix/untrack-ai-rules"
  git branch -D "$br" 2>/dev/null||true
  git checkout -b "$br" || return 1
  git rm --cached -r .claude/ CLAUDE.md claude.md AGENTS.md .codex/ 2>/dev/null||true
  if git diff --cached --quiet 2>/dev/null; then
    log "Nothing to untrack"; git checkout main 2>/dev/null
    git branch -D "$br" 2>/dev/null||true; mark_done 1; return 0; fi
  git commit -m "fix: untrack AI rule files from git

AI assistant files (.claude/, CLAUDE.md) are local-only.
Other contributors must not inherit them.
  if git push -u origin "$br" 2>/dev/null; then
    gh pr create --title "fix: untrack AI rule files" \
      --body "Removes .claude/, CLAUDE.md from git tracking. Local dev tools only." \
      --base main 2>/dev/null||true
    log "PR created"; mark_done 1; prog 55 "waiting-ci" "AI rules PR open"; fi; }
log "=== AUTOPILOT pid=$$ ==="; init_backlog; CYCLE=0
while true; do CYCLE=$((CYCLE+1)); log "Cycle $CYCLE"
  git checkout main 2>/dev/null; git pull origin main 2>/dev/null
  read -r TID TTITLE TBRANCH <<< "$(next)"
  if [ "$TID" = "0" ]; then prog 95 "monitoring" "All tasks done"; log "All done — idle"; sleep 60; continue; fi
  log "Task [$TID]: $TTITLE"; prog 45 "scanning" "$TTITLE"
  case "$TID" in
    1) do_untrack_ai||true ;;
    *) log "Queued: $TTITLE (waiting for node_modules)"; prog $((TID*15)) "queued" "$TTITLE"; sleep 45 ;;
  esac; sleep 30; done
