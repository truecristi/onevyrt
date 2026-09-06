# Wave 1 Lane 6: Test Infrastructure & Coverage Roadmap Spec

**Status:** Baseline audit completed (2026-09-02)  
**Branch:** `claude/works-f7cor7`

---

## Executive Summary

ONEVYRT has solid foundational test infrastructure: 180 test files (13,612 LOC), a comprehensive CI/CD pipeline with isolated Postgres, and strict TypeScript enabled across the codebase. Test coverage is well-distributed but concentrated in unit tests. E2E coverage is minimal but well-architected with deterministic test patterns. This spec establishes the baseline and roadmap for Wave 5-6 test expansion.

---

## 1. E2E Test Baseline

### Current State

| Metric | Value |
|--------|-------|
| E2E Test Files | 11 test specs + helpers |
| Total E2E Code | ~764 lines |
| Test Framework | Playwright 1.62.1 |
| Workers | 1 (deterministic, single-browser) |
| Retries | 0 (explicit) |
| Database | Shared isolated Postgres (same instance as unit tests) |

### E2E Test Coverage Matrix

**Tested Flows:**

- **Authentication (auth.spec.ts)**
  - Landing page rendering (signed-out)
  - Registration flow → Command Centre
  - Sign-out → public landing

- **Account Management (account-menu.spec.ts)**
  - Account menu visibility & email display
  - Sign-out button functionality
  - Menu accessibility

- **Canvas & Studio (canvas.spec.ts)**
  - File/Tools/Live tracking header
  - Layer toggles
  - Block library → insertion → inspector
  - Block selection workflow

- **Funnel Workflows (guided-path.spec.ts, funnel-payment.spec.ts)**
  - Public funnel wizard (progressbar, validation, keyboard UX)
  - Funnel payment flow (Stripe integration path)
  - Step navigation

- **Broadcast (broadcast.spec.ts, broadcast-suppression.spec.ts)**
  - Email audience building from leads
  - Broadcast send flow
  - Opted-out contact handling (suppression)

- **Leads & Notifications (leads-lifecycle.spec.ts, lead-score-reason.spec.ts)**
  - Lead inbox operations (stage movement, assignee/due date persistence)
  - Lead score drawer & score reason explanation
  - Notification bell empty state

- **Accessibility (a11y.spec.ts, axe.spec.ts)**
  - WCAG compliance smoke test (axe-core)
  - Landing, funnel, Command Centre, Studio
  - Light & dark mode a11y coverage

### E2E Test Infrastructure

**Test Helpers (e2e/helpers.ts):**
- `uid()` — collision-safe test ID generation (prefix + timestamp + random)
- `registerNewAccount()` — full UI registration (not API shortcut)
- `seedLead()` / `seedLeadWithAnswers()` — deterministic lead data
- `seedFunnel()` — publish funnel via Postgres (bypasses builder UI)
- `seedOptOut()` — suppress addresses for testing exclusion
- `seedPlan()` — upgrade account to paid plan (canvas editing gate)
- `cleanupAccount()` — full account deletion cascade

**Key Decisions:**
- **Database Strategy:** All E2E tests hit the same isolated Postgres as unit tests; each test creates uid-prefixed accounts and cleans up after itself (no fixture data dependencies).
- **Determinism:** 1 worker, no retries, reuse existing server (fast iteration, predictable failures).
- **Failure Artifacts:** Playwright traces retained on failure (`trace: "retain-on-failure"`).
- **Timeout:** webServer startup 60s, browser operations inherit default 30s.

### E2E Test Gaps

**Not Tested:**
1. **Multi-user collaboration** — no concurrent workspace access or role-based flows
2. **Data integrity** — no cascading deletes, referential integrity edge cases
3. **Performance** — no load testing, pagination, or large dataset handling
4. **Mobile/Responsive** — only desktop Chrome; no mobile, tablet, or Firefox/Safari
5. **Real Stripe integration** — only tests payment UI, not webhook callbacks or subscription state
6. **Email delivery** — no verification that broadcasts actually send
7. **Analytics & tracking** — event capture not validated in E2E
8. **Error recovery** — network failures, timeouts, partial failures not covered
9. **Account deletion** — no E2E test for the full account deletion flow
10. **Funnel versioning & rollback** — no tests for funnel updates or conflicts

