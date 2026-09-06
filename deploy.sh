#!/usr/bin/env bash
# OneVYRT server-side deploy: pull latest from git, build image, (re)create
# container on the app's port with a persistent data volume. Idempotent —
# safe to re-run for redeploys. Run this from the git checkout (/opt/onevyrt-src).
set -euo pipefail

IMAGE=onevyrt:latest
NAME=onevyrt-app
# Must match the Cloudflare Tunnel's ingress rule for onevyrt.masteryresearch.com
# (http://localhost:8515) — this is NOT the app's internal port (always 3000
# inside the container), it's the host-side port the tunnel dials.
PORT=8515

echo "==> Pulling latest"
git pull --ff-only

echo "==> Building image ($IMAGE)"
docker build -t "$IMAGE" .

echo "==> Ensuring data volume"
docker volume create onevyrt-data >/dev/null

echo "==> Replacing container ($NAME)"
docker rm -f "$NAME" >/dev/null 2>&1 || true
# Secrets (SMTP creds, ADMIN_EMAILS) live outside the repo at /etc/onevyrt/web.env
# and are never baked into the image — passed in at container start instead.
ENV_FILE=/etc/onevyrt/web.env
ENV_ARGS=()
[ -f "$ENV_FILE" ] && ENV_ARGS=(--env-file "$ENV_FILE")
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p 127.0.0.1:${PORT}:3000 \
  -v onevyrt-data:/data \
  "${ENV_ARGS[@]}" \
  "$IMAGE"

echo "==> Waiting for health"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || true)
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "302" ] || [ "$code" = "308" ]; then
    echo "OK: HTTP $code from http://127.0.0.1:${PORT}/"
    break
  fi
  sleep 2
  if [ "$i" = "30" ]; then
    echo "WARN: no healthy response yet (last code: $code). Recent logs:"
    docker logs --tail 40 "$NAME" || true
  fi
done

echo "==> Container status"
docker ps --filter "name=${NAME}" --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'

# Reclaim disk after the build. Every deploy does a fresh `docker build`,
# and without this the layer cache + dangling images grow unbounded — that's
# what took the host to 75% full (33GB of build cache) once before. Cap the
# build cache and drop images no container references. Kept AFTER the health
# check so a failed deploy still leaves the old cache intact to retry from.
echo "==> Reclaiming disk (build cache + dangling images)"
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --keep-storage=3GB >/dev/null 2>&1 || true
df -h / | awk 'NR==1 || /\/$/'
