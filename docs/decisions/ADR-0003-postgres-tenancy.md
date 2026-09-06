# ADR-0003: PostgreSQL tenancy and row-ownership strategy

**Status:** Accepted
**Date:** 2026-09-05

## Context

§4: "every query must include the active workspace boundary, and tests
must attempt cross-workspace access." §46 item 20 requires proof that a
second workspace cannot access any object from the first. Phase 1 has to
decide the isolation mechanism before any workspace-scoped table exists.

## Decision

Application-level tenancy, not Postgres Row-Level Security, for Phase 1:

- Every table that isn't a pure identity table (`users`) carries an
  explicit `workspace_id` (directly, like `workspaces.id` itself, or via
  `workspace_members.workspace_id`).
- Every read/write in `packages/domain` goes through a use-case function
  that takes the requesting user's ID and derives the workspace scope from
  their own `workspace_members` row (`getMembership`,
  `listWorkspacesForUser`) - there is no code path that accepts a
  caller-supplied `workspace_id` and trusts it without checking membership
  first.
- `packages/auth`'s `canReadWorkspace` / `canManageWorkspace` /
  `assertCanReadWorkspace` are the single, pure, unit-tested place the
  membership → permission decision is made (§4: "hiding a button is never
  authorization").
- Proven with a real integration test
  (`packages/domain/src/auth-workspace-isolation.test.ts`): two workspaces
  are created, and the test asserts `getMembership` returns `null` (not an
  error swallowed into `false`) for a user querying a workspace they don't
  belong to, and that `listWorkspacesForUser` never returns the other
  workspace.

Row-Level Security is not rejected outright - it's deferred. It's a
defense-in-depth layer worth adding once there are enough tables and
direct-SQL call sites that an app-layer mistake becomes plausible; with a
handful of tables and one call path (`packages/domain`), it would add
migration complexity (`SET app.workspace_id`, policy per table) without
yet buying much.

### Re-verification at scale (Phase 8, "Test workspace isolation")

The domain layer has since grown to 39 `*-use-cases.ts` files and 40+
tables - large enough that "one integration test proved it once" is no
longer sufficient confidence on its own. Phase 8's hardening pass
re-verified this ADR's decision two ways:

1. **A route-layer audit**: every file under `apps/web/app/api` was
   checked for direct `db.select`/`db.query`/`db.insert`/etc. calls -
   there are none; every route goes through `packages/domain`, exactly
   as ADR-0002 requires. The one route that accepts a client-supplied
   `workspaceId` in its request body rather than the URL path
   (`.../application`, lesson applications linking a build activity to a
   business record) was checked specifically: the domain function
   (`submitLessonApplication`) independently re-verifies both that the
   actor is a member of that `workspaceId` _and_ that the referenced
   resource actually belongs to it, so a caller cannot reference another
   workspace's record even by guessing its ID - covered by an explicit
   regression test
   (`lesson-application-isolation.test.ts`'s "rejects a workspace the
   learner doesn't belong to, and a resource that doesn't exist in the
   given workspace").
2. **A permanent automated guard**, not just a one-time audit:
   `workspace-isolation-architecture.test.ts` statically scans every
   `*-use-cases.ts` file and fails if any exported function referencing
   `workspaceId` doesn't call `requireWorkspaceMembership` or
   `requirePlatformAdmin` in its own body - the same "every function
   re-derives the caller's membership and fails closed" rule this ADR
   already establishes, now enforced by CI on every future function
   rather than relying on a reviewer to remember it. Running it against
   the current codebase found exactly one flagged function
   (`recordAiCall`, Phase 6's cost/latency bookkeeping), which is a
   documented, reviewed exemption in that test file: it's a write-only
   side effect called immediately after its caller already verified the
   same `workspaceId`, so it never reads or exposes cross-tenant data.

Given the growth in table/module count since this ADR's "a handful of
tables" reasoning, Row-Level Security is worth a fresh look in a future
phase as an additional defense-in-depth layer - this re-verification
found no gap that RLS would have caught, but the original "not yet
enough surface area to justify the migration complexity" argument is
weaker today than when this ADR was written. Still deferred, not
re-decided, since finding zero gaps is not by itself a reason to add a
new layer.

## Alternatives considered

- **Postgres Row-Level Security from day one** - deferred per above.
- **Separate database/schema per workspace** - rejected: doesn't match
  "PostgreSQL... relational integrity... reporting" (§3) reasoning, and
  massively complicates migrations for a product this early.

## Consequences

Every future package that reads workspace-scoped data must go through
`packages/domain`, not query `packages/database`'s schema directly from a
route handler - ADR-0002 already establishes this boundary.

## Security effects

This is the core tenant-isolation control. §42's threat model baseline
lists "cross-workspace object access" first for a reason - the isolation
test above is the concrete evidence, not just a policy statement.

## Migration effects

None yet (Phase 1 has no legacy data to migrate).

## Reversibility

Medium - adding RLS later is additive (policies on top of existing
tables), not a rewrite.

**Approvers:** (pending human review)