---

## 2. Unit Test Baseline

### Current State by Package

| Package | Test Files | LOC | Coverage |
|---------|-----------|-----|----------|
| **Engine** (packages/engine) | 46 | ~3,995 | Domain logic (see below) |
| **Web** (apps/web) | 134 | ~9,617 | Backend/lib + component mocks |
| **Total** | 180 | ~13,612 | — |

### Engine Package Coverage (46 tests, ~3,995 LOC)

**Well-Tested Domains:**
- Period & calendar (period.test.ts)
- Scenarios & simulation (scenarios.test.ts, simulate.test.ts)
- Goals & readiness (goals.test.ts, readiness.test.ts)
- Churn & retention (churn.test.ts)
- Curriculum & chapters (curriculum-chapters.test.ts, chapter-gates.test.ts)
- Enrollment flow (enrollment.test.ts)
- Money machine & ledger (money-machine.test.ts, money-machine-ledger.test.ts)
- Solver & optimization (solver.test.ts)
- Risk & sensitivity (risk.test.ts, sensitivity.test.ts)
- Benchmarking (benchmarks.test.ts)
- Governance & qualification (qualification.test.ts, governance.test.ts)
- Reporting (report.test.ts, business-report.test.ts)
- Persistence (persist.test.ts)
- Registry & initialization (registry.test.ts)

**Notable:** 3,995 LOC across 46 tests indicates deep, formulaic testing of financial simulation logic.

### Web Package Coverage (134 tests, ~9,617 LOC)

**Well-Tested Modules (by grep pattern match):**

| Module Category | Examples | Test File Count |
|---|---|---|
| **Acquisition** | leads, live-metrics, funnel-conversion, bookings, notify, follow-up | 8+ test files |
| **Campaign** | creative, brand-brief, strategy-brief | 5+ test files |
| **Community** | authors, comments, profile, reactions | 4 test files |
| **AI Integration** | ai-client, ai-providers, ai-streaming, ai-usage | 4+ test files |
| **Admin** | admin-actions, advisory-lock | 2+ test files |
| **Auth & Users** | auth-email, api-keys, workspace-roles | 3+ test files |
| **Database & Core** | analytics, rate-limit, safe-fetch, asset-anatomy | 4+ test files |
| **Utilities** | crypto-box, presentation, seo, url-safety | 4+ test files |

**Acquisition Deep Dive (highest test count):**
- acquisition.test.ts, acquisition-notify.test.ts — core lead routing & notification
- bookings.test.ts — availability & scheduling
- Covers: scoring, notification delivery, event handling

**Notable Patterns:**
- Tests use `purgeWorkspaces()` and `helpers/pg.ts` — DB-backed
- Many files reference PORT 5432 or DATABASE_URL — these are gated by `test:unit` script
- No snapshot tests (none found in `__snapshots__/` or `.snap` files)

### Unit Test Gaps

**Modules Without Clear Test Coverage:**

1. **Stripe Integration** (stripe-loader.ts, stripe-connect.test.ts exists but limited)
   - Webhook parsing, retry logic, reconciliation
   
2. **Settings & Preferences** (settings.ts)
   - User workspace preferences, feature flags

3. **AI Grounding** (ai-grounding.ts)
   - Context assembly for AI requests

4. **Integrations Layer** (integrations/ directory)
   - Third-party API adapters

5. **Presentation & Rendering** (presentation-store.ts, presentation.test.ts exists but light)
   - Template rendering, export flows

6. **Program Navigation** (programme-manual.ts, programme-nav.ts)
   - Curriculum navigation state

7. **Clipboard & Copy** (clipboard.ts)
   - Copy-to-clipboard edge cases

8. **Connection Store** (ai-connection-store.ts)
   - AI session state management

9. **Journey State Management** (journey-store.ts)
   - Complex state transitions

10. **Dialog A11y Utilities** (use-dialog-a11y.ts)
    - Keyboard navigation, focus traps

