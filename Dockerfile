# ONEVYRT (ov1) — production image for apps/web (Next.js 16 + pnpm monorepo).
# Runs as container `ov1-app` on port 8516, behind the Cloudflare tunnel that
# routes ov1.masteryresearch.com -> 8516. Uses Supabase as Postgres (via
# DATABASE_URL); non-Postgres app data persists under ONEVYRT_ROOT (/data).
# Build:  docker build -t ov1:latest .
# Run:    docker run -d --name ov1-app --restart unless-stopped \
#           -p 8516:8516 --env-file /etc/onevyrt/ov1.env ov1:latest

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---- deps + build ----
FROM base AS build
WORKDIR /app
# Copy just the manifests first so the install layer caches across source edits.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/engine/package.json ./packages/engine/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
# Build the deterministic engine first (Node consumers resolve its dist/), then
# the web app (Next transpiles the engine from source via transpilePackages).
RUN pnpm --filter @onevyrt/engine build
RUN pnpm --filter web build

# ---- runtime ----
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Persist non-Postgres app data outside the image. The volume makes /data
# exist, so projectRoot() resolves here (ONEVYRT_ROOT beats the marker walk).
ENV ONEVYRT_ROOT=/data
ENV PORT=8516
COPY --from=build /app ./
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8516
# Migrate (with the app's TLS posture) then serve on $PORT.
ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]
