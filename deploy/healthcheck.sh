#!/usr/bin/env bash
#
# Post-deploy health check — run ON the server to confirm the new version is
# actually serving. Three things, no auth needed:
#
#   1. the app answers /api/health?ready with ok:true and the DB up,
#   2. what commit is deployed (the checkout's HEAD) vs. origin/master, so you
#      can see the latest merge is live, and
#   3. process uptime (a low number = it just restarted for this deploy).
#
# Exit 0 only when the app is up AND the DB is reachable; non-zero otherwise,
# so it's usable from a monitor or another script.
#
# Usage (defaults shown):
#   SRC_DIR=/opt/onevyrt-src PORT=8515 ./deploy/healthcheck.sh
#
set -uo pipefail

SRC_DIR="${SRC_DIR:-/opt/onevyrt-src}"
PORT="${PORT:-8515}"
BRANCH="${BRANCH:-master}"
URL="http://127.0.0.1:${PORT}/api/health?ready"

ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
bad()  { printf '\033[1;31m✗ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }

# 1. Which commit is deployed, and is it the tip of master?
if [ -d "$SRC_DIR/.git" ]; then
  DEPLOYED="$(git -C "$SRC_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  git -C "$SRC_DIR" fetch --quiet origin "$BRANCH" 2>/dev/null || true
  REMOTE="$(git -C "$SRC_DIR" rev-parse --short "origin/$BRANCH" 2>/dev/null || echo unknown)"
  if [ "$DEPLOYED" = "$REMOTE" ]; then
    ok "Deployed commit $DEPLOYED is the tip of origin/$BRANCH (up to date)"
  else
    bad "Deployed commit $DEPLOYED is BEHIND origin/$BRANCH ($REMOTE) — a deploy is pending"
    info "The auto-deployer will pick it up within ~3 min, or run: bash deploy/auto-deploy.sh"
  fi
else
  info "No git checkout at $SRC_DIR — skipping the commit comparison"
fi

# 2. Is the app up and the DB reachable?
BODY="$(curl -s --max-time 10 -w '\n%{http_code}' "$URL" 2>/dev/null)"
CODE="$(printf '%s' "$BODY" | tail -1)"
JSON="$(printf '%s' "$BODY" | sed '$d')"

if [ "$CODE" = "200" ] && printf '%s' "$JSON" | grep -q '"ok":true'; then
  ok "App is serving on :$PORT — $JSON"
  # A fresh container just restarted for the deploy; surface uptime from the
  # liveness view (the readiness body above omits it).
  LIVE="$(curl -s --max-time 10 "http://127.0.0.1:${PORT}/api/health" 2>/dev/null)"
  UP="$(printf '%s' "$LIVE" | sed -n 's/.*"uptimeSec":\([0-9]*\).*/\1/p')"
  [ -n "$UP" ] && info "Process uptime: ${UP}s (a small number means it just deployed)"
  exit 0
else
  bad "Health check FAILED (HTTP ${CODE:-none}) — ${JSON:-no response}"
  info "The app isn't serving or the DB is down. Check: docker logs onevyrt-app --tail 50"
  exit 1
fi
