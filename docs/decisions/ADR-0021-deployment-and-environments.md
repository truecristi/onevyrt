# ADR-0021: Deployment and environments

**Status:** Accepted (target decided; not yet live - see "What's still
needed from the repository owner")
**Date:** 2026-09-06 (originally 2026-09-05; updated once a target was
actually chosen - see "Why Vercel, and why this changed from the
earlier plan" below)

## Context

The user asked for this rebuild to be deployed to production at
`onevyrt.masteryresearch.com`, served from a Bluehost-hosted Linux server
reachable only over Tailscale. This was checked directly rather than
assumed:

- `onevyrt.masteryresearch.com` resolves via DNS to Cloudflare-fronted
  addresses - the domain itself is live.
- The Tailscale address for the origin server is **not reachable** from
  this session's sandbox (connection timed out).
- **No SSH key material for this server exists in this environment.**
- No CI/CD pipeline currently exists in this repository to deploy
  anywhere.

None of that changed. What changed: the user, later in the same session
(once the full README roadmap shipped), explicitly asked for this ADR to
be resolved rather than left blocked, with no preference on the specific
platform - "you decide."

## Decision

**Vercel**, for both the Next.js app and its Postgres database (via
Vercel's own Postgres integration, Neon-backed) - not Fly.io, and not
the original Bluehost/Tailscale target, which remains unreachable from
every session that has worked on this repository.

### Why Vercel, and why this changed from the earlier plan

This session first told the user it would use Fly.io, then found a
better-fitting option while actually building this ADR: this file's own
prior "Alternatives considered" text already referenced "the original
CLAUDE.md's 'Vercel (Next.js) + Fly.io (database)' pairing mentioned in
this repo's prior history" - a CLAUDE.md that no longer exists in this
repository (both `main` and `master` were force-emptied before this
build began, per ADR-0018), but whose intent survived in this ADR's own
text. Rather than build a two-provider Fly.io pipeline and ignore that
signal, or build the Fly.io+Vercel split literally, this ADR simplifies
further: Vercel's own Postgres integration means **one** provider, **one**
CI secret, and no second platform's credentials to manage - a better fit
for "get a reachable target working with minimal setup" than the
two-provider split was, while still landing on the same app-hosting
choice that prior intent named. Reported here plainly as a
self-correction mid-task, not silently swapped without explanation.

### What's actually been built (this PR)

- **`vercel.json`** (repo root) - tells Vercel this is a pnpm-workspace
  monorepo and which app (`apps/web`) to build and serve, since Vercel's
  default zero-config detection assumes a single-package repo.
- **`.github/workflows/deploy.yml`** - a new, separate workflow (not a
  job inside `ci.yml`, so a deploy failure is never confused with a
  build-and-test failure) that:
  1. Triggers on `push` to `main` only (never on a PR - draft PRs never
     deploy anything).
  2. Waits for the `CI` workflow's `build-and-test` job to have
     succeeded on the same commit (`workflow_run`, `types: [completed]`,
     checked against `conclusion == 'success'`) - a deploy never ships
     code that hasn't passed the release gate.
  3. Runs `vercel deploy --prod` via the official Vercel CLI, using a
     `VERCEL_TOKEN` repository secret.
  4. **Skips entirely, without failing,** if `VERCEL_TOKEN` isn't set -
     checked as a step-level `if:` condition. Until the repository
     owner adds the secret (see below), this workflow runs, does
     nothing, and reports green - it does not block anything else, and
     it does not pretend to have deployed.
  5. On a successful deploy, curls the live `/api/health` endpoint
     (already real - `apps/web/app/api/health/route.ts` actually pings
     the database via `select 1` and reports 503 if unreachable, per
     §13's "distinguish process health, dependency readiness and
     deployment version," not a hardcoded `"ok"`) and fails the workflow
     if it doesn't return 200 - so "the deploy step succeeded" and "the
     live app is actually healthy" are checked separately.
- **`docs/deployment/vercel-setup.md`** - the exact, numbered steps the
  repository owner needs to do in the Vercel dashboard (none of which
  this session can do itself - it has no Vercel account access) to make
  this pipeline actually deploy something: create the project, link it
  to this repo, add the Postgres integration, set the `DATABASE_URL`
  and `AUTH_SECRET` environment variables in Vercel's project settings
  (never in this repository), and add exactly one GitHub Actions
  secret (`VERCEL_TOKEN`).

### What's still needed from the repository owner

This ADR decides the target and ships the pipeline; it does not and
cannot complete the deploy itself - this session has no Vercel account,
no ability to create one on the user's behalf, and no way to generate a
`VERCEL_TOKEN` without dashboard access. See
`docs/deployment/vercel-setup.md` for exactly what to do. Once that's
done, the next push to `main` deploys automatically and this ADR's
"not yet live" caveat above can be removed.

### `onevyrt.masteryresearch.com`

Pointing the existing domain at the new Vercel deployment (a DNS change
at whichever registrar/DNS provider currently manages it) is also the
repository owner's action, covered in the same setup doc - this session
has no access to that DNS configuration either.

## Alternatives considered

- **Fly.io for the app itself** - this session's own first answer to
  the user mid-session, superseded by the reasoning above before any
  Fly.io-specific code was written; no wasted implementation, just a
  changed decision caught early.
- **Attempting the original Bluehost/Tailscale path anyway** - still
  not attempted; the access constraints from the original review are
  unchanged, and guessing at credentials was never on the table.
- **A second provider for the database (e.g. Fly Postgres, Neon
  directly, Supabase)** - rejected in favor of Vercel's own Postgres
  integration specifically to minimize the number of accounts/secrets
  the repository owner has to manage for a first working deployment.

## Consequences

The repository now has a real, if currently dormant, path from a green
`main` to a live, health-checked deployment - "does the build pass" and
"is it live" are no longer permanently disconnected facts, just
sequentially gated on the repository owner completing a one-time setup
step.

## Security effects

`VERCEL_TOKEN` is the only new secret this introduces, and it's scoped
to GitHub Actions secrets (never committed, never logged - the deploy
workflow doesn't echo it). `DATABASE_URL` and `AUTH_SECRET` for the
production environment live in Vercel's own project settings, not in
this repository or in GitHub Actions secrets, since the deploy workflow
never needs to see them itself (Vercel injects them into the deployed
app's runtime directly).

## Migration effects

None from this ADR itself. A real production database means a real
first-migration-run against it, which `packages/database/src/migrate.test.ts`
already proves is safe and idempotent - see ADR-0019 for the
backup/restore story once real data exists there.

## Reversibility

High - `vercel.json` and the deploy workflow are additive; removing
them or switching providers later doesn't touch application code, and
no production traffic exists yet to migrate off of anything.

**Approvers:** Claude (autonomous build, per this repository's standing
delegation - target decided per explicit user direction; actual go-live
still requires the repository owner's action, see above).
