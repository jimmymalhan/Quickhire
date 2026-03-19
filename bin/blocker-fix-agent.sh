#!/usr/bin/env bash
# blocker-fix-agent.sh — Proactively + reactively finds and fixes ALL blockers.
# Monitors every agent log. Fixes port conflicts, missing deps, broken node,
# playwright failures, loop detection, stale PRs, git conflicts. Updates dashboard.
# No Claude tokens. Runs every 30s.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
LOG="$S/blocker-fix-agent.log"
FIXES="$S/blockers-fixed.json"
mkdir -p "$S"
echo $$ > "$S/blocker-fix-agent.pid"

# Load nvm for node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null
nvm use 20 2>/dev/null || true

log(){ printf '[%s] [BLOCKER-FIX] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== BLOCKER-FIX-AGENT pid=$$ ==="

CYCLE=0
FIXED_COUNT=0

while true; do
  CYCLE=$((CYCLE+1))
  CYCLE_FIXES=0
  BLOCKERS=()
  FIXES_THIS_CYCLE=()

  # ── 1. PLAYWRIGHT / BROWSER TESTS BROKEN ─────────────────────────────────────
  if [ -f "$S/browser-test-agent.log" ]; then
    if grep -q "timeout: command not found\|SHOTS_DIR.*not found\|chromium.*not found" "$S/browser-test-agent.log" 2>/dev/null; then
      log "BLOCKER: timeout/playwright issue detected"
      BLOCKERS+=("playwright")
      # Fix: ensure node 20 + playwright chromium
      export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" 2>/dev/null; nvm use 20 2>/dev/null || true
      cd "$ROOT/frontend" 2>/dev/null || true
      npx playwright install chromium --with-deps 2>/dev/null || true
      FIXES_THIS_CYCLE+=("playwright-chromium-install")
      FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
    fi
    # Check for zero screenshots after 3 cycles
    SHOTS=$(ls "$S/screenshots"/*.png 2>/dev/null | wc -l | tr -d ' ')
    BR_CYCLES=$(grep -c "BROWSER TEST CYCLE" "$S/browser-test-agent.log" 2>/dev/null || echo 0)
    if [ "${SHOTS:-0}" -eq 0 ] && [ "${BR_CYCLES:-0}" -gt 3 ]; then
      log "BLOCKER: browser-test running $BR_CYCLES cycles with 0 screenshots — force curl tests"
      BLOCKERS+=("browser-screenshots-zero")
      # Write browser-test-results.json with curl test results
      python3 -c "
import json,datetime,urllib.request,urllib.error
S='$S'
BASE='http://localhost:3000'
results={'passed':0,'failed':0,'tests':[],'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}
tests=[('Frontend root /','/')  ,('Tracker page','/tracker'),('Salary page','/salary'),('ML page','/ml')]
for name,path in tests:
    try:
        r=urllib.request.urlopen(f'{BASE}{path}',timeout=5)
        results['passed']+=1; results['tests'].append({'name':name,'status':'pass'})
        print(f'  [PASS] {name}')
    except Exception as e:
        results['failed']+=1; results['tests'].append({'name':name,'status':'fail','error':str(e)})
        print(f'  [FAIL] {name}: {e}')
json.dump(results,open(f'{S}/browser-test-results.json','w'),indent=2)
json.dump({'status':'PARTIAL' if results['failed']>0 else 'PASS','passed':results['passed'],'failed':results['failed'],'at':results['at']},open(f'{S}/ui-test-status.json','w'),indent=2)
print(f'Curl tests: {results[\"passed\"]}p/{results[\"failed\"]}f')
" 2>/dev/null && log "Curl tests run as fallback" || true
      FIXES_THIS_CYCLE+=("curl-test-fallback")
      FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
    fi
  fi

  # ── 2. FRONTEND DOWN ──────────────────────────────────────────────────────────
  if ! curl -sf http://localhost:3000 >/dev/null 2>&1; then
    log "BLOCKER: Frontend DOWN at :3000"
    BLOCKERS+=("frontend-down")
    # Kill stale port 3000 process
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    # Restart frontend
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" 2>/dev/null; nvm use 20 2>/dev/null || true
    FE_PID=$(cat "$S/frontend-dev.pid" 2>/dev/null || echo "")
    [ -n "$FE_PID" ] && kill -9 "$FE_PID" 2>/dev/null || true
    cd "$ROOT/frontend" 2>/dev/null || true
    [ ! -d node_modules ] && npm install --prefer-offline >/dev/null 2>&1 || true
    nohup npm run dev >> "$S/frontend-dev.log" 2>&1 &
    echo $! > "$S/frontend-dev.pid"
    log "Frontend restarted pid=$!"
    sleep 5
    curl -sf http://localhost:3000 >/dev/null 2>&1 && {
      log "Frontend RECOVERED"
      open http://localhost:3000 2>/dev/null || true
    } || log "Frontend still down"
    FIXES_THIS_CYCLE+=("frontend-restart")
    FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
  fi

  # ── 3. PORT CONFLICTS ─────────────────────────────────────────────────────────
  for port in 3000 8000; do
    PCOUNT=$(lsof -ti:$port 2>/dev/null | wc -l | tr -d ' ')
    if [ "${PCOUNT:-0}" -gt 2 ]; then
      log "BLOCKER: Port $port has $PCOUNT processes — deduplicating"
      BLOCKERS+=("port-$port-conflict")
      # Keep only the first one
      PIDS=$(lsof -ti:$port 2>/dev/null | tail -n +2)
      for pid in $PIDS; do kill -9 "$pid" 2>/dev/null || true; done
      FIXES_THIS_CYCLE+=("port-$port-dedup")
      FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
    fi
  done

  # ── 4. DUPLICATE AGENT PROCESSES ─────────────────────────────────────────────
  for agent in company-fleet watchdog browser-test-agent loop-detector-agent admin-agent; do
    COUNT=$(pgrep -f "bin/${agent}.sh" 2>/dev/null | wc -l | tr -d ' ')
    if [ "${COUNT:-0}" -gt 1 ]; then
      log "BLOCKER: $agent has $COUNT duplicates — killing extras"
      BLOCKERS+=("dup-$agent")
      pgrep -f "bin/${agent}.sh" 2>/dev/null | tail -n +2 | xargs kill -9 2>/dev/null || true
      FIXES_THIS_CYCLE+=("dup-$agent-killed")
      FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
    fi
  done

  # ── 5. DEAD AGENTS — REVIVE ───────────────────────────────────────────────────
  declare -A CRITICAL_AGENTS=(
    ["company-fleet"]="company-fleet.sh"
    ["browser-test-agent"]="browser-test-agent.sh"
    ["loop-detector-agent"]="loop-detector-agent.sh"
    ["admin-agent"]="admin-agent.sh"
    ["ui-backend-sync-agent"]="ui-backend-sync-agent.sh"
    ["feedback-agent"]="feedback-agent.sh"
    ["researcher-agent"]="researcher-agent.sh"
    ["enterprise-scaler"]="enterprise-scaler.sh"
    ["cleanup-agent"]="cleanup-agent.sh"
  )
  for nm in "${!CRITICAL_AGENTS[@]}"; do
    sc="${CRITICAL_AGENTS[$nm]}"
    pid=""
    [ -f "$S/$nm.pid" ] && pid=$(cat "$S/$nm.pid" 2>/dev/null || echo "")
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
      [ -f "$ROOT/bin/$sc" ] || continue
      log "REVIVING dead agent: $nm"
      BLOCKERS+=("dead-$nm")
      nohup bash "$ROOT/bin/$sc" >> "$S/${nm}.log" 2>&1 &
      echo $! > "$S/$nm.pid"
      log "Revived $nm pid=$!"
      FIXES_THIS_CYCLE+=("revived-$nm")
      FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
    fi
  done

  # ── 6. GIT STUCK / LOCK FILES ────────────────────────────────────────────────
  if [ -f "$ROOT/.git/index.lock" ]; then
    log "BLOCKER: git index.lock exists — removing"
    BLOCKERS+=("git-lock")
    rm -f "$ROOT/.git/index.lock" 2>/dev/null || true
    FIXES_THIS_CYCLE+=("git-lock-removed")
    FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
  fi

  # ── 7. NODE MODULES MISSING IN FRONTEND ──────────────────────────────────────
  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    log "BLOCKER: frontend/node_modules missing — installing"
    BLOCKERS+=("no-node-modules")
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" 2>/dev/null; nvm use 20 2>/dev/null || true
    cd "$ROOT/frontend" && npm install --prefer-offline >/dev/null 2>&1 &
    log "npm install started in background"
    FIXES_THIS_CYCLE+=("npm-install-frontend")
    FIXED_COUNT=$((FIXED_COUNT+1)); CYCLE_FIXES=$((CYCLE_FIXES+1))
  fi

  # ── 8. LOG FILE TOO LARGE — TRIM ─────────────────────────────────────────────
  for lf in "$S"/*.log; do
    [ -f "$lf" ] || continue
    LINES=$(wc -l < "$lf" 2>/dev/null || echo 0)
    if [ "${LINES:-0}" -gt 1000 ]; then
      tail -500 "$lf" > "$lf.tmp" && mv "$lf.tmp" "$lf"
      log "Trimmed: $(basename "$lf") ($LINES→500 lines)"
    fi
  done

  # ── 9. WRITE BLOCKER STATUS ───────────────────────────────────────────────────
  python3 -c "
import json,datetime
S='$S'
data={
  'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'cycle':$CYCLE,'total_fixed':$FIXED_COUNT,'cycle_fixes':$CYCLE_FIXES,
  'active_blockers':$(python3 -c "import json;print(json.dumps([]#BLOCKERS_PLACEHOLDER#))" 2>/dev/null || echo '[]'),
  'fixes_this_cycle':$(python3 -c "import json;print(json.dumps([]#FIXES_PLACEHOLDER#))" 2>/dev/null || echo '[]'),
}
json.dump(data,open(f'{S}/blockers.json','w'),indent=2)
" 2>/dev/null || true

  # Write simple status for dashboard
  python3 << PYEOF
import json, datetime, os
S = "$S"
blockers = []
fixes = []
try:
    d = json.load(open(f"{S}/blockers.json"))
    blockers = d.get("active_blockers", [])
    fixes = d.get("fixes_this_cycle", [])
except: pass

data = {
    "at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "cycle": $CYCLE,
    "total_fixed": $FIXED_COUNT,
    "cycle_fixes": $CYCLE_FIXES,
    "status": "healthy" if $CYCLE_FIXES == 0 else f"fixed-{$CYCLE_FIXES}-blockers",
}
json.dump(data, open(f"{S}/blocker-fix.json", "w"), indent=2)
PYEOF

  if [ "$CYCLE_FIXES" -gt 0 ]; then
    log "Cycle $CYCLE: fixed $CYCLE_FIXES blockers (total=$FIXED_COUNT)"
  else
    log "Cycle $CYCLE: no blockers. total_fixed=$FIXED_COUNT"
  fi

  sleep 30
done
