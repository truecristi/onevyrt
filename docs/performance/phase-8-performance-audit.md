# Phase 8 performance audit

Per the root README's Phase 8 checklist item "Validate performance". No
production traffic exists yet, so this isn't a load test or a latency
benchmark against real usage - it's the honest version of "validate
performance" available at this stage: an index audit over every
workspace-scoped table, and a systematic check for N+1 query patterns
and unnecessary sequential-await latency across the domain layer.

## Method

For the index audit, every `pgTable` definition in
`packages/database/src/schema.ts` that has a `workspace_id` column was
checked for whether some index (a dedicated index, a composite index or
unique constraint with `workspace_id` as its leading column, or a
composite primary key with `workspace_id` first) actually covers a
`WHERE workspace_id = ...` lookup efficiently - the leftmost-prefix rule
for B-tree indexes.

For the N+1/sequential-latency audit: every `for`/`.map(async` loop in
`packages/domain/src/*.ts` was inspected for a database call inside the
loop body (a real N+1, cost growing with row count) versus pure
in-memory iteration over an already-fetched array (not a performance
issue at all); and every use case that awaits more than one independent
async call was checked for `Promise.all` versus sequential `await`s.

## Findings

### Fixed

- **`assembleWorkspaceContext` awaited its context-class loaders
  sequentially** (`ai-context-use-cases.ts`) - one context class's
  database query at a time (up to 4 today: business profile, goals,
  assumptions, decisions), rather than concurrently. Every other
  multi-query aggregation in this codebase already uses `Promise.all`
  (`getWorkspaceScorecard`, `getExperimentAnalysis`, `getRecommendations`,
  `getProgressSummary`, `getFinancialDashboard`) - this was the one
  exception, found by checking every aggregation for the pattern.
  Fixed to `Promise.all`, preserving the exact same manifest/section
  ordering (results come back in the same order as the input array).
  Verified: `ai-context-isolation.test.ts`'s existing 6 tests still pass
  unchanged - this is a latency fix, not a behavior change.

- **`artifact_versions` had no index on `workspace_id`** - found by the
  systematic per-table check above; every other workspace-scoped table
  had one. Added `artifact_versions_workspace_id_idx`
  (migration `0035`). Honestly scoped: every query against this table
  today filters by `(workspace_id, artifact_type, artifact_id)`
  together, and the existing `artifact_versions_artifact_idx`
  `(artifact_type, artifact_id)` already serves those efficiently on
  its own (that pair is highly selective regardless of workspace) - so
  this isn't fixing a slow query that exists today. It closes a gap for
  the day a query needs to list version history across an entire
  workspace rather than one specific artifact, which no current route
  does.

### Confirmed already correct (no change needed)

- **Every other workspace-scoped table** has a covering index:
  `workspace_members` via its composite primary key
  `(workspace_id, user_id)` (workspace_id leads it, so Postgres's
  automatic PK index serves a workspace-only lookup); `business_profiles`
  via a `.unique()` constraint directly on the column (one profile per
  workspace, so a unique index is exactly the right shape, not just an
  adequate one); every remaining table via a dedicated
  `index(...).on(table.workspaceId)`.
- **No genuine N+1 query pattern found anywhere in the domain layer.**
  Every loop that touches rows fetched from the database operates on an
  already-fetched, batch-loaded array (`inArray(...)` fetched once,
  then joined in memory via a `Map`/`Set` - see
  `scenario-use-cases.ts`'s scenario-comparison query and
  `completion-use-cases.ts`'s two missing-requirement checks) rather
  than issuing one query per row. The loops inside `scorecard-use-cases.ts`,
  `experiment-analysis-use-cases.ts`, and `artifact-version-use-cases.ts`
  that iterate over a result set are pure in-memory counting/diffing
  with no database calls inside them at all.
- **Every multi-query aggregation except the one fixed above already
  used `Promise.all`** - `getWorkspaceScorecard`, `getExperimentAnalysis`,
  `getRecommendations` (which itself calls three other aggregations
  concurrently), `getProgressSummary`, and `getFinancialDashboard`.

## Not covered by this pass

This is a static/structural audit, not a measured one - there is no
`EXPLAIN ANALYZE` evidence here because there's no realistically-sized
dataset or production query pattern to run it against yet (this
session's dev database has dozens of rows per table from live smoke
tests, not the thousands-to-millions a real index decision should
eventually be validated against). Once real usage exists, the honest
next step is measuring actual slow-query logs against this audit's
assumptions, not trusting them indefinitely.

## Verification

- `pnpm -r typecheck`, `pnpm lint`, `pnpm test` (full monorepo) - all
  green after both fixes.
- `packages/database/src/migrate.test.ts` - migration `0035` applies
  cleanly and is idempotent on a second run.
- `ai-context-isolation.test.ts`'s existing 6 tests pass unchanged
  against the parallelized `assembleWorkspaceContext`, confirming the
  latency fix didn't change behavior.