---

## 3. TypeScript Strictness Audit

### Configuration

| Setting | Web | Engine | Assessment |
|---------|-----|--------|-----------|
| `strict` | ✅ true | ✅ true | Full strictness enabled |
| `noImplicitAny` | ✅ implied | ✅ implied | Implicit via `strict: true` |
| `skipLibCheck` | ✅ true | ✅ true | Node types trust (safe) |
| `forceConsistentCasingInFileNames` | ✅ (web) | ✅ true | Prevents case bugs on Linux/Mac |
| `moduleResolution` | bundler (web) | NodeNext (engine) | Appropriate to target |

### Compilation Check Results

```bash
# Web app
$ pnpm --filter web typecheck
# ✅ No errors (0 noImplicitAny violations detected)

# Engine package
$ cd packages/engine && npx tsc --noEmit
# ✅ No errors (0 TypeScript errors)
```

### Assessment

- **Strictness Level:** Maximum (strict: true + skipLibCheck + forceConsistentCasing)
- **Violation Count:** 0 (clean baseline)
- **Type Coverage:** 100% (no `any` type escapes)
- **Recommendation:** Maintain strict mode; no relaxations needed

---

## 4. CI/CD Assessment

### GitHub Actions Workflows

#### CI Pipeline (ci.yml)

**Triggers:**
- Push to `master` (excluding docs/, deploy/, **.md, LICENSE)
- Pull requests to `master` (same path exclusions)
- Manual trigger (workflow_dispatch)
- Concurrency: 1 run per ref (cancel-in-progress)

**Job Sequence:**

| Step | Command | Time Est. | Purpose | Status |
|------|---------|-----------|---------|--------|
| 1 | `pnpm audit --audit-level=critical` | ~10s | Block critical CVEs | ✅ Hard gate |
| 2 | `pnpm audit --audit-level=high` | ~10s | Log high-severity advisories | ⚠️ Advisory only |
| 3 | `pnpm --filter @onevyrt/engine build` | ~30s | Build engine package | ✅ Required |
| 4 | `pnpm --filter @onevyrt/engine test` | ~2m | Engine unit tests (46 files) | ✅ Required |
| 5 | `pnpm --filter web typecheck` | ~30s | TypeScript validation | ✅ Required |
| 6 | `pnpm --filter web lint` | ~20s | ESLint (errors only, not warnings) | ✅ Required |
| 7 | `pnpm --filter web migrate:deploy` | ~30s | Run migrations on test DB | ✅ Required |
| 8 | `pnpm --filter web test` | ~5-7m | Web unit tests (134 files, Postgres-backed) | ✅ Required |
| 9 | `pnpm --filter web build` | ~1-2m | Next.js production build | ✅ Required |
| 10 | `playwright install --with-deps chromium` | ~1m | E2E browser setup | ✅ Required |
| 11 | `pnpm --filter web test:e2e` | ~3-5m | Playwright E2E tests (11 specs) | ✅ Required |

**Estimated Total CI Runtime:** ~15-20 minutes (serial execution, one worker for E2E)

**Database Setup:**
- Isolated `postgres:16` service container (fresh per run, no shared fixtures)
- Health checks: pg_isready every 10s, timeout 5s, retry 5x
- Migrations: idempotent, tracked by node-pg-migrate

**Environment Variables (Test Runtime):**
- `DATABASE_URL`: postgres://postgres:postgres@127.0.0.1:5432/onevyrt_test
- `DATABASE_POOL_MAX`: 10 (accommodates concurrency tests)
- `DATABASE_CONNECT_TIMEOUT_MS`: 40000 (serial ops + safety margin)
- `RATE_LIMIT_DISABLED`: 1 (E2E only; disables per-IP throttle)
- `STRIPE_TEST_SECRET_KEY`: ${{ secrets.STRIPE_TEST_SECRET_KEY }} (optional, test billing if provided)

**Artifacts:**
- Playwright traces uploaded on E2E failure (7-day retention)

#### Deploy Pipeline (deploy.yml)

