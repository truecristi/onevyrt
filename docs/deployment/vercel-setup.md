# Vercel deployment setup (one-time, repository owner only)

Per ADR-0021. `.github/workflows/deploy.yml` already exists and runs on
every push to `main` after CI passes - but it does nothing until you
complete the steps below, because this session has no Vercel account
and cannot do any of them itself. Until then, the workflow runs, skips
its own steps, and reports green - it never fails just because these
steps aren't done yet, and it never pretends to have deployed anything.

## 1. Create the Vercel project

1. Sign in to [vercel.com](https://vercel.com) (or create an account)
   and click **Add New → Project**.
2. Import `truecristi/onevyrt` from GitHub (Vercel will ask to install
   its GitHub App on the repository if it isn't already).
3. On the import screen, set:
   - **Root Directory**: `apps/web` - this is a pnpm workspace monorepo,
     and Vercel needs to know which app to build and serve. Vercel
     detects the pnpm workspace automatically from the repo root once
     this is set and runs `pnpm install` there before building.
   - **Framework Preset**: Next.js (should auto-detect once Root
     Directory is set).
   - Leave Build/Install/Output commands on their defaults - the
     repository doesn't need overrides for this.
4. Click **Deploy**. This first deploy will fail (no `DATABASE_URL` or
   `AUTH_SECRET` yet) - that's expected; continue to step 2 before
   retrying.

## 2. Add the Postgres integration

1. In the new project's dashboard, go to **Storage → Create Database →
   Postgres** (Vercel's own Postgres offering, Neon-backed).
2. Once created, Vercel automatically adds a `DATABASE_URL` (or
   `POSTGRES_URL` - see step 3) environment variable to the project for
   you. No manual connection-string copying needed.
3. Check the exact variable name Vercel created (`POSTGRES_URL` vs.
   `DATABASE_URL`) under **Settings → Environment Variables** - if it's
   `POSTGRES_URL`, add a second variable named `DATABASE_URL` with the
   same value (or an alias), since that's the name every package in
   this repository actually reads (`packages/database/src/connection.ts`,
   `packages/contracts/src/env.ts`).

## 3. Set the remaining required environment variables

Under **Settings → Environment Variables**, for the **Production**
environment:

| Variable       | Value                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | From step 2 above.                                                                                                                                            |
| `AUTH_SECRET`  | Generate a real random 32+ byte secret (`openssl rand -hex 32`) - never reuse the CI placeholder (`0000...0000` in `.github/workflows/ci.yml`) in production. |
| `APP_URL`      | The production URL Vercel assigns the project (or `https://onevyrt.masteryresearch.com` once DNS is pointed there - see step 5).                              |

Never add these to this repository's `.env.example` with real values,
and never paste real values into a GitHub Actions secret either - they
belong only in Vercel's own environment variable store, which is why
`deploy.yml` never needs to see them.

## 4. Run migrations against the new database

Before the first real deploy serves traffic, run migrations once
against the new production database from your own machine (this
session cannot reach it):

```
DATABASE_URL="<the same value from step 2>" pnpm --filter @onevyrt/database migrate
```

`packages/database/src/migrate.test.ts` already proves every migration
applies cleanly in order and a second run is a safe no-op, so re-running
this after future migrations is always safe.

## 5. Point `onevyrt.masteryresearch.com` at Vercel (optional, whenever you're ready)

1. In the Vercel project, go to **Settings → Domains** and add
   `onevyrt.masteryresearch.com`.
2. Vercel will show the exact DNS record (usually a `CNAME` or `A`
   record) to add at whichever provider currently manages that domain's
   DNS (per ADR-0021, this session has no access to that DNS
   configuration to check or change it).
3. Update `APP_URL` in step 3 above to match once this is live.

## 6. Add the one GitHub Actions secret

1. In the Vercel project, go to **Settings → General** and note the
   **Project ID** and, from your account/team settings, the
   **Organization/Team ID**.
2. Create a Vercel access token: **Account Settings → Tokens → Create**.
3. In this GitHub repository: **Settings → Secrets and variables →
   Actions**, add:
   - `VERCEL_TOKEN` - the token from step 2.

   `deploy.yml`'s `vercel pull`/`vercel build`/`vercel deploy` steps
   read the project/org linkage from the token's own scope and from
   `.vercel/project.json` that `vercel pull` creates at deploy time -
   no separate `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets are needed
   as long as the token is scoped to the right project (the default
   when created from within the project's own settings page).

## Once all of the above is done

The next push to `main` (after this PR itself merges) triggers
`deploy.yml`, which will actually deploy and then verify
`/api/health` returns `200` on the live URL. If it doesn't, the
workflow fails loudly rather than silently reporting success - check
the workflow's logs and the health endpoint's JSON body (process/
database status) for what's wrong.
