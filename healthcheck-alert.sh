#!/usr/bin/env bash
# Downtime alerting for the OneVYRT container. Docker's --restart
# unless-stopped already handles crash-restarts; the gap this closes is
# *knowing* it happened. Meant to run every few minutes via cron. Sends at
# most one "down" email per outage (a state file tracks consecutive
# failures) and one "recovered" email when it comes back, instead of
# spamming an inbox every run while something stays broken.
set -euo pipefail

ENV_FILE=/etc/onevyrt/web.env
STATE_DIR=/opt/onevyrt-backups
STATE_FILE="$STATE_DIR/.health-fail-count"
URL=http://127.0.0.1:8515/
ALERT_THRESHOLD=2 # consecutive failed checks before alerting

[ -f "$ENV_FILE" ] || exit 0
# Read as plain KEY=VALUE pairs rather than `source`ing the file — it's a
# config file, not a script, and values like SMTP_FROM_NAME contain
# unquoted spaces that `source` would misparse as separate commands.
while IFS='=' read -r key val; do
  case "$key" in ''|'#'*) continue ;; esac
  export "$key=$val"
done < "$ENV_FILE"
[ -n "${SMTP_HOST:-}" ] || exit 0 # no mail configured, nothing to alert with

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

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL" || echo "000")
ok=false
case "$code" in 200|301|302|307|308) ok=true ;; esac

prev_fail=0
[ -f "$STATE_FILE" ] && prev_fail=$(cat "$STATE_FILE")

if $ok; then
  if [ "$prev_fail" -ge "$ALERT_THRESHOLD" ]; then
    send_mail "OneVYRT is back up" "The app at $URL is responding again (HTTP $code) after $prev_fail failed checks."
  fi
  echo 0 > "$STATE_FILE"
  exit 0
fi

fail=$((prev_fail + 1))
echo "$fail" > "$STATE_FILE"
if [ "$fail" -eq "$ALERT_THRESHOLD" ]; then
  send_mail "OneVYRT is down" "The app at $URL has failed $fail consecutive health checks (last status: $code). Docker will keep trying to restart it; this email won't repeat until it recovers."
fi
