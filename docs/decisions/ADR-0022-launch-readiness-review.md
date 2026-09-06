# ADR-0022: Launch readiness review

**Status:** Accepted (this is a status report, not a reversible technical
decision - "accepted" means the assessment below is the record of what
was actually checked, not a claim that the product is ready to launch)
**Date:** 2026-09-06

## Context

README "Migration and hardening" → "Complete launch readiness review",
the final bullet of the entire Phase 0-8 roadmap. Spec §44's release-gate
checklist and §46's twenty minimum critical end-to-end journeys are the
standard this review holds itself to. This document's only job is to be
trustworthy: a real launch decision needs an honest account of what's
done and what isn't, not a summary that rounds completion up. Nothing
below is invented or assumed - each claim points at the artifact (a test
file, an ADR, a CI step) that backs it up.

**The bottom line, stated first so it can't be missed by skimming past
it: this system is not ready for a real production launch.** It is a
thoroughly tested, tenant-isolated backend and API platform covering
identity through AI-assisted review and recommendation - genuinely
substantial - but it has no deployed environment, almost no rendered
user interface, no external security audit, and several operational
decisions still open. What follows is the specific, itemized version of
that summary.

## What Phases 0-8 actually built

- **Phase 0-1 (Discovery, Foundation):** the monorepo, strict TypeScript,
  Postgres + Drizzle migrations, the design-system foundation, auth +
  workspace isolation (ADR-0003/0004), CI (format/lint/typecheck/test/
  build), and the parity ledger transcribed from the spec's own
  appendices (`docs/parity/` - explicitly `classification: pending`
  throughout, since the legacy source to classify against doesn't
  exist - see "Import legacy data / verify parity" below).
- **Phase 2 (Core user and business data):** users, workspaces, business
  profiles, goals, customer profiles, offers, business metrics,
  assumptions, decisions, tasks, evidence, audit records - all with
  tenant-isolation tests.
- **Phase 3 (Learning system):** programs/modules/lessons, lesson
  blocks, progress tracking and resume, notes/bookmarks, knowledge
  checks, reflection, lesson application, prerequisites, and completion
  rules that require real evidence rather than time-on-page.
- **Phase 4 (Numbers and modeling):** the versioned formula library,
  scenario modeling, funnel mathematics, unit economics, financial
  dashboards, assumption provenance, and comparison tools - every
  calculation traceable to its formula version and inputs.
- **Phase 5 (Build and execution):** offer/customer/funnel builders,
  artifact versioning with diffing, the task/project system, the
  experiment system, evidence collection, and launch workflows.
- **Phase 6 (AI coaching):** a provider-neutral AI gateway (ADR-0010)
  with a real Anthropic adapter and a deterministic test/fallback
  adapter, a prompt/schema registry, policy-controlled context assembly
  (ADR-0011), the coaching interface, lesson explanations, artifact and
  task proposals under a propose→review→accept/reject audit trail
  (ADR-0012), sketch specifications, per-caller rate limiting, cost/
  latency tracking, and a golden-evaluation harness that gates prompt
  regressions in CI.
- **Phase 7 (Review and intelligence):** scorecards, weekly reviews with
  frozen point-in-time snapshots, experiment analysis (cycle time,
  assumption test coverage), constraint diagnosis (Theory-of-Constraints
  reasoning over assessed forces), progress summaries, deterministic
  rule-based recommendation ranking, and improvement loops that measure
  whether an acted-on recommendation actually moved the needle.
- **Phase 8 (Migration and hardening):** an automated, self-verifying
  workspace-isolation architecture guard; a security self-review with
  two real fixes (a missing logout CSRF check, missing security
  headers); a decided and _tested_ backup/restore mechanism plus a
  forward-only migration policy (ADR-0019); a performance audit with two
  real fixes (a sequential-await pattern, a missing index); an
  accessibility review that found and fixed two real WCAG failures and
  one previously-unknown broken lint rule (the `.tsx` glob that meant
  React/accessibility linting was silently never running at all); and
  this document.

Every phase's work is covered by real, passing tests run in CI on every
push - as of this review, 248+ domain/integration tests plus package-
level unit tests, all against a real Postgres service container, not
mocks.

## Spec §44's release-gate checklist, checked item by item

