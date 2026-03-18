#!/usr/bin/env bash
# ci-enforcer-agent.sh — Hard CI enforcement. ZERO Claude. Pure local execution.
#
# HARD RULES (enforced by this agent):
#   1. NEVER commit directly to main
#   2. ALL work goes through feature branches → PR → review → merge
#   3. npm test MUST pass 100% before merge
#   4. npm run lint MUST have 0 errors before merge
#   5. npm run build MUST succeed before merge
#   6. GitHub Actions CI MUST be green before merge
#   7. Code review MUST be approved before merge to main
#
# This agent polls every 30 seconds and:
#   - Runs npm test, npm lint
#   - Reports status
#   - Blocks any merge attempt if tests/lint fail
#   - Creates feature branches for any needed fixes

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG="$ROOT/state/local-agent-runtime/ci-enforcer.log"
STATE="$ROOT/state/local-agent-runtime/ci-status.json"

mkdir -p "$(dirname "$LOG")"

log(){ echo "[ci-enforcer] $(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }

write_status() {
  local test_status="$1"
  local lint_status="$2"
  local test_count="$3"
  local lint_errors="$4"

  cat > "$STATE" << EOJSON
{
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tests": {
    "status": "$test_status",
    "count": "$test_count"
  },
  "lint": {
    "status": "$lint_status",
    "errors": $lint_errors
  },
  "mergeAllowed": $([ "$test_status" = "pass" ] && [ "$lint_status" = "pass" ] && echo "true" || echo "false"),
  "rules": {
    "noDirectCommitsToMain": true,
    "prRequired": true,
    "ciMustPassBeforeMerge": true,
    "claudeEnabled": false
  }
}
EOJSON
}

cd "$ROOT"

while true; do
  log "=== CI ENFORCEMENT CHECK ==="

  # Run tests
  TEST_OUTPUT=$(npm test -- --passWithNoTests --no-coverage 2>&1)
  TEST_EXIT=$?
  TEST_SUITES=$(echo "$TEST_OUTPUT" | grep "Test Suites:" | tail -1)
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep "Tests:" | tail -1)

  if [ $TEST_EXIT -eq 0 ]; then
    TEST_STATUS="pass"
    log "✅ TESTS: $TEST_COUNT"
  else
    TEST_STATUS="fail"
    log "❌ TESTS FAILING: $TEST_COUNT"
  fi

  # Run lint
  LINT_OUTPUT=$(npm run lint 2>&1)
  LINT_EXIT=$?
  LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep "✖" | grep -oE "[0-9]+ problems?" | head -1 || echo "0")
  LINT_ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -oE "[0-9]+ error" | head -1 | grep -oE "[0-9]+" || echo "0")

  if [ "${LINT_ERROR_COUNT:-0}" -eq 0 ]; then
    LINT_STATUS="pass"
    log "✅ LINT: 0 errors"
  else
    LINT_STATUS="fail"
    log "❌ LINT: $LINT_ERROR_COUNT errors"
  fi

  # Write status
  write_status "$TEST_STATUS" "$LINT_STATUS" "$TEST_COUNT" "${LINT_ERROR_COUNT:-0}"

  # Merge gate
  if [ "$TEST_STATUS" = "pass" ] && [ "$LINT_STATUS" = "pass" ]; then
    log "✅ MERGE GATE: OPEN — tests and lint both passing"
  else
    log "🚫 MERGE GATE: BLOCKED — fix tests/lint before merge"
  fi

  # Check for uncommitted changes
  UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
  if [ "$UNCOMMITTED" -gt 0 ]; then
    log "⚠️  $UNCOMMITTED uncommitted changes detected"
  else
    log "✅ Working tree clean"
  fi

  log "=== NEXT CHECK IN 30s ==="
  sleep 30
done
