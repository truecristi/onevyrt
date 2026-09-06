#!/usr/bin/env bash
#
# Free continuous deploy — NO GitHub Actions, no billing. Runs ON the server
# (from cron or the systemd timer in this folder). Each tick it fetches
# origin/master and, only when the tip has moved since the last successful
# deploy, hands off to deploy/deploy.sh (which migrates, rebuilds, swaps the
# container, health-checks, and rolls back on failure).
#
# It records the last successfully-deployed commit in a marker file, so a run
# that leaves master unchanged is a cheap no-op, and a failed deploy is retried
# on the next tick (the marker only advances on success).
#
# Usage (defaults shown):
#   SRC_DIR=/opt/onevyrt-src ENV_FILE=/etc/onevyrt/web.env \
#   ./deploy/auto-deploy.sh
#
set -euo pipefail

SRC_DIR="${SRC_DIR:-/opt/onevyrt-src}"
ENV_FILE="${ENV_FILE:-/etc/onevyrt/web.env}"
BRANCH="${BRANCH:-master}"
MARKER="${MARKER:-$SRC_DIR/.last-deployed-sha}"

ts() { date -u +%FT%TZ; }

[ -d "$SRC_DIR/.git" ] || { echo "$(ts) auto-deploy: no git checkout at $SRC_DIR" >&2; exit 1; }
cd "$SRC_DIR"

# Fetch quietly; a transient network blip should not crash the timer.
git fetch --quiet origin "$BRANCH" || { echo "$(ts) auto-deploy: fetch failed, will retry" >&2; exit 0; }

REMOTE="$(git rev-parse "origin/$BRANCH")"
LAST="$(cat "$MARKER" 2>/dev/null || echo none)"

if [ "$REMOTE" = "$LAST" ]; then
  # Up to date — nothing to do.
  exit 0
fi

echo "$(ts) auto-deploy: new $BRANCH $REMOTE (last deployed: $LAST) — deploying"

# Pull the latest deploy script from the target ref first, so a fix to the
# deploy process itself ships with the commit that needs it.
git checkout "origin/$BRANCH" -- deploy/deploy.sh
chmod +x deploy/deploy.sh

if REF="origin/$BRANCH" SRC_DIR="$SRC_DIR" ENV_FILE="$ENV_FILE" bash deploy/deploy.sh; then
  echo "$REMOTE" > "$MARKER"
  echo "$(ts) auto-deploy: deployed $REMOTE"
else
  echo "$(ts) auto-deploy: deploy FAILED for $REMOTE — marker not advanced, retrying next tick" >&2
  exit 1
fi