| Gate                                                         | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting and linting                                       | **Met**           | `pnpm format:check` / `pnpm lint` run in CI on every push (`.github/workflows/ci.yml`); this phase also fixed a broken `.tsx` glob that meant React/a11y rules weren't actually running - now they are.                                                                                                                                                                                                                                |
| Strict type checking                                         | **Met**           | `pnpm typecheck` (strict `tsc --noEmit`, `exactOptionalPropertyTypes: true`) across all 14 packages, CI-enforced.                                                                                                                                                                                                                                                                                                                      |
| Unit and domain tests                                        | **Met**           | 248+ tests in `packages/domain`, plus per-package unit tests (`packages/ai`, `packages/security`, `packages/design-system`, etc.), CI-enforced.                                                                                                                                                                                                                                                                                        |
| Database migration checks                                    | **Met**           | `packages/database/src/migrate.test.ts` proves every migration applies in order and a second run is idempotent, against a real Postgres in CI.                                                                                                                                                                                                                                                                                         |
| Contract compatibility tests                                 | **Not met**       | Zod contracts (`packages/contracts`) are used consistently at every API boundary, but there is no dedicated test suite verifying a contract change doesn't silently break an existing consumer - this gate was never explicitly built as its own thing.                                                                                                                                                                                |
| Integration tests                                            | **Met**           | Every domain isolation test runs against a real Postgres (not an in-memory or mocked database).                                                                                                                                                                                                                                                                                                                                        |
| Tenant-isolation and authorization tests                     | **Met**           | Both a large body of per-feature isolation tests and, as of Phase 8, a permanent static architecture guard (`workspace-isolation-architecture.test.ts`) that fails CI if a future function skips the membership check - see ADR-0003's Phase 8 update.                                                                                                                                                                                 |
| Critical end-to-end journeys                                 | **Not met**       | `tests/e2e/` is an empty Playwright scaffold with an honest README explaining why: there's no clickable UI to test against yet (one static page). §46's 20 journeys are unimplemented as E2E tests; the ones that map to pure backend behavior (register/login/workspace creation, for instance) have equivalent coverage as domain integration tests, but that is not the same thing as a scripted user journey through real screens. |
| Accessibility checks                                         | **Partially met** | A real contrast-ratio test and (as of this phase) working jsx-a11y linting exist and pass - but there is essentially no page UI for them to check yet. See `docs/accessibility/phase-8-accessibility-review.md`.                                                                                                                                                                                                                       |
| Dependency and secret scanning                               | **Not met**       | No Dependabot, Snyk, gitleaks, or equivalent is configured anywhere in this repository or its CI.                                                                                                                                                                                                                                                                                                                                      |
| Production build                                             | **Met**           | `pnpm build` runs in CI and succeeds on every push.                                                                                                                                                                                                                                                                                                                                                                                    |
| AI schema and evaluation thresholds for changed capabilities | **Met**           | Phase 6's golden-evaluation harness (`packages/ai/src/evals/`) runs in the normal test suite and fails CI if a prompt template regresses against its golden cases.                                                                                                                                                                                                                                                                     |
| Numerical golden tests for changed formulas                  | **Partially met** | `formula-registry.test.ts` covers the formulas that exist, but ADR-0006 (the deterministic calculation engine's own versioning/provenance architecture) is still Proposed, not Accepted - the golden-test _convention_ exists without a formally decided engine architecture underneath it.                                                                                                                                            |
| Migration rehearsal for changed persisted data               | **Met, narrowly** | Every migration is rehearsed against a fresh Postgres in CI on every single push (not just when data changes) - broader than the gate technically asks for, in the sense that there's no real persisted production data yet to rehearse _against_.                                                                                                                                                                                     |
| Documentation and traceability checks                        | **Met**           | Every domain/route file cites its PRD/README bullet and relevant spec section in a doc comment; 22 ADRs track every major decision (accepted, partially accepted, or explicitly still open); `docs/parity/`, `docs/security/`, `docs/performance/`, `docs/accessibility/` each carry a dated, scoped report.                                                                                                                           |

**5 of 15 gates are not fully met.** Two (`dependency and secret
scanning`, `critical end-to-end journeys`) are not met at all.

## Spec §46's 20 minimum critical end-to-end journeys

None of the 20 are implemented as actual end-to-end (browser-driven)
tests - see "Critical end-to-end journeys" above. Roughly half have
real _domain-level_ integration-test coverage of the underlying
business logic (register/workspace creation, invite-and-permission-
boundary, lesson resume, customer-profile/offer versioning, scenario
comparison, AI coaching schema-validity, AI proposal accept/reject audit
trail, action-and-evidence, experiment create-and-close); the other half
depend on capabilities that don't exist yet in any form (structured
canvas, freeform sketch storage - both ADR-0007/0008, still Proposed;
background job retry - ADR-0013, still Proposed; data export/deletion
workflows). Domain-level coverage of the logic is real and valuable, but
it is not evidence that a user can actually click through the journey in
a browser, because there is no browser-facing journey to click through
yet.

