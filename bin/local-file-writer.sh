#!/usr/bin/env bash
# local-file-writer.sh — Pure local file executor. ZERO Claude. ZERO external API.
# Reads AGENT_PROMPT which must be a JSON object: {"path":"<rel>","content":"<text>","mode":"write|append"}
# Falls back to treating AGENT_PROMPT as a node script if not JSON.
set -euo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROMPT="${AGENT_PROMPT:-}"
if [ -z "$PROMPT" ]; then echo "ERROR: AGENT_PROMPT empty"; exit 1; fi

node -e "
const fs=require('fs'),p=require('path');
const root=process.env.QUICKHIRE_ROOT||process.cwd();
const raw=process.env.AGENT_PROMPT||'';
let parsed=null;
try{ parsed=JSON.parse(raw); }catch(_){}
if(parsed&&parsed.path&&parsed.content!==undefined){
  const abs=p.isAbsolute(parsed.path)?parsed.path:p.resolve(root,parsed.path);
  fs.mkdirSync(p.dirname(abs),{recursive:true});
  if(parsed.mode==='append') fs.appendFileSync(abs,parsed.content,'utf8');
  else fs.writeFileSync(abs,parsed.content,'utf8');
  if(parsed.chmod) require('child_process').execSync('chmod '+parsed.chmod+' '+abs);
  console.log('WRITTEN:',abs);
  process.exit(0);
}
// Fallback: treat as node script
try{ eval(raw); }catch(e){ console.error('EXEC_ERR:',e.message); process.exit(1); }
" 2>&1
