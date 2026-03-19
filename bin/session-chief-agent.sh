#!/usr/bin/env bash
# session-chief-agent.sh — Owns the whole mission. Picks next highest-ROI slice.
# Assigns work. Keeps backlog moving until runnable backlog = 0.
# ZERO LocalAgent. ZERO external API. Pure local execution.
set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CP="$ROOT/state/local-agent-runtime/orchestration-controls.json"
LOG="$ROOT/state/local-agent-runtime/chief.log"
ASSIGN="$ROOT/state/local-agent-runtime/chief-assignments.json"
SUMMARY="$ROOT/state/local-agent-runtime/chief-summary.json"
WORKER_STATE="$ROOT/state/local-agent-runtime/worker-state.json"

log(){ echo "[chief] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

while true; do
  node -e "
const fs=require('fs'),p=require('path');
const root=process.env.QUICKHIRE_ROOT||process.cwd();
const cp=p.resolve(root,'state/local-agent-runtime/orchestration-controls.json');
const ap=p.resolve(root,'state/local-agent-runtime/chief-assignments.json');
const sp=p.resolve(root,'state/local-agent-runtime/chief-summary.json');
const wp=p.resolve(root,'state/local-agent-runtime/worker-state.json');
try{
  const ctrl=JSON.parse(fs.readFileSync(cp,'utf8'));
  const cmds=ctrl.pendingCommands||[];
  const tot=cmds.length;
  const done=cmds.filter(c=>['complete','failed','escalated','blocked'].includes(c.status)).length;
  const queued=cmds.filter(c=>c.status==='queued');
  // ROI priority: FEATURE > run/test/lint > admin
  const pick=queued.find(c=>/FEATURE/i.test(c.label))||queued.find(c=>/test|lint|build/i.test(c.label))||queued[0];
  const stamp=new Date().toISOString();
  const summary={
    updatedAt:stamp,
    status:pick?'running':'idle',
    total:tot,
    completed:done,
    queued:queued.length,
    selected:pick?pick.label:'backlog empty',
    selectedId:pick?pick.id:null,
    mode:ctrl.orchestration&&ctrl.orchestration.mode?ctrl.orchestration.mode:'LOCAL_AGENTS_ONLY'
  };
  fs.writeFileSync(sp,JSON.stringify(summary,null,2)+'\\n');
  fs.writeFileSync(wp,JSON.stringify({
    status:pick?'running':'idle',
    action:pick?pick.action||'assign':'idle',
    activeCommandId:pick?pick.id:null,
    selected:pick?pick.label:null,
    startedAt:stamp,
    lastHeartbeatAt:stamp,
    updatedAt:stamp
  },null,2)+'\\n');
  if(pick){
    log('CHIEF assigning: '+pick.id.slice(-16)+' | '+pick.label.slice(0,60));
    const a={assignedAt:new Date().toISOString(),taskId:pick.id,label:pick.label.slice(0,80),status:'assigned'};
    const prev=fs.existsSync(ap)?JSON.parse(fs.readFileSync(ap,'utf8')):[];
    fs.writeFileSync(ap,JSON.stringify([a,...prev].slice(0,20),null,2)+'\\n');
  } else {
    log('CHIEF: backlog empty at '+done+'/'+tot);
  }
} catch(e){ log('CHIEF_ERR: '+e.message); }
function log(m){ process.stdout.write(m+'\n'); }
" 2>/dev/null
  sleep 5
done
