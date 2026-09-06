#!/usr/bin/env bash
#
# One-command production deploy, run ON the server (from the source checkout).
# Encodes the RUNBOOK steps atomically with a health check and automatic
# rollback, so a bad build or a failing container never leaves production down:
#
#   1. fetch + check out the target ref (records the current commit first)
#   2. run database migrations
#   3. build the Docker image
#   4. swap the running container
#   5. health-check; if it fails, roll the checkout + container back
#
# Idempotent and safe to re-run. Usage (defaults shown):
#   SRC_DIR=/opt/onevyrt-src \
#   ENV_FILE=/etc/onevyrt/web.env \
#   PORT=8515 CONTAINER=onevyrt-app IMAGE=onevyrt:latest REF=origin/master \
#   ./deploy/deploy.sh
#
# DATABASE_URL for migrations is read from ENV_FILE (the same file the
# container uses), so nothing extra is needed on the host.

set -euo pipefail

SRC_DIR="${SRC_DIR:-/opt/onevyrt-src}"
ENV_FILE="${ENV_FILE:-/etc/onevyrt/web.env}"
PORT="${PORT:-8515}"
CONTAINER="${CONTAINER:-onevyrt-app}"
IMAGE="${IMAGE:-onevyrt:latest}"
REF="${REF:-origin/master}"
DATA_VOLUME="${DATA_VOLUME:-onevyrt-data}"
HEALTH_URL="http://127.0.0.1:${PORT}/"
HEALTH_RETRIES="${HEALTH_RETRIES:-20}"

log() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$SRC_DIR/.git" ] || die "No git checkout at $SRC_DIR"
[ -f "$ENV_FILE" ] || die "Env file not found: $ENV_FILE"
cd "$SRC_DIR"

PREV_COMMIT="$(git rev-parse HEAD)"
log "Current commit (rollback target): $PREV_COMMIT"

start_container() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" --restart unless-stopped \
    -p "127.0.0.1:${PORT}:3000" -v "${DATA_VOLUME}:/data" \
    --env-file "$ENV_FILE" "$IMAGE" >/dev/null
}

health_ok() {
  for _ in $(seq 1 "$HEALTH_RETRIES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
    [ "$code" = "200" ] && return 0
    sleep 2
  done
  return 1
}

log "Fetching and checking out $REF"
git fetch --quiet origin
# $SRC_DIR is a pure automated-deploy checkout — nobody should ever be
# editing files in it by hand, so any local diff here is stray leftover
# state, never something worth preserving. Without this, a real incident
# (2026-09-05: a dirty pnpm-lock.yaml, cause never fully identified — the
# working tree just wasn't clean) makes `git checkout -B` refuse with
# "local changes... would be overwritten", and every subsequent tick
# fails the exact same way forever since nothing ever cleans it up.
# `reset --hard` clears tracked-file diffs; `clean -fd` clears untracked
# files (but not .gitignore'd ones — node_modules, the env file, etc. are
# left alone).
git reset --quiet --hard HEAD
git clean --quiet -fd
git checkout --quiet -B deploy-head "$REF"
NEW_COMMIT="$(git rev-parse HEAD)"
log "Deploying commit: $NEW_COMMIT"

log "Running database migrations"
# Read DATABASE_URL exactly the way `docker run --env-file` reads it: the raw
# value after the first `=`, no shell quoting or expansion. We deliberately do
# NOT `source` the whole env file — values that are valid for --env-file but not
# for the shell (e.g. ADMIN_EMAILS with a space, an unquoted URL) would abort
# the script under `set -e`, or quoting them for the shell would then be taken
# literally by --env-file and corrupt them. One format, one source of truth.
DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -1)"
[ -n "$DATABASE_URL" ] || die "DATABASE_URL not found in $ENV_FILE"
export DATABASE_URL
( cd apps/web && pnpm --filter web migrate:deploy )

log "Building Docker image"
docker build -t "$IMAGE" .

log "Swapping container"
start_container

log "Health check ($HEALTH_URL)"
if health_ok; then
  log "Healthy — deploy of $NEW_COMMIT complete."
  exit 0
fi

# ── Rollback ────────────────────────────────────────────────────────────────
printf '\n\033[1;31m✗ Health check failed — rolling back to %s\033[0m\n' "$PREV_COMMIT" >&2
git checkout --quiet -B deploy-head "$PREV_COMMIT"
docker build -t "$IMAGE" . || die "Rollback build failed — MANUAL INTERVENTION NEEDED"
start_container
if health_ok; then
  die "Deploy failed and was rolled back to $PREV_COMMIT (production is up on the old version)."
fi
die "Deploy failed AND rollback is unhealthy — MANUAL INTERVENTION NEEDED (see RUNBOOK)."
