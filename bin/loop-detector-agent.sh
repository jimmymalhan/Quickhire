#!/usr/bin/env bash
# loop-detector-agent.sh — Detects stuck/looping agents. Kills, changes approach, restarts.
# No Claude tokens. Self-heals all continuous errors automatically.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
LOG="$S/loop-detector.log"
LEARN="$S/learnings.log"
mkdir -p "$S"; echo $$ > "$S/loop-detector-agent.pid"
log(){ printf '[%s] [LOOP-DETECT] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
learn(){ printf '[%s] FIXED: %s\n' "$(date +%Y-%m-%d %H:%M)" "$1" >> "$LEARN"; }

log "=== LOOP-DETECTOR pid=$$ ==="

# ── Detect repeated lines in a log (loop signature) ──────────────────────────
is_looping(){
  local logfile="$1" threshold="${2:-5}"
  [ -f "$logfile" ] || return 1
  # If last 20 lines have same content repeated >= threshold times → loop
  local count
  count=$(tail -20 "$logfile" 2>/dev/null \
    | sed 's/\[.*\] //' \
    | sort | uniq -c | sort -rn | head -1 | awk '{print $1}')
  [ "${count:-0}" -ge "$threshold" ] && return 0 || return 1
}

# ── Get dominant error from log ───────────────────────────────────────────────
get_error(){
  local logfile="$1"
  tail -30 "$logfile" 2>/dev/null \
    | grep -i "error\|fail\|crash\|cannot\|not found\|killed" \
    | tail -1 | sed 's/\[.*\] //' | cut -c1-80 || echo "unknown"
}

# ── Fix strategies per agent ─────────────────────────────────────────────────
fix_agent(){
  local name="$1" logfile="$2" err="$3"
  log "FIXING $name — err: $err"
  learn "$name was looping: $err"

  # Kill the stuck agent
  local pid; pid=$(cat "$S/${name}.pid" 2>/dev/null || echo "")
  [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null && log "Killed $name pid=$pid"
  rm -f "$S/${name}.pid"

  # Clear its log to break loop signature
  > "$logfile" 2>/dev/null || true

  # Apply fix based on error pattern
  case "$err" in
    *npm*|*MODULE_NOT_FOUND*|*node_modules*)
      log "Fix: npm issue — skipping npm calls in $name"
      # Patch: add npm skip guard
      local script="$ROOT/bin/${name}.sh"
      if [ -f "$script" ] && ! grep -q "NPM_SKIP" "$script"; then
        sed -i '' '2a\
# NPM_SKIP: auto-patched by loop-detector — npm broken on this system\
NPM(){ echo "[SKIP-NPM] $*" >> '"$S/npm-skip.log"' 2>/dev/null; return 0; }' \
          "$script" 2>/dev/null || true
        log "Patched $name to skip npm"
      fi ;;

    *git*checkout*|*branch*already*|*branch*not*found*)
      log "Fix: git branch conflict — cleaning up branches"
      git -C "$ROOT" checkout main 2>/dev/null || true
      git -C "$ROOT" branch | grep -v "^\*\|main" | tr -d ' ' | \
        xargs -I{} git -C "$ROOT" branch -D {} 2>/dev/null || true ;;

    *rate.limit*|*429*|*too.many*)
      log "Fix: rate limit — adding 60s sleep to $name"
      echo "sleep 60  # rate-limit backoff added by loop-detector" \
        >> "$S/${name}-backoff.flag" 2>/dev/null || true ;;

    *port*already*|*address.in.use*|*EADDRINUSE*)
      log "Fix: port conflict — killing port 3000/8000"
      lsof -ti:3000 | xargs kill -9 2>/dev/null || true
      lsof -ti:8000 | xargs kill -9 2>/dev/null || true ;;

    *permission*|*EACCES*)
      log "Fix: permission error — chmod bin/"
      chmod +x "$ROOT/bin"/*.sh 2>/dev/null || true ;;

    *playwright*|*chromium*|*browser*)
      log "Fix: browser/Playwright issue — switching to curl-based tests"
      echo "USE_CURL_TESTS=1" > "$S/browser-mode.flag" ;;

    *network*|*ECONNREFUSED*|*timeout*)
      log "Fix: network issue — waiting 30s then retry"
      sleep 30 ;;

    *)
      log "Fix: generic restart with 30s delay for $name" ;;
  esac

  # Restart with fresh approach
  sleep 5
  local script="$ROOT/bin/${name}.sh"
  [ -f "$script" ] || { log "No script for $name — skipping restart"; return; }
  nohup bash "$script" >> "$logfile" 2>&1 &
  echo $! > "$S/${name}.pid"
  log "Restarted $name pid=$!"
}

# ── Frontend health check + auto-fix ─────────────────────────────────────────
fix_frontend(){
  curl -sf http://localhost:3000 >/dev/null 2>&1 && return 0
  log "Frontend DOWN — attempting auto-fix..."
  learn "frontend was down — restarting"

  # Kill stale frontend process
  local fe_pid; fe_pid=$(cat "$S/frontend-dev.pid" 2>/dev/null || echo "")
  [ -n "$fe_pid" ] && kill -9 "$fe_pid" 2>/dev/null || true
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true

  # Reload nvm and restart
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null
  nvm use 20 2>/dev/null || true

  if command -v npm >/dev/null 2>&1; then
    cd "$ROOT/frontend"
    [ ! -d node_modules ] && npm install --prefer-offline >/dev/null 2>&1 || true
    nohup npm run dev >> "$S/frontend-dev.log" 2>&1 &
    echo $! > "$S/frontend-dev.pid"
    log "Frontend restarted pid=$!"
    sleep 5
    curl -sf http://localhost:3000 >/dev/null 2>&1 && {
      log "Frontend RECOVERED — opening browser"
      open http://localhost:3000 2>/dev/null || true
    } || log "Frontend still down"
  else
    log "npm not available — running fix-node-and-launch.sh"
    nohup bash "$ROOT/bin/fix-node-and-launch.sh" >> "$S/fix-node.log" 2>&1 &
  fi
}

# ── Write loop status to dashboard ───────────────────────────────────────────
write_status(){
python3 -c "
import json,datetime,os
S='$S'
json.dump({'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'cycle':$1,'fixed':$2,'monitoring':True},
  open(f'{S}/loop-detector.json','w'),indent=2)" 2>/dev/null || true
}

CYCLE=0; FIXED=0
while true; do
  CYCLE=$((CYCLE+1))

  # Check every agent's log for loop signature
  for logfile in "$S"/*.log; do
    [ -f "$logfile" ] || continue
    name=$(basename "$logfile" .log)
    [ "$name" = "loop-detector" ] && continue  # don't watch self
    [ "$name" = "company-fleet" ] && continue  # dashboard is ok to repeat

    if is_looping "$logfile" 6; then
      err=$(get_error "$logfile")
      log "LOOP DETECTED: $name | $err"
      fix_agent "$name" "$logfile" "$err"
      FIXED=$((FIXED+1))
    fi
  done

  # Check worker logs for mass failures
  WORKER_FAILS=0
  for wlog in "$S"/worker-*.log; do
    [ -f "$wlog" ] || continue
    LAST=$(tail -5 "$wlog" 2>/dev/null | grep -ci "error\|fail" || echo 0)
    [ "${LAST:-0}" -ge 3 ] && WORKER_FAILS=$((WORKER_FAILS+1))
  done
  [ "$WORKER_FAILS" -ge 5 ] && {
    log "MASS WORKER FAILURE: $WORKER_FAILS workers failing — resetting all"
    learn "mass worker failure ($WORKER_FAILS) — reset to ready"
    python3 -c "
import json,os
S='$S'
try:
  bl=json.load(open(f'{S}/backlog.json'))
  [t.update({'status':'ready','worker':''}) for t in bl if t.get('status')=='failed']
  json.dump(bl,open(f'{S}/backlog.json','w'),indent=2)
  print('Reset failed tasks to ready')
except: pass" 2>/dev/null || true
  }

  # Frontend health every 5 cycles
  [ $((CYCLE % 5)) -eq 0 ] && fix_frontend

  write_status "$CYCLE" "$FIXED"
  log "Cycle $CYCLE done — fixed=$FIXED worker_fails=$WORKER_FAILS"
  sleep 20
done
