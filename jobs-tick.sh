#!/usr/bin/env bash
# Fires the jobs engine (see apps/web/lib/jobs.ts, apps/web/app/api/cron/tick).
# The route itself gates each individual job by its own interval (see
# job_runs), so this can run more often than any single job actually needs
# to — that's cheap, a no-op response when nothing's due. Meant to run every
# few minutes via systemd timer (see onevyrt-jobs-tick.timer), the same
# pattern as healthcheck-alert.sh/error-alert.sh.
set -euo pipefail

ENV_FILE=/etc/onevyrt/web.env
URL=http://127.0.0.1:8515/api/cron/tick

[ -f "$ENV_FILE" ] || exit 0
while IFS='=' read -r key val; do
  case "$key" in ''|'#'*) continue ;; esac
  export "$key=$val"
done < "$ENV_FILE"
[ -n "${CRON_SECRET:-}" ] || exit 0 # not configured — nothing to do

curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$URL" > /dev/null
