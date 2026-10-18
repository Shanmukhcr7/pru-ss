#!/bin/bash
# ParentVision PostgreSQL Automated Backup Script

set -e

BACKUP_DIR="/var/backups/parentvision"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="parentvision_backup_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting ParentVision database backup..."
docker exec -t parentvision-db pg_dump -U "${POSTGRES_USER:-parentvision_admin}" "${POSTGRES_DB:-parentvision}" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Backup completed: ${BACKUP_DIR}/${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Prune backups older than 30 days
find "$BACKUP_DIR" -type f -name "parentvision_backup_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Old backups purged (retention: 30 days)."
