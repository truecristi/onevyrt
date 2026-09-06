#!/usr/bin/env bash
# Nightly backup of the OneVYRT data volume (users, workspaces, projects —
# everything under .gearbox) into rotated local snapshots. Local-disk
# redundancy only, not offsite, but it protects against accidental deletion
# or corruption in the live volume itself. Safe to re-run any time; each run
# just adds one more timestamped snapshot and prunes ones past retention.
set -euo pipefail

BACKUP_DIR=/opt/onevyrt-backups
RETENTION_DAYS=14
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Tar the volume from a disposable container instead of the host, so this
# works the same whether or not tar happens to be installed on the host, and
# never touches the volume with anything but a read-only mount.
docker run --rm -v onevyrt-data:/data:ro -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/onevyrt-data-${STAMP}.tar.gz" -C /data .

find "$BACKUP_DIR" -name 'onevyrt-data-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete: $BACKUP_DIR/onevyrt-data-${STAMP}.tar.gz"
