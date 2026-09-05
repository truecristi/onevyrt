# ADR-0021: Deployment and environments

**Status:** Proposed - blocked on access this AI session does not have
**Date:** 2026-09-05

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

## Decision

Phase 0/1 ships no deployment automation and makes no attempt to reach the
production server. There is also, honestly, nothing to deploy yet - Phase
1's output is a monorepo scaffold and an auth/workspace vertical slice,
not the product experience the domain is meant to serve.

To actually deploy this repository to `onevyrt.masteryresearch.com` later,
one of the following needs to happen (a human decision, not something an
AI session should do unprompted per §34: "no developer or AI agent may
silently resolve a contradiction affecting ... irreversible data
changes"):

1. **SSH-based deploy from GitHub Actions**: add the server's SSH private
   key as a GitHub Actions repository secret (e.g. `DEPLOY_SSH_KEY`), plus
   the Tailscale auth key needed for the Actions runner to join the
   tailnet (Tailscale's official `tailscale/github-action`), then add a
   deploy job to `.github/workflows/ci.yml` (or a separate
   `deploy.yml`) gated on `main` and on the release-gate checks passing.
2. **A human with tailnet + SSH access runs the deploy manually** (or via
   a script in `tooling/`) from a machine that's actually on the tailnet -
   this AI session cannot verify or execute that path itself.
3. **Move off Bluehost/Tailscale to a host reachable via public
   deploy credentials** (e.g. Vercel + a managed Postgres, matching the
   original CLAUDE.md's "Vercel (Next.js) + Fly.io (database)" pairing
   mentioned in this repo's prior history) - a bigger decision than this
   ADR should make unilaterally.

No option above is exercised by this change. This ADR exists so the gap is
recorded rather than silently absent.

## Alternatives considered

Attempting the SSH connection anyway with fabricated or guessed
credentials - not attempted; there is nothing to guess, and doing so would
misrepresent what did or didn't happen in the PR/commit history.

## Consequences

The repository's README and CI (§44) can enforce "does the build pass,"
but "is it live" remains a manually-tracked fact until one of the three
options above is chosen and implemented.

## Security effects

None from this decision itself (nothing was deployed). Whichever option is
chosen later inherits §11's secret-handling rules (no secrets in client
bundles, logs or this repository's tracked files).

## Migration effects

None.

## Reversibility

N/A - no infrastructure was created or changed.

**Approvers:** (pending human decision on which deployment path to take)
