#!/usr/bin/env bash
# session-chief-agent.sh — Owns the whole mission. Picks next highest-ROI slice.
# Assigns work. Keeps backlog moving until runnable backlog = 0.
# ZERO LocalAgent. ZERO external API. Pure local execution.
set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CP="$ROOT/state/local-agent-runtime/orchestration-controls.json"
LOG="$ROOT/state/local-agent-runtime/chief.log"
ASSIGN="$ROOT/state/local-agent-runtime/chief-assignments.json"

log(){ echo "[chief] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

while true; do
  node -e "
const fs=require('fs'),p=require('path'),{spawnSync}=require('child_process');
const root=process.env.QUICKHIRE_ROOT||process.cwd();
const cp=p.resolve(root,'state/local-agent-runtime/orchestration-controls.json');
const ap=p.resolve(root,'state/local-agent-runtime/chief-assignments.json');
try{
  const ctrl=JSON.parse(fs.readFileSync(cp,'utf8'));
  const cmds=ctrl.pendingCommands||[];
  const tot=cmds.length;
  const done=cmds.filter(c=>['complete','failed','escalated','blocked'].includes(c.status)).length;
  const queued=cmds.filter(c=>c.status==='queued');
  // ROI priority: FEATURE > run/test/lint > admin
  const pick=queued.find(c=>/FEATURE/i.test(c.label))||queued.find(c=>/test|lint|build/i.test(c.label))||queued[0];
  if(pick){
    log('CHIEF assigning: '+pick.id.slice(-16)+' | '+pick.label.slice(0,60));
    const a={assignedAt:new Date().toISOString(),taskId:pick.id,label:pick.label.slice(0,80),status:'assigned'};
    const prev=fs.existsSync(ap)?JSON.parse(fs.readFileSync(ap,'utf8')):[];
    fs.writeFileSync(ap,JSON.stringify([a,...prev].slice(0,20),null,2));
  } else {
    log('CHIEF: backlog empty at '+done+'/'+tot);
  }
} catch(e){ log('CHIEF_ERR: '+e.message); }
function log(m){ process.stdout.write(m+'\n'); }
" 2>/dev/null
  sleep 5
done
