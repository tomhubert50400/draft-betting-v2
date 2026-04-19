#!/bin/bash
# SQLite backup script. Run via cron, e.g. every 6h:
#   0 */6 * * * /Users/YOURUSER/draft-betting/scripts/backup.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="$PROJECT_ROOT/data/draft-betting.db"
BACKUP_DIR="$PROJECT_ROOT/backups"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/draft-betting-$TS.db"

# Use sqlite3 .backup (safe for live DB with WAL)
sqlite3 "$DB" ".backup '$OUT'"
gzip "$OUT"

echo "Backup written: $OUT.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name 'draft-betting-*.db.gz' -mtime +$KEEP_DAYS -delete
