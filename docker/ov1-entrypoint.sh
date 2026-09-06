#!/bin/sh
set -e

# ov1-app container entrypoint.
#
# Applies forward-only database migrations, then starts the Next.js server.
# The migration runner (packages/database/src/migrate.ts) is idempotent -
# it records applied migrations and takes a session-level advisory lock, so
# repeated container starts and rolling restarts are safe.
#
# All configuration (DATABASE_URL, AUTH_SECRET, APP_URL, PORT) is read from
# the process environment, supplied at run time via `docker run --env-file`.
# Nothing secret is baked into the image.

echo "[ov1] applying database migrations..."
pnpm db:migrate

PORT="${PORT:-3000}"
echo "[ov1] starting Next.js on 0.0.0.0:${PORT} ..."
cd /app/apps/web
# Bind 0.0.0.0 so Docker's published port (127.0.0.1:8516 -> ${PORT}) reaches it.
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT}"
