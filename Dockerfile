# syntax=docker/dockerfile:1

# ov1-app: the OneVYRT (OV1) deployment.
#
# This is a SEPARATE application from the existing onevyrt-app
# (image onevyrt:latest on port 8515) - it uses its own image name
# (ov1:latest), container name (ov1-app), host port (127.0.0.1:8516) and
# env file (/etc/onevyrt/ov1.env). Building or running it does not touch
# any existing container, image, volume or port.
#
# It builds the pnpm monorepo and serves apps/web. Configuration is
# injected at run time via `docker run --env-file`; no secrets are ever
# copied into the image (see .dockerignore, which excludes all .env files).

FROM node:22-slim

# ca-certificates: TLS to the (SSL-required) Postgres/Supabase database.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

# Copy the whole repo (minus .dockerignore excludes) and install against the
# committed lockfile for a deterministic build. Dev dependencies are needed:
# `tsx` runs the migration script at container start.
COPY . .
RUN pnpm install --frozen-lockfile

# Build apps/web (the root "build" script). Next transpiles the workspace
# packages from source, so no separate package build step is required.
RUN pnpm build

# Runtime configuration. NODE_ENV is set here (after install/build) so the
# production server runs correctly; PORT/DATABASE_URL/AUTH_SECRET/APP_URL
# come from --env-file at run time.
ENV NODE_ENV=production
# The container listens on $PORT (default 3000); the host maps
# 127.0.0.1:8516 -> 3000.
EXPOSE 3000

COPY docker/ov1-entrypoint.sh /usr/local/bin/ov1-entrypoint.sh
RUN chmod +x /usr/local/bin/ov1-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/ov1-entrypoint.sh"]
