# ADR-0005: Domain command, query and event conventions

**Status:** Accepted (retroactively - see "Why this was Proposed for so
long" below)
**Date:** 2026-09-06

## Context

Once more than one bounded domain exists (identity/tenancy alone doesn't need this yet), decide the shared shape for commands, queries and domain events across packages/domain and future domain packages.

Relevant specification sections: §37 (consequential-command lifecycle).

## Decision

Not pre-decided in the abstract - discovered and confirmed by reading
what 42 use-case files in `packages/domain` (89 exported command/query
functions, per a direct count) actually converged on independently
across Phases 2-8, then writing that convention down here as the
decision it turned out to be:

- **Commands** are `create<Entity>`, `update<Entity>` (or
  `update<Entity><Aspect>` for a narrower state transition, e.g.
  `updateTaskStatus`, `updateGoalStatus`), and `delete<Entity>` -
  always `async function name(db: Database, input: XInput): Promise<XRecord>`
  (or `Promise<void>` for delete). Every command takes a single typed
  `<Verb><Entity>Input` interface, never positional parameters beyond
  `db` - see `CreateTaskInput`/`createTask` in `task-use-cases.ts` as a
  representative example.
- **Queries** are `get<Entity>` (single record, or a computed
  read-model like `getWorkspaceScorecard`/`getConstraintDiagnosis`) and
  `list<Entity>s` (collections) - same `(db, input)` shape, read-only,
  never mutate.
- **Tenancy is not a convention choice per file** - every command and
  query in a workspace-scoped domain calls `requireWorkspaceMembership`
  (ADR-0003) or `requirePlatformAdmin`/`checkPlatformAdmin` (platform-wide
  content like curriculum and formulas) before touching data, and this
  is now mechanically enforced, not just documented: Phase 8's
  `workspace-isolation-architecture.test.ts` statically scans every
  `*-use-cases.ts` file's exports and fails CI if a new one skips the
  check (with a small, named, documented exemption list for the files
  that legitimately don't need it - `workspace-use-cases.ts`,
  `auth-use-cases.ts`, `platform-admin-use-cases.ts`, and one
  specifically-justified case in `ai-call-record-use-cases.ts`).
- **Domain events are the audit log, not a separate event bus.**
  ADR-0015 (Phase 1) already made this call and left it explicitly open
  ("deferred to whichever phase first needs consumers of those events");
  no phase from 2 through 8 ever needed one. Every consequential command
  writes a row to `audit_log` inside the same transaction as its write
  (e.g. `task-use-cases.ts`'s `createTask` inserting
  `{ action: "task.created", metadata: { title } }` right after the
  `INSERT` it's recording) - past-tense, dot-namespaced action strings
  (`task.created`, `workspace.created`, `user.logged_in`) are the entire
  "event" vocabulary this codebase has, and it has been sufficient for
  every Phase 2-8 feature. A real pub/sub domain-event system remains
  legitimately undecided, per ADR-0015, for whenever an actual consumer
  (a background job, a notification) needs one.
- **Errors are typed, per-domain, thrown-not-returned.** Every use-case
  file has a matching set of `*NotFoundError`/`*InvalidError` classes in
  `errors.ts`, thrown directly rather than returned as a result type or
  encoded in a response envelope - route handlers translate these to
  HTTP status codes at the API boundary (packages/contracts), keeping
  the domain layer HTTP-agnostic.

## Why this was "Proposed" for so long

This ADR was written and scoped correctly back in Phase 1 - "named and
scoped… before broad feature development," per §36 - but never revisited
once Phase 2 actually made the decision through 42 files of consistent
practice rather than a single deliberate design session. That's real
process debt (see ADR-0022's own "documentation-debt gap" section,
written a phase earlier), not a functional gap: the decision was made
correctly, just not written down until this pass reviewed what actually
shipped and confirmed it holds without exception.

## Alternatives considered

- **A generic `Result<T, E>` return type instead of thrown errors** -
  would remove the need for callers to know which errors a function can
  throw, but every route handler already needs typed error-to-status
  mapping regardless, and 42 files of consistent throw-based code would
  all need touching to change this now. Not revisited.
- **A real domain-event bus (in-process or outbox-pattern)** - genuinely
  deferred, not rejected; see ADR-0015. Nothing in Phases 2-8 needed
  asynchronous event consumers, so building one would have been
  speculative.

## Consequences

Any new use-case file follows this shape by default, and
`workspace-isolation-architecture.test.ts` already partially enforces
it (the tenancy-check half). The command/query naming split and the
audit-log-as-event-trail choice are conventions, not currently
mechanically enforced beyond code review and this document.

## Security effects

The tenancy-check convention is the load-bearing one from a security
standpoint, and it's the one with an actual automated guard (Phase 8) -
see ADR-0003's own Phase 8 update for detail.

## Migration effects

None - this documents existing structure, no schema change.

## Reversibility

High - this is a documented convention, not a runtime contract; a
future domain package could deviate with a locally-scoped reason
without breaking anything upstream.

**Approvers:** Claude (autonomous build, reviewing Phases 2-8's actual
shipped code against this ADR's original scope - see PR description).
