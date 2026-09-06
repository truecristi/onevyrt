# ADR-0009: Curriculum content schema and publishing workflow

**Status:** Accepted (retroactively - see ADR-0005's "Why this was
Proposed for so long," same reasoning applies here)
**Date:** 2026-09-06

## Context

Versioned lesson/module/program schema and the publishing-gate workflow (§41). Needs the learner shell's navigation decided first.

Relevant specification sections: §3.1, §3.4, §21, packages/content.

## Decision

**The learner shell's navigation was never decided** - Phase 3 shipped
entirely as a backend/API layer (`packages/domain` use-cases and
Next.js route handlers), with no rendered learner-facing pages at all
(see ADR-0022's own finding: the only real UI in this repository is the
Phase 0/1 scaffold). This ADR's original premise - that the schema needs
the navigation decided first - turned out not to hold: the content model
below was designed and built entirely from the spec's data-shape sections
(§3.1, §3.4, §21) without needing a UI to exist first. What actually got
decided and shipped:

- **`packages/content` was never used.** It exists as an empty
  placeholder package from Phase 0/1 scaffolding; the actual schema
  lives directly in `packages/database`'s `schema.ts` and the actual
  logic in `packages/domain`'s `curriculum-use-cases.ts` and related
  files. Noting this plainly rather than silently leaving a reference
  to a package that was never populated.
- **`programs` -> `program_versions` -> `lessons` -> `lesson_blocks`**,
  a four-level hierarchy: a `program` is the stable, slugged identity
  (e.g. "customer-discovery"); a `program_version` is the actual
  versioned content, one row per revision; `lessons` and `lesson_blocks`
  belong to a specific version, not the program directly - so two
  versions of the same program can have entirely different lessons.
- **"Publishing freezes a version for enrolled learners; edits create a
  new version"** (spec §6.20, quoted directly in `schema.ts`'s own doc
  comment) is enforced two ways, not just documented: (1) application-
  level - `curriculum-use-cases.ts` only allows creating/editing lessons
  and blocks while the parent version's status is `"draft"`; (2)
  database-level backstop - a partial unique index
  (`program_versions_one_published_per_program_idx`) guarantees at most
  one published version per program even if application logic had a
  bug, and `publishProgramVersion` atomically archives any previously-
  published version in the same transaction before publishing the new
  one.
- **19 lesson block types (spec §21)** - orientation, concept, why,
  story, metaphor, figure, worked-example, counterexample, calculation,
  reflection, knowledge-check, practice, build, implementation,
  coach-prompt, evidence, review, celebration, resource - stored as one
  `lesson_blocks` table with a `blockType` discriminator and a `jsonb`
  `payload`, not 19 separate tables. Each type's actual shape is
  enforced by a Zod discriminated union at the API boundary
  (`packages/contracts/src/lesson-blocks.ts`), not by the database -
  the same "jsonb + boundary validation over table-per-variant" choice
  Phase 6 later reused for AI-proposed action payloads.
- **Enrollment is personal, not workspace-scoped.** A learner's
  `enrollments` and `lesson_progress` rows key off `userId` directly
  (spec's Enrollment/LearnerAttempt model, §21) - a person's curriculum
  progress travels with their account across every workspace they
  belong to, unlike almost everything else in this codebase (ADR-0003's
  workspace-row-ownership model). Enrollment targets a specific
  _published_ program version, never a program directly, so what a
  learner is enrolled in can never silently change out from under them.
- **Resume is exact, not "start of lesson."** `lesson_progress` carries
  `currentBlockId`, read back by the client to reopen a lesson at the
  precise block a learner left off on (spec §3.2), with `ON DELETE SET
NULL` rather than `CASCADE` - if a block is ever removed, the
  learner's progress record survives, just without a precise resume
  point, rather than disappearing.
- **Completion requires evidence, never time-on-page** (spec §3.4,
  quoted directly in `completion-use-cases.ts`'s doc comment). Only
  three block types carry a completion requirement at all -
  knowledge-check and reflection require a matching `block_response`
  row, build requires a matching `lesson_application` row - because
  those are the only types this system can verify completion of beyond
  "the learner opened the lesson." Every other block type is
  informational and carries no requirement, which is a deliberate
  scope decision, not an oversight: this system has no way to verify
  someone actually read a concept block, so it doesn't pretend to.

## Alternatives considered

- **19 separate tables, one per block type** - rejected in favor of one
  table with a `blockType` discriminator and `jsonb` payload; see
  `schema.ts`'s own doc comment. Each type's structure is genuinely
  different enough that 19 tables (or one table with 19 groups of
  mostly-null columns) would be worse than boundary-level validation.
- **Deciding this after the learner shell's navigation** - the ADR's
  original premise. Overtaken by how Phase 3 actually proceeded: the
  content model doesn't depend on navigation, only on the spec's data
  shape, so waiting was unnecessary.

## Consequences

A future UI slice building the actual learner shell (see ADR-0022's
recommended next steps) builds directly on this schema and these
use-cases with no migration needed - `lessonProgress.currentBlockId`
and the enrollment model already support exact resume behavior, the
publishing model already guarantees stable content for enrolled
learners.

## Security effects

Curriculum writes require `requirePlatformAdmin` (content is
platform-wide, same authorization shape as formula definitions -
ADR-0006); curriculum reads use `checkPlatformAdmin` to decide how much
to show (an admin sees every status, a learner sees only published
content) - covered by
`curriculum-authorization.test.ts`/`lesson-block-authorization.test.ts`.
Personal progress/enrollment reads and writes are scoped to the
authenticated user, covered by `progress-use-cases.ts`'s own isolation
tests (`prevents one learner from touching another learner's enrollment
or progress`).

## Migration effects

None beyond the existing curriculum tables and their migrations,
already shipped across Phase 3.

## Reversibility

High - the versioned-content model is additive by design (a new program
version never modifies a previously-published one), so this decision
doesn't need to be revisited even as a real learner UI gets built on
top of it.

**Approvers:** Claude (autonomous build, reviewing Phase 3's actual
shipped code against this ADR's original scope - see PR description).
