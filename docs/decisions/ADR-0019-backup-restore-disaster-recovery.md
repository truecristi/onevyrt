# ADR-0019: Backup, restore and disaster recovery

**Status:** Partially accepted (Phase 8 - migration rollback strategy and
backup/restore mechanism decided and tested; schedule, retention and
recovery-time objectives still deferred, see below)
**Date:** 2026-09-05

## Context

Backup schedule, restore-test cadence and recovery objectives, once
there's production data worth losing. Spec §45's operational-readiness
baseline names "backup schedule and restore test" and "rollback or
feature-disable runbook" as required for every critical service; spec
§40's "restore is tested, not assumed" is the standard this ADR holds
itself to.

Relevant specification sections: §45, §40.

## Decision

### Migration rollback strategy (decided)

**Forward-only migrations - roll forward, never backward.** This
repository's migrations (`packages/database/migrations/*.sql`) have no
`down` script, and none will be added. A migration that turns out to be
wrong is fixed by writing a new, later migration that corrects it - never
by reverting an already-applied one in place. This matches ordinary
Postgres practice for a system with real data: a down-migration for a
schema change (dropping a column, tightening a constraint) is often
either impossible to write safely once real rows exist, or actively
destructive (it deletes exactly the data the forward migration added).
`packages/database/src/migrate.test.ts` already proves the two properties
this strategy actually depends on: every migration applies cleanly in
order, and a second run of `runMigrations` against an already-migrated
database applies nothing (idempotent) - so "rollback" in the CI/CD sense
means redeploying the previous application version against a database
that has moved forward, not moving the database itself backward. This is
also why Alternatives Considered below rejects reversible migrations
outright rather than deferring the question.

### Backup/restore mechanism (decided and tested)

**Standard Postgres logical backups** (`pg_dump`/`pg_restore`, custom
format), not a bespoke export format or an application-level backup
job. This is the boring, well-understood answer for a single Postgres
database, and it composes with whatever a real hosting provider's own
automated snapshotting adds later (block-level snapshots and logical
dumps are complementary, not alternatives - a snapshot restores the
whole server fast, a logical dump restores into a fresh database or a
different Postgres version).

**Actually tested against this session's dev database**, not assumed:

1. `pg_dump -Fc` produced a 159 KB compressed backup of every table in
   the dev database (39 tables, populated by this session's own live
   smoke tests across every phase - 234 audit log entries, 67
   workspaces, and real rows in every Phase 2-7 table).
2. Restored into a fresh, empty database with `pg_restore` - zero
   errors.
3. Verified, not assumed: every one of the 39 tables' row counts matched
   exactly between source and restored database (diffed a sorted list of
   `table: count` for both - empty diff); `schema_migrations` showed the
   same 35 applied migrations in both; a specific row
   (`improvement_loops`, chosen because it has the most varied column
   types - text, double precision, boolean) matched byte-for-byte; and a
   foreign-key join (`workspace_members` → `workspaces`) still resolved
   correctly in the restored copy, proving referential integrity survived
   the round trip.

The scratch restore-target database and the backup file were both
deleted immediately after verification - this was a mechanism test, not
a retained backup artifact.

## What's still deferred (deliberately, not overlooked)

A backup **schedule**, **retention policy**, and real **RPO/RTO**
(recovery point/time objectives) cannot be honestly decided yet: this
session has no production deployment and no real user data (ADR-0021
already documents why - no reachable deployment target from this
sandbox). Setting "daily backups retained for 30 days" now would be a
number invented to look complete, not a decision grounded in this
product's actual traffic, data-loss tolerance, or the hosting
provider's own backup offering (many managed Postgres providers already
include automated point-in-time recovery, which may make a bespoke
`pg_dump` cron job redundant rather than complementary). This is
exactly the kind of financial/operational-assurance question this
codebase already refuses to guess at elsewhere (spec §40's rule against
inventing unverified figures, applied here to an operational figure
instead of a monetary one).

Once a real deployment exists, that phase inherits a proven mechanism
(above) and only has to decide the schedule/retention/RPO/RTO numbers on
top of it - not re-derive whether `pg_dump`/`pg_restore` even works.

## Alternatives considered

- **Reversible (`up`/`down`) migrations** - rejected, not deferred: see
  "Migration rollback strategy" above. A down-migration is often unsafe
  or impossible to write correctly once real data exists, so this
  repository never introduces the pattern rather than deciding later
  whether to use one already in place.
- **A bespoke application-level export job** instead of `pg_dump` -
  rejected for now: more code to maintain than a solved problem, no
  advantage identified yet that would justify it. Worth reconsidering
  only if a real anonymized-export or cross-region requirement emerges
  that plain Postgres tooling can't satisfy.

## Consequences

- Every future migration must be additive-safe or explicitly
  documented as a breaking change communicated ahead of deployment
  (spec §45's "rollback or feature-disable runbook") - there is no
  automated down-migration to fall back on if one ships wrong.
- The restore procedure itself (`pg_restore` into a target database) is
  now a known, exercised command sequence, not a theoretical one - a
  future runbook in `docs/runbooks/` can reference this ADR's exact
  steps rather than starting from nothing.

## Reversibility

High for the backup mechanism (adding provider-level snapshots later is
additive). Low for "forward-only migrations" in the sense that it's a
standing practice, not a single migration - reversing the _policy_
later would mean introducing down-migrations retroactively for
migrations that never had them, which is its own project, not a
config flip.

**Approvers:** Claude (autonomous build, per this repository's standing
delegation - see PR description for the slice that accepted this half of
the ADR)
