#!/usr/bin/env bash
# Quickhire PostgreSQL Restore Script
# Usage: ./restore.sh <backup_file> [target_database]
set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-quickhire_restore}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup_file> [target_database]"
  echo "Example: $0 /var/backups/quickhire/quickhire_20260309_020000.sql.gz quickhire_restore"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "[$(date)] Starting restore to ${TARGET_DB}..."
echo "WARNING: This will DROP and recreate the database '${TARGET_DB}'."
read -p "Continue? (y/N): " confirm
if [ "${confirm}" != "y" ] && [ "${confirm}" != "Y" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Drop and recreate target database
echo "[$(date)] Recreating database ${TARGET_DB}..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "CREATE DATABASE ${TARGET_DB};"

# Restore from backup
echo "[$(date)] Restoring from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${TARGET_DB}" \
  --verbose \
  --no-owner \
  --no-privileges

echo "[$(date)] Restore completed successfully"

# Verify restore
TABLES=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "[$(date)] Restored database has ${TABLES} tables"
