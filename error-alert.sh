#!/usr/bin/env bash
# Application-error alerting. logger.ts already writes every server-side
# exception and client-render crash to /data/.gearbox/logs/app.log inside the
# container (and to `docker logs`), but nothing ever looks at it proactively —
# unlike downtime (see healthcheck-alert.sh), a spike in errors on an
# otherwise-"up" app would go unnoticed until a user complained. Meant to run
# every few minutes via cron/systemd timer.
set -euo pipefail

ENV_FILE=/etc/onevyrt/web.env
STATE_DIR=/opt/onevyrt-backups
STATE_FILE="$STATE_DIR/.error-alert-line-count"
CONTAINER=onevyrt-app
LOG_PATH=/data/.gearbox/logs/app.log
ALERT_THRESHOLD=1 # new error-level lines since last check before we email

[ -f "$ENV_FILE" ] || exit 0
while IFS='=' read -r key val; do
  case "$key" in ''|'#'*) continue ;; esac
  export "$key=$val"
done < "$ENV_FILE"
[ -n "${SMTP_HOST:-}" ] || exit 0

mkdir -p "$STATE_DIR"

send_mail() {
  local subject="$1" body="$2"
  local rcpt_args=()
  IFS=',' read -ra rcpts <<< "${ADMIN_EMAILS// /}"
  for r in "${rcpts[@]}"; do [ -n "$r" ] && rcpt_args+=(--mail-rcpt "$r"); done
  [ "${#rcpt_args[@]}" -eq 0 ] && return 0
  curl -s --max-time 20 \
    --url "smtps://${SMTP_HOST}:${SMTP_PORT:-465}" \
    --mail-from "${SMTP_FROM_EMAIL}" \
    "${rcpt_args[@]}" \
    --user "${SMTP_USERNAME}:${SMTP_PASSWORD}" \
    --upload-file - <<EOF || true
From: ${SMTP_FROM_NAME:-OneVYRT} <${SMTP_FROM_EMAIL}>
To: ${ADMIN_EMAILS}
Subject: ${subject}

${body}
EOF
}

# Best-effort: if the container isn't running or the log doesn't exist yet,
# there's nothing to scan (downtime itself is healthcheck-alert.sh's job).
total_lines=$(docker exec "$CONTAINER" sh -c "wc -l < '$LOG_PATH' 2>/dev/null || echo 0")
prev_lines=0
[ -f "$STATE_FILE" ] && prev_lines=$(cat "$STATE_FILE")

if [ "$total_lines" -lt "$prev_lines" ]; then
  # Log rotated/truncated since last check — reset rather than underflow.
  prev_lines=0
fi

new_line_count=$((total_lines - prev_lines))
echo "$total_lines" > "$STATE_FILE"
[ "$new_line_count" -le 0 ] && exit 0

new_errors=$(docker exec "$CONTAINER" sh -c "tail -n +$((prev_lines + 1)) '$LOG_PATH' 2>/dev/null | grep -c '\"level\":\"error\"'" || echo 0)
[ "$new_errors" -lt "$ALERT_THRESHOLD" ] && exit 0

sample=$(docker exec "$CONTAINER" sh -c "tail -n +$((prev_lines + 1)) '$LOG_PATH' 2>/dev/null | grep '\"level\":\"error\"' | tail -n 5")
send_mail "OneVYRT: $new_errors new error(s) logged" "$new_errors error-level log entries since the last check. Most recent (up to 5):

$sample"
