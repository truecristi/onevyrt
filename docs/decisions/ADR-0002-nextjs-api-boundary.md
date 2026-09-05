# ADR-0002: Next.js rendering, server-action and API boundary policy

**Status:** Accepted
**Date:** 2026-09-05

## Context

§3 names Next.js App Router as the web shell. Something has to say exactly
where a route handler's responsibility ends and `packages/domain`'s begins,
or the "thin and thick API handlers" problem (§1.1) recurs immediately.

## Decision

- Route handlers (`app/api/**/route.ts`) do, in order: parse/validate the
  request with a `@onevyrt/contracts` Zod schema, check CSRF
  (`requireCsrf`) on any cookie-authenticated mutation, resolve the
  current user (`getCurrentUser`), call exactly one `@onevyrt/domain`
  use-case function, map its result/thrown error to an HTTP response, log
  via `@onevyrt/observability`. They never construct SQL, open a
  transaction, or hash a password themselves.
- `packages/domain` use-cases are the only things allowed to call
  `withTransaction` and touch more than one table.
- Pages (`app/**/page.tsx`) render; they do not contain business rules.
  Phase 1 has exactly one real page (`app/page.tsx`, an honest scaffold
  placeholder) and no forms yet - the register/login UI is a Phase 2+
  follow-up now that the API routes exist.
- Next 14.2.x, App Router only (no `pages/` directory). React Server
  Components by default; a component opts into `"use client"` only when it
  needs interactivity Phase 1 doesn't have yet (forms, session-aware UI -
  next phase).

## Alternatives considered

- **tRPC instead of REST route handlers** - deferred, not rejected: the
  spec's own stack table (§3) says "Next.js route handlers calling
  application services," and introducing tRPC now would be an unasked-for
  architecture decision beyond what Phase 1 needs. Revisit if the API
  surface grows large enough that hand-written Zod contracts on both ends
  becomes painful.
- **Server Actions instead of route handlers** for the auth endpoints -
  deferred: route handlers keep the contracts (`@onevyrt/contracts`)
  independently testable/reusable from a future non-Next client (mobile,
  CLI) without change; Server Actions couple more tightly to the page tree.

## Consequences

Every new API capability follows the same five-step shape above, which
makes route handlers easy to review for "does this bypass a use case."

## Security / migration effects

CSRF and authentication checks living in the route-handler layer, in a
fixed order, means a reviewer can verify a new endpoint is safe by
confirming it followed the pattern - not by re-deriving the threat model
each time.

## Reversibility

Medium - migrating specific endpoints to Server Actions or tRPC later is
possible without touching `packages/domain`, since the use-case functions
have no Next.js-specific types in their signatures.

**Approvers:** (pending human review)
