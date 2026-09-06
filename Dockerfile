# OneVYRT / TheGearBox — production image for apps/web (Next.js 16 + pnpm monorepo).
# Data (users, workspaces, projects) lives under a mounted volume via ONEVYRT_ROOT.

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
RUN pnpm --filter web build

# ---- runtime ----
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Persist all app data outside the image. The volume makes /data exist, so
# projectRoot() resolves here (ONEVYRT_ROOT beats the workspace-marker walk).
ENV ONEVYRT_ROOT=/data
COPY --from=build /app ./
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
