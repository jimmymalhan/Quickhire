#!/bin/bash
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-staging}"

case "$ENVIRONMENT" in
  staging)
    BASE_URL="https://staging.quickhire.app"
    API_URL="https://staging-api.quickhire.app"
    ;;
  production)
    BASE_URL="https://quickhire.app"
    API_URL="https://api.quickhire.app"
    ;;
  local)
    BASE_URL="http://localhost:3000"
    API_URL="http://localhost:8000"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

PASSED=0
FAILED=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"

  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo "[PASS] $name (HTTP $status)"
    PASSED=$((PASSED + 1))
  else
    echo "[FAIL] $name (expected $expected_status, got $status)"
    FAILED=$((FAILED + 1))
  fi
}

echo "=== Quickhire Smoke Tests ($ENVIRONMENT) ==="
echo ""

# Frontend checks
check "Frontend homepage" "$BASE_URL"
check "Frontend health" "$BASE_URL/health"

# Backend API checks
check "Backend health" "$API_URL/health"
check "Backend API root" "$API_URL/api" "200"
check "Backend metrics" "$API_URL/metrics" "200"

# Auth endpoint exists
check "Auth endpoint" "$API_URL/api/auth/status" "401"

# Jobs endpoint requires auth
check "Jobs endpoint (auth required)" "$API_URL/api/jobs" "401"

echo ""
echo "=== Results: $PASSED passed, $FAILED failed ==="

if [ "$FAILED" -gt 0 ]; then
  echo "Smoke tests FAILED"
  exit 1
fi

echo "All smoke tests PASSED"