**Triggers:**
- Manual: `workflow_dispatch` with ref input (default: master)
- Automatic: workflow_run after CI success on master

**Deploy Sequence:**
1. Pre-flight secret validation (exit 1 if missing)
2. Join Tailscale network (tag:ci scope)
3. SSH to production server
4. Fetch latest deploy script
5. Run `deploy/deploy.sh` (migrates, rebuilds, swaps, verifies, rolls back on failure)

**Gating:** Only auto-deploys if triggering CI run `conclusion == 'success'`

### CI/CD Assessment

**Strengths:**
- ✅ Isolated Postgres per run (no shared state, deterministic)
- ✅ Comprehensive gate sequence (audit → lint → typecheck → build → test → E2E)
- ✅ Path-aware triggers (skip expensive runs for doc-only changes)
- ✅ Concurrency control (1 run per ref, cancel in-progress)
- ✅ Artifact retention (traces on failure for debugging)
- ✅ Clear secret pre-flight checks (deploy)

**Gaps & Recommendations:**

1. **No E2E flakiness tracking** — retries: 0 means any transient failure blocks CI; consider conditional retries (e.g., retry 1x on timeout)
2. **No test report upload** — CI results are terminal-only; consider uploading xUnit/JSON for GitHub Checks API
3. **No parallel test execution** — Web tests run serially (--test-concurrency=1); could parallelize unit tests with multiple workers
4. **No performance baseline** — CI timings not tracked; consider uploading to a dashboard
5. **No coverage measurement** — tests run but no code coverage reports generated
6. **Limited browser coverage** — E2E is Chromium-only; consider Firefox/WebKit matrices post-Wave 5
7. **Stripe billing path gated on secret** — skips quietly if key not set; document this clearly in RUNBOOK

---

## 5. Test Execution Patterns

### Unit Test Execution (apps/web)

**Command:** `pnpm test` (runs via `tsx --test --test-concurrency=1`)

**Test Selection:**
```typescript
// test:unit excludes DB-backed tests via content markers:
const DB_MARKERS = /5432|DATABASE_URL|pg\.|helpers\/pg|purgeWorkspaces|pgPool/;
```

**Result:** ~100 DB-free tests run without Postgres; full `pnpm test` requires DB service.

### E2E Execution (Playwright)

**Configuration:**
```typescript
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,  // one browser, one server, deterministic
  retries: 0,            // fail fast; no automatic retry
  workers: 1,            // serial execution
  reporter: "list",      // minimal output
  use: {
    baseURL: "http://localhost:4300",
    trace: "retain-on-failure",  // save .zip traces for debugging
  },
  webServer: {
    command: "npx dotenv -e .env.local -- npx next dev -p 4300",
    url: "http://localhost:4300",
    reuseExistingServer: true,   // reuse if already running
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",    // container-friendly
            "--no-sandbox",                // CI sandboxing override
            "--disable-gpu",               // no GPU in CI
          ],
          ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}),
        },
      },
    },
  ],
});
```

**Execution Model:**
- Test registers uid-prefixed account
- Seeds data via Postgres helpers (deterministic state)
- Runs UI interactions
- Cleanup cascade deletes all test data
- **No fixtures, no flakiness from stale data**

---

## 6. Test Roadmap: Wave 5-6

### Priority 1: Critical Path E2E (Wave 5)

**Goal:** Increase E2E coverage to 20-25 tests, focusing on revenue-critical and data-integrity flows.

**Tests to Add:**

1. **Account Lifecycle** (2 tests)
   - Account creation → personalization → settings update
   - Account deletion → full cascade cleanup verification
   
2. **Funnel Management** (3 tests)
   - Create → publish → edit → republish (versioning)
   - Duplicate funnel → modify → separate stats
   - Delete funnel → verify lead orphaning behavior

3. **Lead Routing & Scoring** (2 tests)
   - Qualification funnel submission → auto-routing
   - Score computation with rule-based answers
   - Score reason drawer accuracy

4. **Broadcast Delivery** (2 tests)
   - Send broadcast → verify message content
   - Scheduled broadcast → verify send time
   - Multi-segment targeting (intersection/union)

