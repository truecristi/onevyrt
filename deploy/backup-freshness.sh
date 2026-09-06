#!/usr/bin/env bash
#
# Backup freshness alarm. backup.sh makes dumps and verify-backup.sh proves they
# restore — but if the backup CRON silently stops (disk full, bad env, someone
# removed the crontab line), both go quiet and you don't notice until a real
# recovery finds nothing recent. This is the smoke detector: it exits non-zero
# and loudly when the newest backup is older than MAX_AGE_HOURS, or missing
# entirely, so a cron wrapper (or the health mailer) alerts on it.
#
# Usage:
#   BACKUP_DIR=/var/backups/onevyrt MAX_AGE_HOURS=26 ./deploy/backup-freshness.sh
#
# MAX_AGE_HOURS defaults to 26 — a hair over a day, so a daily backup that runs a
# little late never trips a false alarm. Tune to your backup cadence.
#
# Cron example (hourly; only prints/exits non-zero when something's wrong, so a
# MAILTO crontab emails you only on a real problem):
#   17 * * * * /opt/onevyrt-src/deploy/backup-freshness.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/onevyrt}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "backup-freshness: ALARM — backup directory $BACKUP_DIR does not exist." >&2
  exit 1
fi

# Newest backup by modification time.
# shellcheck disable=SC2012
newest="$(ls -1t "$BACKUP_DIR"/onevyrt-*.sql.gz 2>/dev/null | head -1 || true)"
if [ -z "$newest" ]; then
  echo "backup-freshness: ALARM — no backups found in $BACKUP_DIR." >&2
  exit 1
fi

now="$(date -u +%s)"
mtime="$(date -u -r "$newest" +%s 2>/dev/null || stat -c %Y "$newest" 2>/dev/null || echo 0)"
if [ "$mtime" -eq 0 ]; then
  echo "backup-freshness: ALARM — could not read the age of $newest." >&2
  exit 1
fi

age_secs=$(( now - mtime ))
age_hours=$(( age_secs / 3600 ))
max_secs=$(( MAX_AGE_HOURS * 3600 ))

if [ "$age_secs" -gt "$max_secs" ]; then
  echo "backup-freshness: ALARM — newest backup is ${age_hours}h old (limit ${MAX_AGE_HOURS}h): $newest" >&2
  echo "  The backup job may have stopped. Check the backup cron/timer and $BACKUP_DIR." >&2
  exit 1
fi

# An empty file that slipped past backup.sh's own guard is still a dead backup.
if [ ! -s "$newest" ]; then
  echo "backup-freshness: ALARM — newest backup is empty: $newest" >&2
  exit 1
fi

echo "backup-freshness: OK — newest backup is ${age_hours}h old (limit ${MAX_AGE_HOURS}h): $newest"
