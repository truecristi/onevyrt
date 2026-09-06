#!/usr/bin/env bash
#
# Timestamped, gzipped database backup — run ON the server (or from cron).
# Verifies the dump before keeping it and prunes old ones. Pairs with
# deploy/restore.sh; see RUNBOOK "If the DATA itself is corrupted".
#
# Usage (defaults shown):
#   ENV_FILE=/etc/onevyrt/web.env \
#   BACKUP_DIR=/var/backups/onevyrt \
#   KEEP=14 \
#   ./deploy/backup.sh
#
# DATABASE_URL is read from ENV_FILE (the same file the app/deploy use), or
# from the environment if already set. Cron example (daily 03:15 UTC):
#   15 3 * * * /opt/onevyrt-src/deploy/backup.sh >> /var/log/onevyrt-backup.log 2>&1

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/onevyrt/web.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/onevyrt}"
KEEP="${KEEP:-14}"

# Prefer an already-exported DATABASE_URL; otherwise read it from the env file.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
  fi
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "backup: DATABASE_URL not set and not found in $ENV_FILE" >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || { echo "backup: pg_dump not installed" >&2; exit 1; }

# node-postgres accepts sslmode=no-verify (use SSL, skip cert verification), but
# libpq/pg_dump reject it — their equivalent is sslmode=require. Translate it so
# the SAME DATABASE_URL the app uses also works for the dump.
DATABASE_URL="${DATABASE_URL/sslmode=no-verify/sslmode=require}"

mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/onevyrt-$ts.sql.gz"
tmp="$out.partial"

echo "backup: dumping to $out ..."
# --no-owner/--no-privileges keep the dump portable to a fresh restore target.
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$tmp"

# Verify before we trust it: valid gzip and non-empty payload.
gzip -t "$tmp"
if [ "$(gzip -dc "$tmp" | head -c 1 | wc -c)" -eq 0 ]; then
  echo "backup: produced an empty dump — discarding" >&2
  rm -f "$tmp"
  exit 1
fi
mv "$tmp" "$out"
echo "backup: OK $(du -h "$out" | cut -f1) -> $out"

# Prune: keep the newest $KEEP, delete the rest.
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/onevyrt-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "backup: retained newest $KEEP in $BACKUP_DIR"
