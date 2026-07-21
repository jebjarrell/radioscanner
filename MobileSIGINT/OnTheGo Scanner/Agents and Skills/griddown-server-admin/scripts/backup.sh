#!/bin/bash
# GridDown Server Backup Script
# Creates compressed backup of data directory and .env file
# Auto-prunes to keep only last 10 backups

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="griddown-${TIMESTAMP}.tar.gz"
MAX_BACKUPS=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Check if data directory exists
if [[ ! -d "${PROJECT_DIR}/data" ]]; then
    log_error "Data directory not found: ${PROJECT_DIR}/data"
    exit 1
fi

# Checkpoint SQLite WAL if database exists
BULLETIN_DB="${PROJECT_DIR}/data/bulletin/bulletin.db"
if [[ -f "$BULLETIN_DB" ]]; then
    log_info "Checkpointing SQLite WAL..."
    sqlite3 "$BULLETIN_DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
fi

# Create backup
log_info "Creating backup: ${BACKUP_NAME}"
cd "$PROJECT_DIR"

tar -czf "${BACKUP_DIR}/${BACKUP_NAME}" \
    --exclude='data/bulletin/*.db-wal' \
    --exclude='data/bulletin/*.db-shm' \
    data/ \
    .env 2>/dev/null || {
        # If .env doesn't exist, backup just data
        tar -czf "${BACKUP_DIR}/${BACKUP_NAME}" \
            --exclude='data/bulletin/*.db-wal' \
            --exclude='data/bulletin/*.db-shm' \
            data/
    }

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)
log_info "Backup complete: ${BACKUP_SIZE}"

# Prune old backups
log_info "Pruning old backups (keeping last ${MAX_BACKUPS})..."
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/griddown-*.tar.gz 2>/dev/null | wc -l)

if [[ $BACKUP_COUNT -gt $MAX_BACKUPS ]]; then
    DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "${BACKUP_DIR}"/griddown-*.tar.gz | tail -n "$DELETE_COUNT" | while read -r old_backup; do
        log_warn "Removing old backup: $(basename "$old_backup")"
        rm -f "$old_backup"
    done
fi

# List current backups
log_info "Current backups:"
ls -lh "${BACKUP_DIR}"/griddown-*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

log_info "Backup complete: ${BACKUP_DIR}/${BACKUP_NAME}"
