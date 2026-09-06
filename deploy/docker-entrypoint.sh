#!/bin/sh
# ov1 container entrypoint: apply database migrations, then start Next.js.
#
# The app (container ov1-app) runs on ${PORT:-8516} and is fronted by the
# Cloudflare tunnel that routes ov1.masteryresearch.com -> 8516. Data other
# than Postgres lives under ONEVYRT_ROOT (/data volume).
set -e

cd /app/apps/web

# 1) Migrations — same TLS posture as the running app (see scripts/migrate-deploy.mjs).
node scripts/migrate-deploy.mjs

# 2) Serve.
PORT="${PORT:-8516}"
echo "[ov1] starting Next.js on 0.0.0.0:${PORT}"
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT}"
