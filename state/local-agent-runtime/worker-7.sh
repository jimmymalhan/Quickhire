#!/usr/bin/env bash
ROOT="/Users/jimmymalhan/Documents/Quickhire"
STATE="$ROOT/state/local-agent-runtime"
echo $$ > "$STATE/worker-7.pid"
LOG="$STATE/worker-7.log"
log(){ printf '[%s] [WORKER-7] %s\n' "$(date +%H:%M:%S)" "$1"|tee -a "$LOG"; }
log "started"; cd "$ROOT"
case 7 in
  7)  log "security-scan: checking secrets + .env in git"
      while true; do
        SEC=$(git ls-files 2>/dev/null|grep -c "^\.env$"||echo 0)
        AI=$(git ls-files 2>/dev/null|python3 -c "import sys;l=sys.stdin.read().splitlines();print(sum(1 for x in l if '.claude/' in x or 'CLAUDE.md'==x))" 2>/dev/null||echo 0)
        python3 -c "import json,datetime; json.dump({'worker':7,'task':'security-scan','secrets':$SEC,'aiFiles':$AI,'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},open('$STATE/worker-7.json','w'),indent=2)" 2>/dev/null
        log "scan: secrets=$SEC ai-in-git=$AI"; sleep 45; done ;;
  8)  log "lint-watcher: monitor src/ for lint issues"
      while true; do
        TODOS=$(grep -rl "TODO\|FIXME" "$ROOT/src" --include="*.js" --include="*.ts" 2>/dev/null|wc -l|tr -d ' '||echo 0)
        CONSOLE=$(grep -rl "console\.log" "$ROOT/src" --include="*.js" 2>/dev/null|grep -v "test\|logger"|wc -l|tr -d ' '||echo 0)
        python3 -c "import json,datetime; json.dump({'worker':8,'task':'lint-watch','todos':$TODOS,'consoleLogs':$CONSOLE,'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},open('$STATE/worker-8.json','w'),indent=2)" 2>/dev/null
        log "todos=$TODOS console=$CONSOLE"; sleep 45; done ;;
  9)  log "git-health: monitor branch count + dirty state"
      while true; do
        BRANCHES=$(git branch -r 2>/dev/null|grep -v HEAD|wc -l|tr -d ' '||echo 0)
        DIRTY=$(git status --porcelain 2>/dev/null|wc -l|tr -d ' '||echo 0)
        python3 -c "import json,datetime; json.dump({'worker':9,'task':'git-health','branches':$BRANCHES,'dirty':$DIRTY,'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},open('$STATE/worker-9.json','w'),indent=2)" 2>/dev/null
        log "branches=$BRANCHES dirty=$DIRTY"; sleep 30; done ;;
  10) log "pr-monitor: watch open PRs + CI status"
      while true; do
        PRS=$(gh pr list --state open --json number,title,statusCheckRollup 2>/dev/null||echo "[]")
        python3 -c "
import json,datetime
try:
  prs=json.loads('''''' if '''''' else '[]')
  out=[{'num':p['number'],'title':p.get('title','')[:40]} for p in prs]
  json.dump({'worker':10,'task':'pr-monitor','openPRs':len(out),'prs':out,'updatedAt':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},open('$STATE/worker-10.json','w'),indent=2)
except: pass
" 2>/dev/null; log "PRs checked"; sleep 60; done ;;
  11) log "backlog-auto-adder: detects new work and adds to backlog"
      while true; do
        python3 -c "
import json,os,datetime
bl=json.load(open('$STATE/backlog.json')) if os.path.exists('$STATE/backlog.json') else []
ids=[t['id'] for t in bl]
new_tasks=[
  {'id':8,'priority':2,'title':'Feat: job matching algorithm','agent':'team-product','status':'ready','branch':'feat/job-matching','team':'product','eta_hrs':4},
  {'id':9,'priority':3,'title':'Feat: application status tracker','agent':'team-product','status':'ready','branch':'feat/app-tracker','team':'product','eta_hrs':3},
  {'id':10,'priority':4,'title':'Fix: add missing API error handlers','agent':'team-quality','status':'ready','branch':'fix/api-errors','team':'quality','eta_hrs':2},
  {'id':11,'priority':5,'title':'Feat: email notification on apply','agent':'team-product','status':'ready','branch':'feat/email-notify','team':'product','eta_hrs':3},
]
added=0
for t in new_tasks:
  if t['id'] not in ids:
    bl.append(t); added+=1
if added:
  json.dump(bl,open('$STATE/backlog.json','w'),indent=2)
  print('Added %d new tasks to backlog' % added)
" 2>/dev/null; log "backlog checked"; sleep 120; done ;;
  12) log "eta-calculator: computes ETA for all tasks"
      while true; do
        python3 -c "
import json,datetime,os
bl=json.load(open('$STATE/backlog.json')) if os.path.exists('$STATE/backlog.json') else []
now=datetime.datetime.utcnow()
eta_data=[]
hrs=0
for t in sorted(bl,key=lambda x:x.get('priority',99)):
  eta_hrs=t.get('eta_hrs',4)
  hrs+=eta_hrs
  eta_data.append({'id':t['id'],'title':t['title'][:45],'status':t.get('status','ready'),
    'eta_hrs':eta_hrs,'cumulative_hrs':hrs,'eta_date':(now+datetime.timedelta(hours=hrs)).strftime('%Y-%m-%d %H:%M')})
json.dump({'updatedAt':now.strftime('%Y-%m-%dT%H:%M:%SZ'),'totalHrs':hrs,'tasks':eta_data},
  open('$STATE/eta.json','w'),indent=2)
" 2>/dev/null; sleep 30; done ;;
esac
