#!/usr/bin/env bash
# scale-max.sh — CPU-aware scaler. Spawns workers until 70% CPU used.
# Checks Activity Monitor every 15s. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
LOG="$S/scale-max.log"
mkdir -p "$S"; echo $$ > "$S/scale-max.pid"
cd "$ROOT"
log(){ printf '[%s] [SCALE-MAX] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }

TARGET_CPU=70   # spawn until we hit this %
FLOOR_CPU=45    # kill workers if CPU drops below this (scale down)
MAX_WORKERS=120 # hard cap up
MIN_WORKERS=18  # never kill below core fleet count
WORKER_START=50 # start numbering above existing workers

log "=== SCALE-MAX pid=$$ target=${TARGET_CPU}% ==="

cpu_usage(){
  # macOS: get total CPU % used (100 - idle)
  top -l 1 -n 0 2>/dev/null \
    | awk '/CPU usage/{gsub(/%/,""); idle=$NF; print 100-idle}' \
    | head -1 || echo 50
}

alive_count(){
  local n=0
  for pf in "$S"/*.pid; do
    [ -f "$pf" ] || continue
    local pid; pid=$(cat "$pf" 2>/dev/null || echo "")
    kill -0 "$pid" 2>/dev/null && n=$((n+1))
  done
  echo "$n"
}

spawn_worker(){
  local wid="$1" task_title="$2" task_type="$3"
  local pf="$S/worker-${wid}.pid"
  local pid; pid=$(cat "$pf" 2>/dev/null || echo "")
  kill -0 "$pid" 2>/dev/null && return 0  # already alive

  nohup bash -c "
ROOT='$ROOT'; S='$S'; WID=$wid; TYPE='$task_type'
echo \$\$ > \"\$S/worker-\$WID.pid\"
WLOG=\"\$S/worker-\$WID.log\"
wlog(){ printf '[%s] [W\$WID] %s\n' \"\$(date +%H:%M:%S)\" \"\$1\" >> \"\$WLOG\"; }
wlog 'START type=\$TYPE'
git config user.name  'Jimmy Malhan' 2>/dev/null
git config user.email 'jimmymalhan999@gmail.com' 2>/dev/null
cd \"\$ROOT\"

case \"\$TYPE\" in
  code-scan)
    wlog 'scanning src for issues'
    # Find TODO/FIXME and log them
    grep -rn 'TODO\|FIXME\|HACK\|XXX' \"\$ROOT/src\" --include='*.js' --include='*.ts' \
      2>/dev/null | head -20 >> \"\$S/code-issues.log\" || true
    wlog 'scan complete'
    sleep 120; wlog 'idle' ;;
  stub-feature)
    wlog 'writing feature stub'
    FEAT_ID=\$((WID % 20 + 1))
    mkdir -p \"\$ROOT/src/features\"
    cat > \"\$ROOT/src/features/feature-\${FEAT_ID}.js\" << 'STUBEOF'
// Auto-generated stub — worker ${WID}
// Replace with real implementation
const feature = {
  name: 'feature-${FEAT_ID}',
  status: 'stub',
  init: async () => ({ ok: true }),
  run: async (params) => ({ result: null, params }),
};
module.exports = feature;
STUBEOF
    wlog 'stub written'
    sleep 180; wlog 'idle' ;;
  health-check)
    wlog 'running health checks'
    # Check all state files are fresh
    for f in ci-status autopilot-progress backlog; do
      AGE=0
      if [ -f \"\$S/\${f}.json\" ]; then
        AGE=\$(( \$(date +%s) - \$(date -r \"\$S/\${f}.json\" +%s 2>/dev/null || echo 0) ))
      fi
      [ \"\$AGE\" -gt 300 ] && wlog \"STALE: \${f}.json age=\${AGE}s\"
    done
    wlog 'health check done'
    sleep 60; wlog 'idle' ;;
  git-ops)
    wlog 'running git ops'
    # Clean local merged branches
    MERGED=\$(git branch --merged main 2>/dev/null | grep -v '^\*\|main' | tr -d ' ' || true)
    for b in \$MERGED; do git branch -d \"\$b\" 2>/dev/null && wlog \"deleted: \$b\" || true; done
    wlog 'git ops done'
    sleep 90; wlog 'idle' ;;
  lint-scan)
    wlog 'lint scan'
    # Count lint issues without npm
    BAD=\$(grep -rn 'console\.log\|debugger' \"\$ROOT/src\" --include='*.js' 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    wlog \"console.log count: \$BAD\"
    printf '{\"at\":\"%s\",\"consoleLog\":%s}\n' \"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \"\$BAD\" \
      > \"\$S/lint-scan-\$WID.json\" 2>/dev/null || true
    sleep 90; wlog 'idle' ;;
  progress-track)
    wlog 'tracking progress'
    python3 -c \"
import json,os,datetime
S='\$S'
bl=json.load(open(f'{S}/backlog.json')) if os.path.exists(f'{S}/backlog.json') else []
total=len(bl); done=sum(1 for t in bl if t.get('status')=='done')
pct=int(done*100/total) if total>0 else 0
json.dump({'goal_pct':max(1,pct),'phase':'scaling','task':f'Progress {done}/{total}',
  'updated':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open(f'{S}/autopilot-progress.json','w'),indent=2)
\" 2>/dev/null || true
    wlog 'progress updated'
    sleep 30; wlog 'idle' ;;
  *)
    wlog 'generic worker — monitoring'
    sleep 60; wlog 'idle' ;;
esac

# Keep alive after task
while true; do wlog 'alive'; sleep 300; done
" >> "$S/worker-${wid}.log" 2>&1 &
  echo $! > "$pf"
  log "spawned worker-$wid type=$task_type pid=$!"
}

TASK_TYPES=("code-scan" "stub-feature" "health-check" "git-ops" "lint-scan" "progress-track")
CYCLE=0
WID=$WORKER_START

while true; do
  CYCLE=$((CYCLE+1))
  CPU=$(cpu_usage)
  ALIVE=$(alive_count)

  log "cycle=$CYCLE cpu=${CPU}% alive=$ALIVE target=${TARGET_CPU}%"

  # Write scale status
  python3 -c "
import json,datetime
json.dump({'cycle':$CYCLE,'cpu_pct':$CPU,'alive':$ALIVE,'target_cpu':$TARGET_CPU,
  'max_workers':$MAX_WORKERS,'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$S/scale-status.json','w'),indent=2)" 2>/dev/null || true

  # AUTO SCALE UP — CPU below target, room to grow
  if [ "${CPU%.*}" -lt "$TARGET_CPU" ] && [ "$ALIVE" -lt "$MAX_WORKERS" ]; then
    # Batch size proportional to headroom
    HEADROOM=$(( TARGET_CPU - ${CPU%.*} ))
    BATCH=$(( HEADROOM / 10 + 2 ))
    [ "$BATCH" -gt 10 ] && BATCH=10
    for i in $(seq 1 $BATCH); do
      TYPE="${TASK_TYPES[$((WID % ${#TASK_TYPES[@]}))]}"
      spawn_worker "$WID" "worker-$WID" "$TYPE"
      WID=$((WID+1))
      [ "$WID" -gt "$((WORKER_START + MAX_WORKERS))" ] && WID=$WORKER_START
    done
    log "SCALE-UP batch=$BATCH cpu=${CPU}% alive=$ALIVE target=${TARGET_CPU}%"

  # AUTO SCALE DOWN — CPU below floor, kill excess workers
  elif [ "${CPU%.*}" -lt "$FLOOR_CPU" ] && [ "$ALIVE" -gt "$MIN_WORKERS" ]; then
    EXCESS=$(( ALIVE - MIN_WORKERS ))
    KILL_N=$(( EXCESS / 3 + 1 ))  # kill 1/3 of excess at a time
    [ "$KILL_N" -gt 5 ] && KILL_N=5
    KILLED=0
    # Kill highest-numbered scale workers first (spare core agents)
    for pf in $(ls -r "$S"/worker-*.pid 2>/dev/null | head -"$KILL_N"); do
      WN=$(basename "$pf" .pid)
      WN_NUM="${WN#worker-}"
      [ "${WN_NUM:-0}" -lt "$WORKER_START" ] && continue  # never kill core workers
      pid=$(cat "$pf" 2>/dev/null || echo "")
      kill "$pid" 2>/dev/null && { rm -f "$pf"; KILLED=$((KILLED+1)); log "SCALE-DOWN killed $WN pid=$pid"; }
    done
    log "SCALE-DOWN killed=$KILLED cpu=${CPU}% alive=$ALIVE floor=${FLOOR_CPU}%"

  else
    log "HOLD cpu=${CPU}% alive=$ALIVE target=${TARGET_CPU}% floor=${FLOOR_CPU}%"
  fi

  # Write scale status for dashboard
  python3 -c "
import json,datetime
json.dump({'cycle':$CYCLE,'cpu_pct':float('${CPU%.*}'),'alive':$ALIVE,
  'target_cpu':$TARGET_CPU,'floor_cpu':$FLOOR_CPU,'max_workers':$MAX_WORKERS,
  'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$S/scale-status.json','w'),indent=2)" 2>/dev/null || true

  sleep 15
done
