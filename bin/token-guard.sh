#!/usr/bin/env bash
# token-guard.sh — KILLS any process calling Anthropic/Claude API. No tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
mkdir -p "$STATE"; echo $$ > "$STATE/token-guard.pid"
LOG="$STATE/token-guard.log"
log(){ printf '[%s] [TOKEN-GUARD] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== TOKEN-GUARD pid=$$ — zero Anthropic API calls allowed ==="
while true; do
  if command -v lsof >/dev/null 2>&1; then
    HITS=$(lsof -i TCP 2>/dev/null | grep -iE "anthropic|claude\.ai" | grep -v grep || true)
    if [ -n "$HITS" ]; then
      log "ALERT: Anthropic API call detected — KILLING"
      echo "$HITS" | awk '{print $2}' | sort -u | while read -r pid; do
        kill -9 "$pid" 2>/dev/null && log "  Killed PID=$pid"; done
    fi
  fi
  # Scan bin/ for API key references
  BAD=$(grep -rl "api\.anthropic\.com\|ANTHROPIC_API_KEY\|anthropic-ai/sdk" "$ROOT/bin/" 2>/dev/null || true)
  [ -n "$BAD" ] && log "WARN: API ref in scripts: $BAD"
  printf '{"updatedAt":"%s","status":"guarding","violations":0}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE/token-guard.json" 2>/dev/null||true
  sleep 10; done
