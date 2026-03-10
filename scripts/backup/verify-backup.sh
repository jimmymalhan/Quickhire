#!/usr/bin/env bash
# Quickhire Backup Verification Script
# Restores the latest backup to a temp database and runs checks
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/quickhire}"
VERIFY_DB="quickhire_verify_$(date +%s)"

# Find latest backup
LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
if [ -z "${LATEST_BACKUP}" ]; then
  echo "ERROR: No backup files found in ${BACKUP_DIR}"
  exit 1
fi

echo "[$(date)] Verifying backup: ${LATEST_BACKUP}"

# Create verification database
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "CREATE DATABASE ${VERIFY_DB};" 2>/dev/null

cleanup() {
  echo "[$(date)] Cleaning up verification database..."
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" 2>/dev/null
}
trap cleanup EXIT

# Restore
echo "[$(date)] Restoring to verification database..."
gunzip -c "${LATEST_BACKUP}" | pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${VERIFY_DB}" \
  --no-owner \
  --no-privileges 2>/dev/null

# Verify tables exist
EXPECTED_TABLES=("users" "jobs" "applications" "user_preferences")
PASS=true

for table in "${EXPECTED_TABLES[@]}"; do
  EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${VERIFY_DB}" \
    -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='${table}');")
  if echo "${EXISTS}" | grep -q "t"; then
    echo "  PASS: Table '${table}' exists"
  else
    echo "  FAIL: Table '${table}' missing"
    PASS=false
  fi
done

# Check row counts
echo ""
echo "Row counts:"
for table in "${EXPECTED_TABLES[@]}"; do
  COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${VERIFY_DB}" \
    -t -c "SELECT count(*) FROM ${table};" 2>/dev/null || echo "N/A")
  echo "  ${table}: ${COUNT} rows"
done

if [ "${PASS}" = true ]; then
  echo ""
  echo "[$(date)] Backup verification PASSED"
  exit 0
else
  echo ""
  echo "[$(date)] Backup verification FAILED"
  exit 1
fi
