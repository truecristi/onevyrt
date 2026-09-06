# ADR-0015: Audit log integrity and sensitive-data policy

**Status:** Accepted (Phase 1 scope only)
**Date:** 2026-09-05

## Context

§38: "Audit events are append-only from the application's perspective."
Phase 1 needs _some_ audit trail as soon as it has privileged actions
(register, login, workspace creation) to implement worth auditing.

## Decision

`audit_log(id, actor_user_id, workspace_id nullable, action, metadata
jsonb, created_at)`. `packages/domain`'s use-cases insert into it inside
the same transaction as the action they're recording (`user.registered`,
`workspace.created`, `user.logged_in`) - never as an async afterthought
that could silently fail to record. No application code path issues an
`UPDATE` or `DELETE` against this table; "append-only from the
application's perspective" is enforced by convention/code review for now,
not a database-level `REVOKE UPDATE, DELETE` grant - that hardening is a
small, cheap follow-up once a real DB role/migration story exists (Phase
2's ADR-0004 follow-through), not before.

`metadata` is a plain `jsonb` object per row - Phase 1 only ever puts
non-sensitive identifiers/names in it (e.g. `{"name": "Alice's
Business"}`), never passwords, tokens or reflection text, per §38's rule
against copying sensitive content into general logging surfaces.

## Alternatives considered

- **A dedicated event-sourcing/outbox table** (§38's fuller event
  taxonomy, `LessonCompleted`-style past-tense business events) - deferred
  to whichever phase first needs consumers of those events (background
  jobs, notifications). `audit_log` is intentionally narrower: a
  compliance/security trail, not a general event bus.

## Consequences

Every future consequential command (§37's 12-step lifecycle, step 9)
should append here in the same transaction as its write - this table's
shape doesn't need to change to accommodate that, just more `action`
values.

## Security effects

Directly supports §42's "unauthorised exports," "role changes," and
similar log-driven detection cases, once there's more than
register/login/workspace-create to detect.

## Migration effects

None yet.

## Reversibility

High - additive; a real event-sourcing layer can be built alongside this
table later without touching it.

**Approvers:** (pending human review)