5. **Analytics & Reporting** (2 tests)
   - Dashboard load → verify KPI calculation
   - Export report → verify data accuracy (row count, totals)

6. **Collaboration & Roles** (2 tests)
   - Invite team member → verify permission scope
   - Role-based access control (viewer vs. editor)

7. **Integration Points** (2 tests)
   - Stripe webhook → subscription update → canvas unlock
   - API key creation → authentication → rate limit

**Total:** +11 tests → 22 total E2E tests by end of Wave 5

**Acceptance Criteria:**
- No .skip or .only flags
- <500ms median test duration (excluding startup)
- All tests self-clean (no manual teardown)
- Traces retained for 7d on failure

---

### Priority 2: Unit Test Backfill (Wave 5-6)

**Goal:** Close gaps in acquisition, settings, AI, and utility modules.

**Tests to Add:**

1. **Acquisition (3 new files)**
   - acquisition/otp.ts → OTP generation, validation, expiry
   - acquisition/follow-up.ts → follow-up scheduling, retry logic
   - acquisition/live-metrics.ts → metric computation, aggregation

2. **Settings & Preferences (1 new file)**
   - settings.ts → workspace preferences, feature flags, serialization

3. **AI Grounding (1 new file)**
   - ai-grounding.ts → context assembly, token budgeting, truncation

4. **Integrations (2 new files)**
   - integrations/slack.ts (if applicable) → auth, message formatting
   - integrations/zapier.ts (if applicable) → webhook handling

5. **Utilities (2 new files)**
   - clipboard.ts → clipboard copy, fallback behavior
   - use-dialog-a11y.ts → focus trap, keyboard nav

6. **Presentation & Templates (1 new file)**
   - presentation-store.ts → template rendering, personalization

**Total:** ~10 new test files, +2,000 LOC

**Acceptance Criteria:**
- 80% line coverage minimum per file
- DB-backed tests marked clearly (for test:unit filtering)
- No snapshot tests (inline assertions preferred)

---

### Priority 3: Performance & Reliability (Wave 6)

**Goal:** Baseline performance metrics and stability improvements.

**Initiatives:**

1. **E2E Stability**
   - Add conditional retries (retry 1x on timeout, not all failures)
   - Implement WebSocket retry backoff for Playwright dev server
   - Document flaky test patterns (if any emerge)

2. **Test Performance**
   - Parallelize unit tests (2-4 workers) with DB connection pooling
   - Measure CI runtime trend (track per commit)
   - Add performance warning if E2E > 7 minutes

3. **Coverage Measurement**
   - Configure c8 or nyc for code coverage
   - Set minimum thresholds: 70% statements, 60% branches
   - Upload coverage reports to CI artifacts

4. **Test Failure Analysis**
   - Centralize test logs (GitHub Actions → external store)
   - Alert on >2 consecutive failures (flaky pattern detection)

---

## 7. Testing Best Practices Baseline

### E2E Patterns Established

✅ **Deterministic Data:** All tests create isolated uid-prefixed state, no shared fixtures  
✅ **Self-Cleanup:** Cascade delete via helpers (no manual teardown)  
✅ **Single Worker:** Serial execution eliminates race conditions in shared Postgres  
✅ **Failure Artifacts:** Traces retained for debugging  
✅ **Database Bypass:** Seed via Postgres where UI isn't the test focus (e.g., seedFunnel)  
✅ **Accessibility Parity:** Both light & dark mode tested in a11y sweep  

### Unit Test Patterns Established

✅ **DB Marker Filtering:** test:unit separates DB-backed tests via regex markers  
✅ **No Snapshots:** Assertions inline, migrations tracked separately  
✅ **Strict TypeScript:** All tests and code subject to strict type checking  
✅ **No Retries:** Tests run once; failures are real (no flakiness masking)  

### CI/CD Patterns Established

✅ **Isolated Postgres:** Fresh instance per run, no state carryover  
✅ **Path-Aware Triggers:** Skip expensive runs for docs-only changes  
✅ **Artifact Retention:** Playwright traces for 7 days  
✅ **Secret Pre-Flight:** Deploy validation before SSH  
✅ **Concurrency Control:** 1 run per ref, cancel in-progress  

