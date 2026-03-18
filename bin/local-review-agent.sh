#!/usr/bin/env bash
# local-review-agent.sh — Local failure analysis and audit agent.
# Called when a task fails MAX_LOCAL_RETRIES times.
# NEVER calls Claude. Performs deterministic local analysis only.
#
# Output contract:
#   REVIEW: <failed-task-id>
#   ROOT_CAUSE: <one-line reason>
#   DIFF_SUGGESTION: <exact file:line change or NEEDS_HUMAN>
#   GATE: pass|fail
#   LEARNED: <one-line lesson for execution-patterns.json>

set -euo pipefail

ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROMPT="${AGENT_PROMPT:-}"
LOG="$ROOT/state/local-agent-runtime/local-review.log"

log() { echo "[local-review] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

if [ -z "$PROMPT" ]; then
  echo "REVIEW: unknown"
  echo "ROOT_CAUSE: AGENT_PROMPT not set — cannot analyze"
  echo "DIFF_SUGGESTION: NEEDS_HUMAN"
  echo "GATE: fail"
  echo "LEARNED: review agent must always receive AGENT_PROMPT"
  exit 1
fi

log "Analyzing: ${PROMPT:0:120}"

# ── Extract task id from prompt if present ────────────────────────────────────
TASK_ID=$(echo "$PROMPT" | grep -oE 'cmd-[a-zA-Z0-9_-]+' | head -1 || echo "unknown")

# ── Check last N worker logs for this task ────────────────────────────────────
LOGS_FILE="$ROOT/state/local-agent-runtime/worker-logs.json"
LAST_ERROR=""
if [ -f "$LOGS_FILE" ]; then
  LAST_ERROR=$(node -e "
    const logs = JSON.parse(require('fs').readFileSync('$LOGS_FILE','utf8'));
    const relevant = logs.filter(l => l.commandId === '$TASK_ID' || (l.msg||'').includes('$TASK_ID'));
    const errors = relevant.filter(l => l.level === 'error' || l.level === 'warn');
    if (errors.length) {
      const last = errors[errors.length-1];
      process.stdout.write(last.msg || '');
    } else {
      process.stdout.write('no error log found for task');
    }
  " 2>/dev/null || echo "log parse failed")
fi

# ── Check routing match ───────────────────────────────────────────────────────
ROUTE_CHECK=$(node -e "
  const { findBestAgent } = require('$ROOT/src/automation/agentRegistry');
  const agent = findBestAgent('$PROMPT');
  if (agent) {
    process.stdout.write('agent=' + agent.id + ' caps=' + (agent.capabilities||[]).join(','));
  } else {
    process.stdout.write('NO_MATCH');
  }
" 2>/dev/null || echo "registry-check-failed")

# ── Determine root cause ──────────────────────────────────────────────────────
ROOT_CAUSE="unknown"
DIFF_SUGGESTION="NEEDS_HUMAN"
GATE="fail"
LEARNED="task failed 3x — needs skill expansion in agentRegistry or new agent"

if echo "$ROUTE_CHECK" | grep -q "NO_MATCH"; then
  ROOT_CAUSE="No agent matched prompt — missing skill keyword in agentRegistry"
  DIFF_SUGGESTION="Add skill keyword to matching agent in src/automation/agentRegistry.js"
  GATE="fail"
  LEARNED="Unmatched prompts need new skill entry in agentRegistry"
elif echo "$LAST_ERROR" | grep -q -i "proof\|noop\|no-op"; then
  ROOT_CAUSE="Agent matched but output was a no-op — wrong agent capability tier"
  DIFF_SUGGESTION="Check agent capabilities in agentRegistry, promote to feature-capable if needed"
  GATE="fail"
  LEARNED="no-op output from wrong-tier agent — capability gate needs tightening"
elif echo "$LAST_ERROR" | grep -q -i "timeout\|stuck\|ECONNREFUSED"; then
  ROOT_CAUSE="External dependency unavailable (DB/Redis/network timeout)"
  DIFF_SUGGESTION="Mark slice BLOCKED with unlock condition: start DB/Redis or fix network"
  GATE="fail"
  LEARNED="Infrastructure dependency must be running before this slice can proceed"
elif echo "$LAST_ERROR" | grep -q -i "ENOENT\|not found\|missing"; then
  ROOT_CAUSE="Required file or binary not found"
  DIFF_SUGGESTION="Verify file paths and install missing dependencies (npm install)"
  GATE="fail"
  LEARNED="Missing file dependency — check paths before retry"
else
  ROOT_CAUSE="${LAST_ERROR:-unknown failure after 3 attempts}"
  DIFF_SUGGESTION="Inspect worker-logs.json for task $TASK_ID"
  GATE="fail"
  LEARNED="Unclassified failure — review worker-logs.json"
fi

# ── Write structured output ───────────────────────────────────────────────────
echo "REVIEW: $TASK_ID"
echo "ROOT_CAUSE: $ROOT_CAUSE"
echo "DIFF_SUGGESTION: $DIFF_SUGGESTION"
echo "GATE: $GATE"
echo "LEARNED: $LEARNED"
echo "ROUTE_CHECK: $ROUTE_CHECK"

log "Review complete: task=$TASK_ID gate=$GATE"
exit 0
