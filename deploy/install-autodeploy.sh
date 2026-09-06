#!/usr/bin/env bash
#
# One-shot installer for the free auto-deployer — run ONCE on the server (a
# cPanel "Terminal", an SSH session, or any shell on the box). It does every
# step of deploy/AUTODEPLOY.md for you and then deploys the current master
# immediately, so after this single command:
#
#   • whatever is on origin/master goes live now, and
#   • every future push/merge to master goes live within ~3 minutes, for free
#     (no GitHub Actions, no billing).
#
# It auto-detects systemd (preferred) and falls back to a cron entry when
# systemd isn't available or isn't reachable (e.g. an unprivileged shell).
# Idempotent: safe to re-run.
#
# Usage (defaults shown — override by exporting before running):
#   SRC_DIR=/opt/onevyrt-src ENV_FILE=/etc/onevyrt/web.env BRANCH=master \
#   bash deploy/install-autodeploy.sh
#
set -euo pipefail

SRC_DIR="${SRC_DIR:-/opt/onevyrt-src}"
ENV_FILE="${ENV_FILE:-/etc/onevyrt/web.env}"
BRANCH="${BRANCH:-master}"

log()  { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$SRC_DIR/.git" ] || die "No git checkout at $SRC_DIR (set SRC_DIR to your checkout)."
[ -f "$ENV_FILE" ]     || warn "Env file $ENV_FILE not found yet — deploy.sh will need it to migrate/run."

cd "$SRC_DIR"
log "Making the poller + deploy scripts executable"
chmod +x deploy/auto-deploy.sh deploy/deploy.sh 2>/dev/null || true

# Does this box actually have a usable systemd? (Both the binary AND a running
# init — a container/shared shell can have the binary but no /run/systemd.)
have_systemd() { command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; }
# Can we act as root (needed to write /etc/systemd and talk to docker)?
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else warn "Not root and no sudo — will try cron in your own crontab."; fi
fi

installed_via=""
if have_systemd && { [ "$(id -u)" -eq 0 ] || [ -n "$SUDO" ]; }; then
  log "Installing the systemd timer (fires every 3 minutes)"
  $SUDO cp deploy/onevyrt-autodeploy.service deploy/onevyrt-autodeploy.timer /etc/systemd/system/
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable --now onevyrt-autodeploy.timer
  installed_via="systemd"
  $SUDO systemctl list-timers onevyrt-autodeploy.timer --no-pager || true
else
  log "systemd not usable here — installing a cron entry instead (every 3 minutes)"
  command -v crontab >/dev/null 2>&1 || die "Neither systemd nor crontab is available; run deploy/auto-deploy.sh from your own scheduler."
  CRON_LINE="*/3 * * * * SRC_DIR=$SRC_DIR ENV_FILE=$ENV_FILE BRANCH=$BRANCH /usr/bin/env bash $SRC_DIR/deploy/auto-deploy.sh >> /var/log/onevyrt-autodeploy.log 2>&1"
  # Replace any prior onevyrt-autodeploy cron line, then add the fresh one.
  ( crontab -l 2>/dev/null | grep -v 'deploy/auto-deploy.sh' ; echo "$CRON_LINE" ) | crontab -
  installed_via="cron"
  crontab -l 2>/dev/null | grep 'deploy/auto-deploy.sh' || true
fi

log "Deploying the current $BRANCH right now (first run)"
if SRC_DIR="$SRC_DIR" ENV_FILE="$ENV_FILE" BRANCH="$BRANCH" bash deploy/auto-deploy.sh; then
  log "Auto-deploy installed via $installed_via, and $BRANCH is live."
  echo "From now on, every merge to $BRANCH goes live within ~3 minutes — no SSH, no Actions."
  log "Verifying the new version is serving"
  SRC_DIR="$SRC_DIR" BRANCH="$BRANCH" bash deploy/healthcheck.sh || warn "Health check did not pass — see the hint above."
else
  die "Installed the scheduler ($installed_via), but the first deploy failed. Check the output above (usually a missing $ENV_FILE or Docker not running), fix it, then re-run: bash deploy/auto-deploy.sh"
fi
