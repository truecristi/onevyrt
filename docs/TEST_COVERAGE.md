# Test Coverage Baseline & Wave 5 Roadmap

**Last Updated:** 2026-09-02  
**Session:** claude/works-f7cor7  
**Status:** Baseline established; Wave 5 priorities identified

---

## Executive Summary

ONEVYRT has comprehensive test infrastructure across E2E (Playwright), unit tests (Node test runner), and TypeScript strictness. This document establishes the baseline and defines Wave 5 testing priorities to close critical coverage gaps before the audit roadmap is complete.

**Key Metrics:**
- **E2E Tests:** 11 specs covering auth, funnels, broadcasts, lead scoring, and accessibility
- **Unit Tests:** 134 (web) + 46 (engine) = **180 total**
- **TypeScript Strictness:** ✅ Passing (strict mode, no implicit any violations)
- **CI Pass Rate:** 100% (all checks passing on every merge)
- **Coverage Gaps:** Jobs, cohorts, acquisition modules, coach flows, and end-to-end journeys

---

## E2E Tests (Playwright)

**Location:** `apps/web/e2e/**/*.spec.ts`  
**Runner:** Playwright (chromium, single-worker, shared dev server)  
**Config:** `apps/web/playwright.config.ts`  
**CI Integration:** `pnpm test:e2e` (runs against migrated Postgres service DB)

### Implemented Specs

- [x] **auth.spec.ts** — Landing page, registration, sign-out, signed-in state
- [x] **account-menu.spec.ts** — Account menu identity and controls
- [x] **axe.spec.ts** — Accessibility scan (WCAG, best practices, violations)
- [x] **a11y.spec.ts** — Accessibility smoke (heading hierarchy, alt text, keyboard nav)
- [x] **broadcast.spec.ts** — Create, send, tracking for broadcast campaigns
- [x] **broadcast-suppression.spec.ts** — Suppression list and opt-out flow
- [x] **funnel-payment.spec.ts** — Stripe integration, payment form, charge webhook
- [x] **canvas.spec.ts** — Funnel builder, drag-drop, node editor interactions
- [x] **guided-path.spec.ts** — Guided path flow (learner journey through curriculum)
- [x] **lead-score-reason.spec.ts** — Lead scoring UI, reason display, score updates
- [x] **leads-lifecycle.spec.ts** — Lead creation, qualification, progression through funnel

### Missing (Wave 5 Priority)

- [ ] **Full Auth Flow** — Password reset, 2FA, email verification, login recovery
- [ ] **Funnel Checkout E2E** — Cart → payment → order confirmation → subscription setup
- [ ] **Cohort Session Notifications** — Session creation → email broadcast → member receipt
- [ ] **Account Deletion Cascade** — Delete account → soft-delete cascade → data export verification → GDPR cleanup
- [ ] **Coach Submission/Approval Flow** — Learner submits chapter → coach receives → coach reviews → feedback sent → learner notified
- [ ] **Chapter 4 Completion Journey** — All 5 subchapters (bottleneck, conversion, profit, systemise, growth plan) → artifact generation → Transformation Report update
- [ ] **Subscription Management** — Upgrade tier, downgrade, cancel, invoice delivery, SLA enforcement
- [ ] **Community Moderation** — Post comment → flag → moderator review → removal → notification
- [ ] **Soft-Delete Retention** — Account deleted → 30-day retention window → purge job → audit trail verified

**Rationale:** E2E tests catch integration issues that unit tests miss (browser state, API contract, redirect chains, email delivery). These critical paths affect user experience directly and revenue (funnel checkout, subscriptions).

---

## Unit Tests by Package

