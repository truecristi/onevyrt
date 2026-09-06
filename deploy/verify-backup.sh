#!/usr/bin/env bash
#
# Restore-drill: PROVE a backup can actually be restored, automatically.
# deploy/backup.sh checks a dump is valid gzip and non-empty — but a dump can
# pass both and still be un-restorable (truncated mid-statement, schema it can't
# recreate). This restores the dump into a THROWAWAY scratch database, checks it
# came back with the expected shape, then drops it. It never touches production.
#
# Exits non-zero and loudly on any failure, so cron can alert on a bad backup
# instead of you discovering it during a real recovery.
#
# Usage:
#   ENV_FILE=/etc/onevyrt/web.env ./deploy/verify-backup.sh [backup.sql.gz]
#   # with no file, verifies the NEWEST backup in BACKUP_DIR:
#   BACKUP_DIR=/var/backups/onevyrt ./deploy/verify-backup.sh
#
# DATABASE_URL is read from the environment, or from ENV_FILE. The DB role must
# be able to CREATE/DROP a database (CREATEDB), or run this as the postgres
# superuser — the scratch DB is created on the same server, alongside prod.
#
# Cron example (daily 04:00 UTC, after the 03:15 backup):
#   0 4 * * * /opt/onevyrt-src/deploy/verify-backup.sh >> /var/log/onevyrt-backup.log 2>&1

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/onevyrt/web.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/onevyrt}"
# The restore must recreate a real schema — a healthy dump has many tables, not
# a handful. Tune if the schema is ever deliberately shrunk.
MIN_TABLES="${MIN_TABLES:-10}"
# Tables every OneVYRT dump must contain — their absence means a broken restore.
REQUIRED_TABLES="${REQUIRED_TABLES:-users workspaces}"

DUMP="${1:-}"

# Resolve DATABASE_URL: explicit env wins, else read it from the env file.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
  fi
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "verify-backup: DATABASE_URL not set and not found in $ENV_FILE" >&2
  exit 1
fi

command -v psql >/dev/null 2>&1 || { echo "verify-backup: psql not installed" >&2; exit 1; }

# libpq/psql reject sslmode=no-verify (which node-postgres accepts); require is
# the equivalent. Translate it once, up front, so both the maintenance and
# scratch connections below inherit a libpq-valid URL.
DATABASE_URL="${DATABASE_URL/sslmode=no-verify/sslmode=require}"

# Pick the newest backup when none was named.
if [ -z "$DUMP" ]; then
  # shellcheck disable=SC2012
  DUMP="$(ls -1t "$BACKUP_DIR"/onevyrt-*.sql.gz 2>/dev/null | head -1 || true)"
  if [ -z "$DUMP" ]; then
    echo "verify-backup: no backups found in $BACKUP_DIR" >&2
    exit 1
  fi
  echo "verify-backup: newest backup is $DUMP"
fi
if [ ! -f "$DUMP" ]; then
  echo "verify-backup: no such file: $DUMP" >&2
  exit 2
fi

# Fail fast on a corrupt archive before creating anything.
gzip -t "$DUMP"

# Split the URL into "everything up to the db name" + optional query string, so
# we can point the same connection at a different database (the maintenance DB
# to create/drop, and the scratch DB to restore into) without losing sslmode etc.
url_no_query="${DATABASE_URL%%\?*}"
query=""
[ "$url_no_query" != "$DATABASE_URL" ] && query="?${DATABASE_URL#*\?}"
prefix="${url_no_query%/*}"   # proto://user:pass@host:port

# Unique scratch name; PID + epoch avoids collisions with a concurrent drill.
SCRATCH="onevyrt_verify_$$_$(date -u +%s)"
ADMIN_URL="${prefix}/postgres${query}"
SCRATCH_URL="${prefix}/${SCRATCH}${query}"

# Always drop the scratch DB, even if a check fails or we're interrupted. The
# terminate step evicts any lingering backend so DROP can't be blocked.
cleanup() {
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$SCRATCH' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$SCRATCH\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "verify-backup: creating scratch database $SCRATCH ..."
if ! psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$SCRATCH\";" 2>/dev/null; then
  echo "verify-backup: could not create the scratch database." >&2
  echo "  The DB role needs CREATEDB, or run this as the postgres superuser." >&2
  exit 1
fi

echo "verify-backup: restoring $DUMP into $SCRATCH ..."
if ! gzip -dc "$DUMP" | psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q >/dev/null; then
  echo "verify-backup: FAILED — the dump did not restore cleanly." >&2
  exit 1
fi

# Shape checks — a clean restore of a real backup has the whole schema.
tables="$(psql "$SCRATCH_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
if [ "${tables:-0}" -lt "$MIN_TABLES" ]; then
  echo "verify-backup: FAILED — restored only ${tables:-0} tables (expected >= $MIN_TABLES)." >&2
  exit 1
fi

for t in $REQUIRED_TABLES; do
  present="$(psql "$SCRATCH_URL" -tAc "SELECT to_regclass('public.$t') IS NOT NULL;")"
  if [ "$present" != "t" ]; then
    echo "verify-backup: FAILED — required table '$t' is missing from the restore." >&2
    exit 1
  fi
done

echo "verify-backup: OK — $DUMP restores cleanly ($tables tables, required tables present)."
