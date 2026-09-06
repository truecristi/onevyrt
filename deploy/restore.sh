#!/usr/bin/env bash
#
# Restore a gzipped pg_dump produced by deploy/backup.sh — run ON the server.
# DESTRUCTIVE: it overwrites the target database, so it refuses to run without
# an explicit CONFIRM=yes. Use it for the periodic restore drill (restore into a
# scratch database to prove the backups actually work) and for real recovery.
#
# Usage:
#   CONFIRM=yes ./deploy/restore.sh /var/backups/onevyrt/onevyrt-<ts>.sql.gz
#
# Restore-drill (safe — into a throwaway DB, not production):
#   CONFIRM=yes DATABASE_URL="postgres://.../onevyrt_restore_test" \
#     ./deploy/restore.sh /var/backups/onevyrt/onevyrt-<ts>.sql.gz
#
# DATABASE_URL is read from the environment, or from ENV_FILE if not set.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/onevyrt/web.env}"
DUMP="${1:-}"

if [ -z "$DUMP" ]; then
  echo "usage: CONFIRM=yes ./deploy/restore.sh <backup.sql.gz>" >&2
  exit 2
fi
if [ ! -f "$DUMP" ]; then
  echo "restore: no such file: $DUMP" >&2
  exit 2
fi
if [ "${CONFIRM:-}" != "yes" ]; then
  echo "restore: refusing without CONFIRM=yes — this OVERWRITES the target database ($DUMP)" >&2
  exit 3
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
  fi
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "restore: DATABASE_URL not set and not found in $ENV_FILE" >&2
  exit 1
fi

command -v psql >/dev/null 2>&1 || { echo "restore: psql not installed" >&2; exit 1; }

# libpq/psql reject sslmode=no-verify (which node-postgres accepts); require is
# the equivalent. Translate it so the app's DATABASE_URL works here too.
DATABASE_URL="${DATABASE_URL/sslmode=no-verify/sslmode=require}"

# Fail fast on a corrupt archive before touching the database.
gzip -t "$DUMP"

echo "restore: restoring $DUMP into the target database ..."
gzip -dc "$DUMP" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
echo "restore: complete."