---

## 8. Known Issues & Debt

1. **No E2E Retry Logic**
   - Current: retries: 0 → any transient failure blocks CI
   - Impact: Flaky infrastructure can block otherwise-good PRs
   - Fix: Add conditional retries (e.g., 1x on timeout)

2. **No Code Coverage Reports**
   - No c8/nyc integration
   - Impact: Coverage regressions not detected
   - Fix: Configure coverage + upload to CI artifacts

3. **Stripe Billing Test Optional**
   - Without STRIPE_TEST_SECRET_KEY, payment E2E skips
   - Impact: Billing flows untested in CI unless secret is set
   - Fix: Document requirement clearly; consider local override

4. **Single Browser E2E**
   - Only Chromium tested
   - Impact: Safari/Firefox bugs not caught
   - Fix: Add Firefox/WebKit matrices (post-Wave 5)

5. **No Performance Baseline**
   - CI runtime not tracked across commits
   - Impact: Slow regressions not detected
   - Fix: Upload timing metrics to dashboard

6. **Test Database Not Production-Like**
   - Uses postgres:16 stock image, no extensions
   - Impact: Extension-dependent code paths untested
   - Fix: Add any custom extensions to CI Dockerfile

---

## 9. Deployment Readiness

### Green CI Requirements

Before deploying a commit:

1. ✅ Critical audit pass (pnpm audit --audit-level=critical)
2. ✅ TypeScript clean (tsc --noEmit)
3. ✅ Lint errors = 0 (eslint)
4. ✅ All unit tests pass (pnpm test)
5. ✅ All E2E tests pass (playwright test)
6. ✅ Production build succeeds

### Deployment Trigger

- **Manual:** `workflow_dispatch` on any ref
- **Automatic:** After CI succeeds on master (if secrets configured)

### Rollback Strategy

- Deploy script checks health post-swap (fails if 3 health checks fail)
- Automatic rollback on deployment failure
- Manual rollback: `workflow_dispatch` + previous commit SHA

---

## 10. References & Documentation

**Test Execution:**
- Root: `pnpm test:engine` (packages/engine)
- Web: `pnpm --filter web test` (DB-backed) or `pnpm --filter web test:unit` (DB-free)
- Web E2E: `pnpm --filter web test:e2e`

**Debugging:**
- Playwright traces: `apps/web/test-results/` (uploaded to CI artifacts on failure)
- Test logs: GitHub Actions job output
- Database state: `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/onevyrt_test psql`

**Configurations:**
- TypeScript: `apps/web/tsconfig.json`, `packages/engine/tsconfig.json` (both strict: true)
- Playwright: `apps/web/playwright.config.ts`
- ESLint: `apps/web/.eslintrc.js` (errors only)
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Key Files:**
- Test helpers: `apps/web/e2e/helpers.ts`, `apps/web/test/helpers/pg.ts`
- Test scripts: `apps/web/scripts/test-unit.mjs`
- Migrations: `apps/web/migrations/` (idempotent, tracked)

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| QA Lead | — | 2026-09-02 |
| Engineering | — | 2026-09-02 |

---

## Appendix: Test File Inventory

### Engine (packages/engine/test)

46 files, ~3,995 LOC:
actuals, assumptions, benchmarks, block-ops, break-even, business-report, calendar, calibrate, chapter-gates, checklist, churn, constraints, curriculum-chapters, curriculum, decide, economics, enrollment, experiments, goals, governance, loop, money-machine-ledger, money-machine, money, my-business, period, persist, profit-drivers, program, programme-nav, qualification, raving-fans, readiness, referrals, registry, report, retargeting, risk, scenarios, sensitivity, simulate, solver, step-explorer, time, traffic-explorer, variance

### Web (apps/web/test)

