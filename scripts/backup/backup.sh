#!/usr/bin/env bash
# Quickhire PostgreSQL Backup Script
# Schedule via cron: 0 2 * * * /path/to/backup.sh
set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-quickhire}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/quickhire}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# Create compressed backup
pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --verbose \
  2>>"${BACKUP_DIR}/backup.log" | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Upload to S3 if configured
if [ -n "${S3_BUCKET}" ]; then
  echo "[$(date)] Uploading to S3..."
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/${DB_NAME}_${TIMESTAMP}.sql.gz" \
    --storage-class STANDARD_IA
  echo "[$(date)] S3 upload complete"
fi

# Verify backup integrity
echo "[$(date)] Verifying backup integrity..."
if gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  echo "[$(date)] Backup integrity verified"
else
  echo "[$(date)] ERROR: Backup file is corrupted!" >&2
  exit 1
fi

# Cleanup old backups (local)
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "${BACKUP_DIR}" -name "*.sql.gz" | wc -l)
echo "[$(date)] ${REMAINING} backup(s) remaining after cleanup"

# Cleanup old S3 backups
if [ -n "${S3_BUCKET}" ]; then
  CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)
  aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
    FILE_DATE=$(echo "${line}" | awk '{print $1}')
    FILE_NAME=$(echo "${line}" | awk '{print $4}')
    if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
      aws s3 rm "s3://${S3_BUCKET}/backups/${FILE_NAME}"
      echo "[$(date)] Deleted old S3 backup: ${FILE_NAME}"
    fi
  done
fi

echo "[$(date)] Backup completed successfully"