## What's genuinely blocked, not just undecided

- **No production deployment exists.** ADR-0021 documents this
  explicitly: the Bluehost/Tailscale target named in the original spec
  is unreachable from every session that has worked on this repository
  so far (no route, no SSH key material present). Nothing in Phases 0-8
  changes this - it is an access constraint, not a code gap.
- **Legacy data import and parity verification are blocked**, not
  skipped: both `main` and `master` were force-emptied before this build
  began (at the repository owner's explicit request), so there is no
  legacy source or data to import or verify parity against anywhere
  this session can reach. ADR-0018 and `docs/parity/README.md` both
  carry a dated Phase 8 note re-confirming this rather than leaving it
  unexamined.
- **No external security audit, dependency scan, or secret scan has
  ever been run** against this codebase. Phase 8's security review
  (`docs/security/phase-8-security-review.md`) is a genuine, systematic
  self-review that found and fixed two real issues - but it is a review
  by the same process that wrote the code, which is structurally weaker
  than an independent audit, and it explicitly says so.
- **A backup schedule, retention policy, and real RPO/RTO remain
  undecided** - not because no one looked, but because there is no
  production traffic or hosting provider to size those numbers against
  yet (ADR-0019). The _mechanism_ (`pg_dump`/`pg_restore`) is decided
  and was actually tested against a real database with real data from
  this session's own smoke tests.

## A documentation-debt gap worth naming honestly

Several ADRs remain formally **Proposed** despite the system they cover
having since been fully built and shipped: ADR-0005 (domain command/
query conventions - the pattern every one of the 39+ use-case files in
`packages/domain` actually follows consistently, but the ADR recording
that convention was never updated from its Phase-1-era stub),
ADR-0006 (formula versioning - `formula-registry.ts` and its tests exist
and pass), and ADR-0009 (curriculum content schema - the entire Phase 3
learning system is built on it). The architecture decisions were
effectively made, in code, consistently - the paper trail just didn't
keep up during the vertical-slice PRs that made them. This is real
process debt, not a functional gap: closing it means someone reviewing
what Phases 2-5 actually did and updating those three ADRs to match, a
focused documentation pass rather than new engineering work. Flagged
here rather than quietly fixed inside this synthesis document, since
retroactively rewriting a decision record without that review would
risk describing what was _probably_ decided rather than what was
verified to have been.

## What this review recommends before any real launch

In rough priority order:

1. **Decide where this actually deploys** (resolve ADR-0021 - get a
   reachable target, even a cheap one, and prove the build/migrate/
   health-check path works against it).
2. **Run a real, external security review** before any real user data
   touches this system - a self-review, however systematic, is not a
   substitute.
3. **Add dependency and secret scanning to CI** - this is inexpensive
   (GitHub's own Dependabot/secret-scanning cost nothing to enable) and
   currently entirely absent.
4. **Build the actual product UI** (the Today/Learn/Build/Execute/Review
   navigation this repository's own README describes) - without it,
   neither §46's journeys nor a real accessibility pass nor a real user
   can exist.
5. **Once there's a UI, write the Playwright suite** for §46's 20
   journeys for real, replacing today's domain-level proxy coverage.
6. **Close the ADR-0005/0006/0009 documentation debt** named above.
7. **Decide a backup schedule and RPO/RTO** once a real deployment
   target exists to size them against.

## Reversibility

N/A - this is a status report, not an architectural decision. Re-running
this review after future phases close some of the above is expected and
appropriate; the version history of this file is itself the record of
readiness over time.

**Approvers:** Claude (autonomous build, per this repository's standing
delegation - see PR description for the slice that produced this
review). This document represents this session's own honest assessment,
not a substitute for the repository owner's independent judgment about
whether to launch.
