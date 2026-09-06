# ONEVYRT — Implementation Status

> **Rule:** Count an item **completed only after implementation AND validation** (passing tests / verified build / confirmed live). Do **not** inflate from plans, specs, or partially-written code.
> **Re-baselined:** 2026-08-30 by the first session with repo access, against the actual code on `master`. (The earlier version was initialised by an access-less "watch" session and read 0% everywhere with no code evidence.)
> **Working line:** `master` / `claude/works-f7cor7`. (`claude/remote-control-ygviv2` = PR #245 = a *separate*, unmerged prior effort — Page Check / billing / security — not part of this restructure.)

---

## Dashboard (report these every milestone)

| Metric | Value |
|---|---|
| Overall requested work completed | **~22%** |
| Phase 1 (curriculum + safe migration) completed | **~90%** (all code + tests done; awaiting CI-green + merge) |
| Navigation / user-flow phase completed | **~8%** (single canonical progress source built + tested) |
| Deployment readiness | **On `claude/works-f7cor7`; a DB-touching change → must pass CI in a PR before it can deploy** |
| Live deployment | **No** (live container is behind master; the feature ships only once Phase 1 + Phase 2 are green together) |

---

## Weighted checklist (weights total 100)

| # | Item | Weight | Status | Evidence | Remaining |
|---|---|---:|---|---|---|
| 1 | **Phase 1** — canonical 5-stage curriculum, pure `reconcileToChapters()`, explicit versioned+idempotent+transactional migration, conservative `stage_access_limit` remap, legacy/unmapped quarantine, rollback, full migration/progression tests | 20 | **In progress (~90%)** | Engine transforms + 20 tests (`curriculum-chapters.ts`); migration `1786700000000_curriculum-three-chapter-arc.js` + DB test (`curriculum-migrate.test.ts`); canonical seed via `reconcileToChapters(RAW)`; read-purity in `curriculum-store.ts`; engine **344/344**, web typecheck+lint clean | CI-green on real Postgres (the DB-backed tests), then merge |
| 2 | **Unified single progress source** (one record read by Home/Programme/My Business/Coaching) | 8 | **In progress** | `packages/engine/src/programme-nav.ts` — `LEARNER_MENU`, `buildProgrammeMap()`, `nextAction()` + 15 tests | Wire Home / Programme / My Business / Coaching UIs to read it |
| 3 | Global 5-item learner menu + one central route config | 5 | Not started | — | Everything |
| 4 | Home / next-action flow (Continue Programme → correct lesson) | 5 | Not started | — | Everything |
| 5 | Interactive programme mind map (canonical-data-driven) | 7 | Not started | — | Everything |
| 6 | Programme sidebar generated from curriculum engine | 3 | Not started | — | Everything |
| 7 | Standard lesson experience (Understand→Reflect→Build→Apply→Submit; open ≠ complete) | 6 | Not started | — | Everything |
| 8 | Connected programme outputs + Transformation Report (5 persistent docs) | 7 | Not started | Output names defined in `CANONICAL_STAGES[].output` | Persist + compile the documents |
| 9 | My Business living blueprint + ProgramCentre → My Business/Strategy Workbook conversion | 9 | Not started | — | Everything |
| 10 | Coaching + chapter approval gates (submit→review→approve/changes→unlock) | 8 | Not started | Coach-review engine already exists (`enrollment.ts`, `enrollments.ts`) | Wire gates to the 3-chapter journey |
| 11 | Resources reorganisation (non-essential tools out of required path) | 3 | Not started | — | Everything |
| 12 | Old-route compatibility & redirects (no deletions; documented map) | 4 | Not started | Only redirect today: `/`→`/command-center` (`middleware.ts`) | Everything |
| 13 | Responsive & accessible navigation (desktop sidebar + mobile drawer, a11y) | 4 | Not started | — | Everything |
| 14 | Tests & validation (type-check, lint, full suite, production build) | 3 | **In progress** | engine **344/344**, web typecheck **0 err**, web lint **0 err** (local); DB migration test authored (runs in CI) | e2e/nav tests; full CI green on the feature |
| 15 | GitHub integration (push + CI green) | 3 | **In progress** | Foundation pushed + fast-forward-merged to `master` (`964ccfe`); CI runs on master push | Confirm master CI green; PR for the feature branch |
| 16 | Bluehost deployment + live verification | 5 | Not started (setup confirmed) | Infra confirmed live: `onevyrt-app` @ `127.0.0.1:8515`, `onevyrt-cloudflared`, `/opt/onevyrt-src/deploy/deploy.sh`; `docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md` filled in | Deploy the finished feature; run smoke tests |
| | **Total** | **100** | **~22% complete** | | |

---

## What "done" means for the big items

### Phase 1 (#1) — DB migration test matrix (each needs an explicit passing test in CI)
Fresh install · programme with all 22 standard lessons · edited lesson content · custom/admin lesson · missing standard lesson · duplicate lesson ID · every `stage_access_limit` boundary (null, 0, each valid int, out-of-range, negative) · partially-completed user · fully-completed user · active cohort · archived cohort · migration run twice (idempotent) · migration failure + full rollback.

> **Already covered by engine unit tests** (`curriculum-chapters.test.ts`): ID preservation, no-loss/no-dup, idempotency, no-mutate, legacy/unmapped quarantine, missing standard lesson, wholly-custom programme, every `stage_access_limit` boundary, and a from-first-principles "never unlock" pacing invariant. **Still needed at the DB layer:** the actual migration applying these against real `curriculum`/`cohorts`/`enrollments` rows, run twice, plus rollback-on-failure.

### The five connected programme outputs (definition of done for #8)
1. **Personal & Business Gap Map** — from the starting baseline/assessment.
2. **Business Psychology Blueprint** — Chapter 1 output.
3. **Working Business System** — Chapter 2 output.
4. **Numbers & Control Dashboard** — Chapter 3 output.
5. **Final Transformation Report** — before/after, baseline (#1) vs end state.

Each must be a **real, persistent document** compiled from the learner's answers — not a view that recomputes ad hoc.

### Old-route → new-destination map (fill during #12)
| Old route | New destination | Redirect implemented? | Test? |
|---|---|---|---|
| `/start` | Personal & Business Baseline | ☐ | ☐ |
| Command Centre journey | Home + required action | ☐ | ☐ |
| Business OS journey (`/business`) | My Business | ☐ | ☐ |
| Psychology pillar (`/psychology`) | Chapter 1 | ☐ | ☐ |
| Execution pillar (`/execution`) | Chapter 2 | ☐ | ☐ |
| Numbers pillar (`/numbers`) | Chapter 3 | ☐ | ☐ |
| Foundation/Check/Launch/Sell/Improve (AppNav) | Contextual labels | ☐ | ☐ |
| Studio Start/Run/Improve | Resource categories | ☐ | ☐ |
| Duplicate ProgramCentre course flow | My Business / Strategy Workbook | ☐ | ☐ |

---

## Current lesson → chapter mapping (implemented in `CANONICAL_LESSON_LAYOUT`)

| New stage | Lessons (IDs preserved) |
|---|---|
| **Start** — Personal & Business Baseline | `l-0-1`, `l-0-2` |
| **Chapter 1** — Define the Business and Psychology | `l-1-1`, `l-1-2`, `l-2-1`, `l-2-2`, `l-3-1`, `l-4-1` |
| **Chapter 2** — Implement Psychology in the Business | `l-4-2`, `l-5-1`, `l-5-2`, `l-6-1`, `l-6-2`, `l-7-1`, `l-7-2`, `l-8-1`, `l-8-2` |
| **Chapter 3** — Define and Control the Numbers | `l-3-2`, `l-9-1`, `l-9-2`, `l-10-1` |
| **Finish** — Transformation Report & Next 90 Days | `l-10-2` |

This bucketing is a product decision expressed as data — adjustable in `packages/engine/src/curriculum-chapters.ts` (or later via the admin curriculum editor) without any data loss, since lesson IDs never change.
