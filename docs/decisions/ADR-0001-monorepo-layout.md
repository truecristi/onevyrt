# ADR-0001: Monorepo layout and package boundaries

**Status:** Accepted
**Date:** 2026-09-05

## Context

The specification (§10 in the deep-audit part, §36) and the repository's
own README both call for a pnpm-workspace monorepo separating the Next.js
app from a set of framework-agnostic packages, so business logic never
lives inside page components or route handlers.

## Decision

```
apps/
  web/          Next.js App Router UI + thin HTTP adapters (route handlers)
  worker/       background job runner (empty until Phase 2 needs a queue)
packages/
  ai/           model-neutral AI gateway (Phase 6)
  analytics/    product analytics taxonomy (Phase 7)
  auth/         password hashing, session tokens, workspace authorization policy
  content/      curriculum content schema (Phase 3)
  contracts/    Zod request/event schemas + env validation, shared by web and workers
  database/     Drizzle schema, migrations, connection/transaction helpers
  design-system/ design tokens + accessible UI primitives
  domain/       application use cases (registerUser, createWorkspace, ...) - owns transactions
  observability/ structured logging
  security/     CSRF double-submit tokens, in-memory rate limiter
  testing/      shared integration-test helpers (test DB URL, table truncation)
tests/
  e2e/          critical cross-module user journeys (empty until there's a UI to click through)
docs/
  decisions/    this ADR series
  parity/       legacy inventory + classification ledger
```

Each package exports raw TypeScript from `src/index.ts` (no build step of
its own); `apps/web` transpiles them via Next's `transpilePackages`, and
`vitest` runs them directly. A package only gets a `build` script once it
needs to ship a compiled artifact independent of `apps/web` (e.g. when
`apps/worker` becomes a real process).

`packages/domain` is the one place allowed to import both `@onevyrt/auth`
and `@onevyrt/database` and open a transaction (§37's consequential-command
lifecycle) - route handlers in `apps/web` call into `domain`, never `drizzle`
or `pg` directly.

## Alternatives considered

- **Single Next.js app with no packages** - rejected: this is exactly the
  "duplicated UI systems, thin and thick API handlers" problem §1.1
  identifies in the legacy application.
- **npm/yarn workspaces** - rejected: pnpm is what the specification and
  README both specify (§3), and its stricter node_modules layout catches
  accidental cross-package imports earlier.

## Consequences

- New product domains (finance, canvas, coaching, ...) each get their own
  `packages/*` entry when their phase starts - this ADR's list above is
  not exhaustive of the target structure (see the README's "target
  repository structure" for the fuller future shape), only of what exists
  after Phase 1.
- Every package needs its own minimal `package.json`/`tsconfig.json`
  boilerplate. Accepted cost for clean boundaries.

## Security / migration effects

None - this is a structural decision with no data or auth implications.

## Reversibility

High - packages can be merged or split later; this is a directory
convention, not a runtime commitment.

**Approvers:** (pending human review)