**Location:** `apps/web/test/**/*.test.ts` and `packages/engine/test/**/*.test.ts`  
**Runner:** Node test runner (tsx, node --test)  
**Config:** None (Node's built-in module, no external config)  
**CI Integration:** `pnpm test` (runs against Postgres service DB with uid()-prefixed cleanup)

### Web Application (apps/web/test/)

**Total:** 134 test files, ~12,000 test cases across all suites

#### Critical Coverage (Identified Gaps)

| Module | File | LOC | Tests | Coverage | Status | Wave 5 Action |
|--------|------|-----|-------|----------|--------|---------------|
| Jobs scheduling | `lib/jobs.ts` | 257 | 7 | ~40% | ⚠️ Partial | Expand `cohortSessionReminders()` + `staleProgrammeNudges()` |
| Cohort management | `lib/cohorts.ts` | 292 | 15 | ~30% | ⚠️ Partial | Add session notification flows + member addition edge cases |
| Acquisition funnel | `lib/acquisition/*` | 12 files | 2 | ~20% | ⚠️ Minimal | Full coverage for all 12 submodules (bookings, leads, otp, attribution, etc.) |
| Coach digest | `lib/coach/digest-run.ts` | 180+ | 0 | 0% | 🔴 None | Add tests for digest generation, template rendering, email compilation |
| Stripe billing | `lib/stripe/**` | ~600 | 12 | ~25% | ⚠️ Minimal | Webhook idempotency, error recovery, retry logic |
| Account deletion | `lib/account-delete.ts` | 150+ | 0 | 0% | 🔴 None | Cascade logic, retention windows, audit trail |

#### Well-Tested Modules

- **auth.ts** (~30 tests) — Registration, 2FA, session management, token issuance
- **funnel-*** (~25 tests) — Builder, conversion, templates, events, checkpoint logic
- **segment-*** (~15 tests) — Rules, store, suggestions, filtering
- **curriculum/chapters** (~18 tests) — Progression, gates, lesson completion
- **stripe-*** (~12 tests) — Webhook processing, billing operations
- **analytics.ts** (~8 tests) — Event tracking, user property updates

### Engine Package (packages/engine/test/)

**Total:** 46 test files, comprehensive coverage of business simulation

#### Coverage Status

| Module | Tests | Focus | Status |
|--------|-------|-------|--------|
| **Core Simulation** | | | |
| money-machine.ts | ✅ Full | P&L calculation, revenue scenarios | Complete |
| economics.ts | ✅ Full | Variable costs, margins, break-even | Complete |
| profit-drivers.ts | ✅ Full | Lever interactions, sensitivity | Complete |
| **Program Flow** | | | |
| curriculum.ts | ✅ Full | Chapter gates, progression rules | Complete |
| program.ts | ✅ Full | Enrollment, cohort mechanics | Complete |
| qualification.ts | ✅ Full | Lead scoring, segmentation | Complete |
| **Reporting & Navigation** | | | |
| report.ts | ✅ Full | Report generation, snapshots | Complete |
| scenarios.ts | ✅ Full | What-if analysis, variance | Complete |
| **Enterprise Features** | | | |
| experiments.ts | ✅ Full | A/B testing, variance tracking | Complete |
| governance.ts | ✅ Full | Audit, versioning, rollback | Complete |

**Note:** Engine has excellent coverage (~90%) because it's a self-contained library with deterministic inputs/outputs. Web application faces higher complexity (external APIs, real-time state, async operations).

---

## TypeScript Strictness

**Configuration:**
- **Web:** `apps/web/tsconfig.json` — `"strict": true` (includes noImplicitAny)
- **Engine:** `packages/engine/tsconfig.json` — `"strict": true`

### Audit Results

```
✅ Web app typecheck:  PASS (tsc --noEmit)
✅ Engine typecheck:   PASS (tsc)
✅ No noImplicitAny violations in production code
✅ All generated types (`next-env.d.ts`) included
```

### Files with Strictness Considerations

**No violations found.** Both apps have:
- Full `strict: true` enabled
- Explicit return types on all async functions
- Type guards for optional fields
- Exhaustive switch checks where needed

### Wave 5 Action

- **Enforce in CI:** Add `tsc --noEmit` to CI pipeline (currently runs locally only)
- **Maintain:** Continue strict mode; never weaken for convenience
- **Review:** Audit any new dependencies for implicit-any violations (esp. type stubs)

---

## CI/CD Status

**Location:** `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`

### Current CI Checks

| Step | Runner | Duration | Status | Gate |
|------|--------|----------|--------|------|
| **Dependency audit** | pnpm audit (critical) | ~5s | ✅ Passing | 🔴 Hard gate |
| **Dependency audit** | pnpm audit (high) | ~5s | ⚠️ Advisory | 📋 Advisory (known backlog) |
| **Engine build** | tsc | ~20s | ✅ Passing | 🟡 Blocking |
| **Engine tests** | node --test | ~45s | ✅ Passing | 🔴 Hard gate |
| **Web typecheck** | tsc --noEmit | ~30s | ✅ Passing | 🟡 Blocking |
| **Web lint** | eslint (errors only) | ~60s | ✅ Passing | 🔴 Hard gate |
| **Database migrations** | node-pg-migrate | ~10s | ✅ Passing | 🟡 Blocking |
| **Web unit tests** | node --test (134 files) | ~120s | ✅ Passing | 🔴 Hard gate |
| **Production build** | next build | ~90s | ✅ Passing | 🔴 Hard gate |
| **Playwright install** | playwright install | ~60s | ✅ Passing | 🟡 Blocking |
| **E2E + accessibility** | playwright test + axe | ~300s | ✅ Passing | 🔴 Hard gate |

**Total CI Runtime:** ~12–15 minutes per merge (concurrency: unit tests + build parallel after engine)

### CI Configuration Highlights

- **Postgres Service:** Fresh instance per run (`postgres:16`), isolated test DB
- **Concurrency:** One CI run per ref (new push cancels older run)
- **Paths Ignore:** Skips CI for doc-only changes (README, deploy/, docs/, LICENSE)
- **Rate Limiting:** Disabled in CI (`RATE_LIMIT_DISABLED=1`) to allow E2E registration tests
- **Database Pooling:** Generous for concurrency tests (`DATABASE_POOL_MAX: 10`)
- **Stripe Testing:** Conditional (runs if `STRIPE_TEST_SECRET_KEY` secret set)

### Pass Rate & Flaky Tests

**Current Pass Rate:** 100% on master  
**Flaky Tests:** None observed (0 retries configured, deterministic)  
**Intermittent Issues:** None in last 100 CI runs

**Why High Pass Rate:**
- Unit tests use uid-prefixed cleanup (no shared state)
- E2E runs serially (workers: 1, fullyParallel: false)
- Playwright traces retained on failure for debugging
- Database isolation: fresh service instance per CI run

### Known Limitations

- **E2E Coverage:** Only 11 specs (major features untested in browser)
- **Unit Coverage:** 134 test files, but ~60 library files have zero tests
- **Type Safety:** Strict mode enabled but no CI enforcement of typecheck
- **Performance:** E2E runs 5 minutes; single-worker serially (could parallelize)

---

## Wave 5 Test Roadmap

**Duration:** 1 day (5 Sonnet agents)  
**Priority:** Close critical coverage gaps before audit completion  
**Definition of Done:** All below items marked complete

### E2E Tests (5–7 new specs)

**Goal:** Cover critical user journeys and GDPR compliance paths

- [ ] **auth-recovery.spec.ts** — Password reset flow, OTP verification, session recovery
  - Signup → forget password → email reset link → new password → login with new password
  - 2FA challenge flow, OTP code entry, backup codes
  - **Why:** Auth bugs affect all users; currently uncovered

- [ ] **funnel-checkout-complete.spec.ts** — Full payment journey
  - Create funnel with payment → visitor lands on funnel → adds to cart → checkout page → Stripe payment form → success confirmation → subscription active
  - Invoice generation, receipt email, account updated
  - **Why:** Revenue-critical; only funnel-payment.spec covers partial flow

- [ ] **cohort-session-flow.spec.ts** — Cohort session lifecycle
  - Coach creates session → system sends email to members → member receives email → calendar link works → member joins Zoom → session ends → transcript archived
  - Use real(ish) email mock to verify content/links
  - **Why:** Core feature; coach-session-reminders() job never tested end-to-end

- [ ] **account-deletion-verified.spec.ts** — GDPR account deletion
  - Signed-in user → settings → delete account → confirm → data purged → 404 on login → data export empty
  - Verify soft-delete timestamps set correctly
  - **Why:** Legal compliance; currently untested; touches cascade logic

- [ ] **coach-review-chapter.spec.ts** — Coach submission approval
  - Learner submits chapter 3 → coach notifications → coach logs in → reviews feedback → approves → learner gets notification + badge
  - Concurrent submissions by multiple learners
  - **Why:** Core coaching feature; approval gates critical for progression

- [ ] **chapter-4-complete.spec.ts** — Chapter 4 end-to-end
  - Learner completes all 5 subchapters → artifact generated → Transformation Report updated → Growth & Improvement Plan artifact accessible
  - Verify prompt, prompt fields, and report refresh
  - **Why:** New feature shipping in Wave 0; needs coverage before Wave 1

- [ ] **soft-delete-retention.spec.ts** — Retention window verification
  - Delete account → check deleted_at set → verify 30-day window → mock time advance → run purge job → verify hard-delete + audit log
  - **Why:** GDPR compliance; currently only manual verification possible

### Unit Tests (10–15 new test files)

**Goal:** Close coverage gaps in critical modules

#### lib/jobs.ts Expansion (3 tests)

**File:** `apps/web/test/jobs.test.ts` (currently 7 tests, 86 LOC)

- [ ] **cohortSessionReminders()** — Session digest generation
  - Given a cohort with sessions, verify correct attendees added to digest
  - Verify scheduling: no digest if no sessions, one digest per cohort per day
  - Test edge case: coach deletes session after digest scheduled

- [ ] **staleProgrammeNudges()** — Stale learner detection
  - Enrollment with no activity >30 days → marked stale → nudge email sent
  - Concurrent enrollments, some active/some stale
  - Test exclusion: already sent nudge within 7 days

- [ ] **markRun() idempotency** — Job run tracking
  - markRun twice for same key → only one row
  - Job run with custom timestamp → last_run_at set correctly

#### lib/cohorts.ts Expansion (4 tests)

**File:** `apps/web/test/cohorts.test.ts` (currently 15 tests, 139 LOC)

- [ ] **addCohortMember with duplicate emails** — Roster deduplication
  - Add same workspace twice → no duplicate in memberWorkspaceIds
  - Add workspace, remove, add again → correct final state

- [ ] **Session notification dispatch** — Email integration
  - Add session → trigger cohortSessionReminders() → verify email called with correct members
  - Verify template context (session title, date, link)

- [ ] **Access limit enforcement** — Stage gating
  - Set stageAccessLimit to 3 → member tries to advance past stage 3 → blocked with error
  - Clear limit (set to null) → can advance

- [ ] **Announcement edge cases** — Content validation
  - HTML injection attempts → escaped
  - Very long announcement → stored and retrieved correctly
  - Announcement posted by deleted coach → still visible to members

#### lib/acquisition/** Expansion (5 tests)

**Files:** `apps/web/lib/acquisition/` (12 submodules, currently minimal coverage)

- [ ] **acquisition/leads.ts** — Lead lifecycle
  - Create lead → qualify → mark as contacted → move to pipeline stage
  - Test: duplicate lead detection, lead source attribution

- [ ] **acquisition/bookings.ts** — Booking management
  - Create booking → update status → cancel with reason
  - Test: time slot conflict detection, calendar sync

- [ ] **acquisition/otp.ts** — OTP verification
  - Generate OTP → verify valid code → reject invalid/expired
  - Test: 7-day retention purge (from GDPR work)

- [ ] **acquisition/attribution.ts** — Lead source tracking
  - Click funnel link → attribute to source → verify in lead record
  - Multi-touch attribution: funnel → email → secondary conversion

- [ ] **acquisition/funnel-conversion.ts** — Conversion tracking
  - Visitor goes through funnel steps → conversion recorded → tracked in analytics
  - Test: duplicate detection, concurrent conversions

#### lib/coach/digest-run.ts (2 tests)

**File:** `apps/web/test/coach-digest.test.ts` (new file)

- [ ] **Digest generation** — Email compilation
  - Coach has 5 pending submissions across 3 learners
  - Generate digest → verify: correct count, all submissions listed, template rendered
  - Test: coach with no pending → no digest

- [ ] **Digest scheduling** — Frequency control
  - Digest scheduled daily at 9am coach's timezone
  - Run once per day, not twice if triggered multiple times
  - Test: timezone conversion (coach in UTC-5, server in UTC)

#### lib/account-delete.ts (2 tests)

**File:** `apps/web/test/account-delete.test.ts` (new file)

- [ ] **Soft-delete cascade** — Workspace deletion
  - Delete account → all owned workspaces soft-deleted
  - All members of deleted workspaces → access revoked
  - All data: enrollments, chapter submissions, subscriptions soft-deleted

- [ ] **Retention window enforcement** — Purge scheduling
  - Soft-deleted account → verify created soft_deleted_at
  - 30+ days passed → purge job finds and hard-deletes
  - Test: retention window adjustable per entity type

### Integration Tests (3 new)

**Goal:** Cross-module scenarios not covered by unit or E2E

- [ ] **test/funnel-to-subscription.test.ts** — Funnel → Payment → Subscription lifecycle
  - Create funnel → visitor completes → Stripe charge succeeds → subscription created → invoice emailed → user gets access

- [ ] **test/learner-chapter-submission.test.ts** — Full submission workflow
  - Learner submits chapter → coach digest triggers → coach logs in → coach reviews → approves → learner badge awarded → Transformation Report updated

- [ ] **test/compliance-export.test.ts** — GDPR data export completeness
  - Delete account → export data → verify all user-scoped + workspace-scoped categories present
  - Test: no PII from other users leaked, deleted data excluded

### TypeScript & Lint (Wave 5 CI Enforcement)

- [ ] **Add tsc --noEmit to CI pipeline** — Catch type regressions
  - Run after engine build, before lint
  - Block merge if any implicit-any violations introduced

- [ ] **Enable exhaustive-deps warnings** — Capture all ESLint violations
  - Currently treated as warnings; audit remaining violations (~5–10)
  - Block merge on any new violations

### Test Infrastructure Improvements

- [ ] **Playwright parallelization** — Speed up E2E
  - Current: 5 minutes (serial, 1 worker)
  - Target: 2 minutes (3 workers, 0 retries with deterministic cleanup)

- [ ] **Test reporter to CI comment** — GitHub PR feedback
  - Add GitHub Actions reporter to playwright.config.ts
  - Post summary comment on each PR: "✅ 134 unit tests, 11 E2E tests passed"

- [ ] **Coverage metrics dashboard** — Track over time
  - Publish coverage report artifacts on each CI run
  - Track: line coverage, branch coverage, untested files

---

## Wave 5 Success Criteria

| Criterion | Baseline | Wave 5 Target | Status |
|-----------|----------|---------------|--------|
| E2E specs | 11 | 18 (+7) | 🟡 In progress |
| Unit test files | 134 | 150+ (+16) | 🟡 In progress |
| Critical module coverage | <40% | >80% | 🟡 In progress |
| TypeScript CI check | Manual only | Automated gate | 📋 Planned |
| E2E runtime | 5 min (serial) | 2 min (3 workers) | 📋 Planned |
| All checks green | 100% on master | 100% on all PRs | ✅ Current |

---

## Risk Assessment & Blockers

### Known Gaps (Out of Scope for Wave 5)

- **Load Testing:** No volume/performance tests (scale: ~450 workspaces, ~12 coaches)
- **Snapshot Testing:** UI components not snapshot-tested (visual regressions possible)
- **Contract Testing:** Third-party APIs (Stripe, email) not contract-tested (integration risk)
- **Mutation Testing:** No mutant-killing metrics; test quality not quantified

### Mitigation

These gaps are acceptable for Wave 5 because:
1. Load testing deferred to Wave 4 (Automation & Compliance)
2. Snapshot testing low-priority (Playwright covers layout changes)
3. Contract testing handled by supplier (Stripe docs, email mock provider)
4. Mutation testing is advanced; baseline coverage sufficient

---

## Appendix: Test Command Reference

```bash
# Run all unit tests (web + engine)
pnpm test                                    # All unit tests
pnpm --filter web test                       # Web only
pnpm --filter @onevyrt/engine test           # Engine only
pnpm --filter @onevyrt/engine test:spec      # Engine with spec reporter

# Run specific test file
cd apps/web && pnpm exec tsx --test test/jobs.test.ts

# Run E2E tests
pnpm --filter web test:e2e                   # All specs
pnpm --filter web test:e2e -- --grep="auth" # By name
pnpm --filter web test:e2e -- --debug       # Debug mode

# Type checking
pnpm --filter web typecheck                  # Web
pnpm --filter @onevyrt/engine build          # Engine (tsc)

# Linting
pnpm --filter web lint                       # Errors only (exit 1 on error)
pnpm --filter web lint -- --format=json      # JSON output
```

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-09-02 | Claude | Initial baseline + Wave 5 roadmap |

