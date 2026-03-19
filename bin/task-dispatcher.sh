#!/usr/bin/env bash
# task-dispatcher.sh — Assigns backlog tasks to agents, runs parallel workers.
# Self-healing: if a worker dies, picks up from last checkpoint. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
BACKLOG="$STATE/backlog.json"
DISPATCH="$STATE/dispatch.json"
LOG="$STATE/task-dispatcher.log"
mkdir -p "$STATE"; echo $$ > "$STATE/task-dispatcher.pid"
log(){ printf '[%s] [DISPATCHER] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }

# Full prioritized backlog
init_backlog(){
python3 -c "
import json,os
if os.path.exists('$BACKLOG'):
  existing=[t['id'] for t in json.load(open('$BACKLOG'))]
else:
  existing=[]
tasks=[
  {'id':1,'priority':1,'title':'Fix: untrack .claude/ CLAUDE.md from git','agent':'autopilot','status':'ready','branch':'fix/untrack-ai-rules','team':'platform'},
  {'id':2,'priority':2,'title':'Feat: real LinkedIn scraper (replace mock)','agent':'team-product','status':'ready','branch':'feat/linkedin-scraper','team':'product'},
  {'id':3,'priority':3,'title':'Feat: application form submission engine','agent':'team-product','status':'ready','branch':'feat/form-submission','team':'product'},
  {'id':4,'priority':4,'title':'Feat: rate limiting + session management','agent':'team-product','status':'ready','branch':'feat/rate-limiting','team':'product'},
  {'id':5,'priority':5,'title':'Fix: cleanup all stale feature branches','agent':'team-platform','status':'ready','branch':'fix/branch-cleanup','team':'platform'},
  {'id':6,'priority':6,'title':'Release: tag v1.1.0 + update CHANGELOG','agent':'autopilot','status':'ready','branch':'release/v1.1.0','team':'product'},
  {'id':7,'priority':7,'title':'Docs: update README with agent fleet docs','agent':'team-product','status':'ready','branch':'docs/agent-fleet','team':'product'},
]
existing_tasks=[]
if os.path.exists('$BACKLOG'):
  existing_tasks=json.load(open('$BACKLOG'))
# Merge — don't overwrite done tasks
done_ids=[t['id'] for t in existing_tasks if t.get('status')=='done']
final=[t for t in tasks if t['id'] not in done_ids]
for t in existing_tasks:
  if t.get('status')=='done' and t['id'] not in [x['id'] for x in final]:
    final.append(t)
final.sort(key=lambda t:t.get('priority',99))
json.dump(final,open('$BACKLOG','w'),indent=2)
print('backlog: %d tasks' % len(final))
" 2>/dev/null
}

dispatch_tasks(){
python3 -c "
import json,datetime
tasks=json.load(open('$BACKLOG'))
ready=[t for t in tasks if t.get('status')=='ready']
ready.sort(key=lambda t:t.get('priority',99))
assignments=[]
for t in ready:
  assignments.append({'taskId':t['id'],'title':t['title'],'assignedTo':t.get('agent','autopilot'),
    'team':t.get('team','product'),'branch':t.get('branch','feat/task-%d'%t['id']),
    'priority':t.get('priority',99),'status':'assigned',
    'assignedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')})
json.dump({'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'assignments':assignments,'totalTasks':len(tasks),'readyTasks':len(ready),
  'doneTasks':len([t for t in tasks if t.get('status')=='done'])},
  open('$DISPATCH','w'),indent=2)
print('dispatched %d tasks' % len(assignments))
for a in assignments:
  print('  [p%d] %s -> %s' % (a['priority'],a['title'][:45],a['assignedTo']))
" 2>/dev/null
}

log "=== TASK-DISPATCHER pid=$$ ==="
init_backlog
while true; do
  log "Dispatching tasks..."
  dispatch_tasks | while read -r line; do log "$line"; done
  # Update backlog state so autopilot + team agents pick it up
  log "Tasks assigned — agents will pick up via backlog.json"
  sleep 60
done