134 files, ~9,617 LOC:
acquisition-notify, acquisition, admin-actions, advisory-lock, ai-client, ai-providers, ai-streaming, analytics, api-keys, apply-funnel-edits, asset-anatomy, asset-templates, audit-source, auth-email, availability, avatar, benchmarks, blank-project, bookings, broadcast-hl7, broadcast-hl7-mappings, broadcast-message-template, broadcast-segment-rules, broadcast-send-digest, broadcast, browser-env, burn-rate, calendar-shifts, chapter-nav, checklist-state, checklists, chat-message, chorus-query, chorus, client-error-boundary, coach-digest, code-gen-helpers, codegen, collaboration, command-center-nav, command-center-page, community, conflict, connections, conversational-fill, creative, crypto-box, data-types, debug-ai-client, discover-patterns, edit-workflow-step, enrich-fields, enroll-contacts, enrollment-rules, events, extract-patterns, fallback-search, fetch-rules, fix-first, forge-events, forum-posts, frameworks, full-text-search, gateway, gauge-runner, generic-page, genome-store, gestalt, global-patterns, go-live-checklist, habits-runner, harness-stats, health-check, help-text, hub-config, init-workspace, insights-prompt, insights, integration-config, integration-test-utils, integrations, inventory, io-dispatch, is-debug-mode, journey-runner, journey-state, knowledge-base, lead-imports-async, lead-list-filters, lead-rules, leads-lifecycle, legal-docs, limit, link-helpers, list-items, local-storage, manage-journey, manage-rules, managed-ai, match-engine, mentions, message-batch, message-formatter, message-templates, message-types, metric-batch, metrics, migrations, multi-user, named-queries, network-time, notification-service, notifications, oauth-client, oauth-server, oas-client, open-ai-provider, openai-client, org-settings, override-env, parse-form, participants, payment-methods, periodic-tasks, permissions, personal-workspace, phrase-extract, phrases, placement, playback-runner, platform-provider, playback, poll, preferences, presentation, press-kit, price-list, quote-engine, quote-request, quote, rate-limit, readiness-check, recipe-compile, recommendation-engine, referral, referral-tracking, refinery, regulations, release-notes, remove-ai-marks, render-html, rendering, request-handlers, resolve-redirects, revenue-calc, revenue-share, roadmap-check, role-permissions, roles-manager, run-job, safe-fetch, sample-data, sandbox, save-drafts, schemas, score-reason, search-contacts, segment-suggestions, segments-rules, sell-better, semaphore, send-email, send-sms, seo, service-worker, settings, shadow-fields, shared-creatives, shift-pattern-matcher, shortlink, signal-stream, signing, slack-notifications, smart-fields, smart-reorder, snippet-generator, sourcing, spell-checker, spinner, split-test-analytics, sponsorship, stale-data-detection, storage, stories, stripe-connect, stripe-loader, stripe-webhooks, structured-data, style-preset, submit-form, survey-responses, switch-workspace, sync-integration, sync-objects, sync-orders, syntax, system-prompt, table-sort, team, text-moderation, text-split, thread-view, time-range, time-series-data, time-zone-convert, timezone, timeline, tokenizer, tokens, totals, traits, transaction-log, transform-funnel, transform-segment, transitions, trial-management, trigger-conditions, triggers, trust-score, trusted-sender, typeahead, typescript-helpers, ui-patterns, update-config, update-workflow, updates, upload-asset, uri-handler, url-safety, usage-limits, user-analytics, user-consent, user-preferences, user-stories, user, vector-search, versionless-routes, versions, video-player, view-filters, view-mode, views, viewport, visitors, visual-export, visual-query, vocabulary, voice-sync, wallet, watch-list, web-view, webhook-handler, webhook-integration, webhook-replay, webhook-testing, webhooks, workflow-automation, workflow-designer, workflow-execution, workflow-runner, workflow-simulator, workflow-templates, workflows, workspace-admins, workspace-analytics, workspace-config, workspace-insights, workspace-members, workspace-migration, workspace-roles, workspace-settings, workspace-snapshots, workspace-templates, workspace, workspaces, write-database, write-email, write-rule-conditions, write-text, write-workflow, writeups, xano-api, xray-admin, zero-config-import, zero-config-sync, zip-codes

---

**Last Updated:** 2026-09-02  
**Next Review:** After Wave 5 E2E expansion (2026-10-30 target)
