# CI/CD Optimization

Audit of `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`, backed by
real timing pulled from this repo's own GitHub Actions run history (the API,
not guesses) plus local timing of the steps that are safe to run outside CI.
Every number below is either **measured** (labeled with its source) or
explicitly marked **estimate**.

## Method

- Real per-step durations: `list_workflow_jobs` on two representative runs —
  the most recent full run and the most recent one that actually went green.
- Real local timings: `packages/engine` and `apps/web`'s lint/typecheck steps
  don't need Postgres, so they were timed directly in this environment against
  the already-installed `node_modules` (warm pnpm store, no network install).
- Everything about "Production build" and "Playwright e2e" duration is an
  **estimate** — no run in the last two weeks has reached those steps (see
  below), so there is no real timing to cite yet. Measure them for real the
  first time this pipeline goes green after the fix in "Finding 2".

## Current pipeline

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` (`CI`) | push/PR to `master` (path-filtered), manual dispatch | One job, 16 sequential steps: install → dependency audit → build the `@onevyrt/engine` package → engine unit tests → web typecheck → web lint → run DB migrations against a fresh service-container Postgres → web integration tests (real DB) → production `next build` → install Playwright's Chromium → e2e + accessibility suite → upload traces on failure. |
| `deploy.yml` (`Deploy`) | `workflow_run` after `CI` completes on `master`, or manual dispatch | Joins Tailscale, SSHes into the production box, and runs `deploy/deploy.sh` (migrate → docker build → swap container → health-check → auto-rollback on failure). Gated on `github.event.workflow_run.conclusion == 'success'` for the automatic path. |

Both already have sensible concurrency control (`cancel-in-progress` on `CI`
per-ref; deploys queue rather than overlap) and `ci.yml` already skips
entirely — no job even starts — for pushes that touch only `**.md`, `docs/**`,
`deploy/**`, or `LICENSE`. That's the *good* version of "skip on docs-only
changes": a path filter on the trigger costs zero Actions minutes, versus a
step-level `if:` that still pays for checkout + install before deciding to
skip. No change needed there.

## Finding 1: one step is ~95% of the pipeline — parallelizing the rest barely moves the total

Real per-step timing from the most recent run that reached every step
(`run 32120532057`, 2026-08-18, green):

| Step | Duration |
|---|---|
| Set up job + checkout + pnpm/node setup | 12s |
| Install dependencies (warm pnpm-store cache) | 2s |
| Dependency audit | 1s |
| Build engine | 3s |
| Engine tests | 6s |
| Web typecheck | 21s |
| Run migrations | 3s |
| **Web tests (Postgres-backed)** | **27m 28s** |
| **Total job** | **28m 25s** |

(That run predates the current `lint` step and the `Production build` /
`Playwright` steps being split out the way they are today — see Finding 2 for
why no *current* green run exists to re-measure those. Local timing of the
now-current lint step, below, fills that gap.)

Locally timed just now (warm install, same versions as CI: Node 22, pnpm 10):

| Step | Local time |
|---|---|
| `pnpm --filter @onevyrt/engine build` | 3.0s |
| `pnpm --filter @onevyrt/engine test` (362 tests) | 5.2s |
| `pnpm --filter web typecheck` | 6.7s |
| `pnpm --filter web lint` (57 warnings, 0 errors) | 25.5s |

Everything before "Web tests" — install, audit, engine build+test, typecheck,
lint, migrate — sums to **under 90 seconds**, confirmed again on today's most
recent run (`run 33627163878`): 1m31s of prefix, then Web tests alone ran
24m52s before failing. Two independent runs, two weeks apart, agree to within
a few seconds on both numbers.

**This changes the optimization math.** A generic "parallelize lint + test"
plan assumes roughly balanced steps and promises big savings. Here the
imbalance is extreme: splitting the ~90-second prefix onto its own runner,
parallel to the ~27-minute Postgres job, saves **at most the size of the
prefix minus the ~20-40s of duplicated per-job overhead (checkout, pnpm/node
setup, a second `pnpm install`) that a second job now pays** — realistically
**~1 minute off a ~27-minute run (roughly 4%)**. It's still worth doing (see
"What this PR changes"), mainly because it isolates failures into their own
named check and because it sets up much bigger *relative* gains once Finding 3
is addressed — but it would be dishonest to advertise it as a 5-7 minute win
when the real bottleneck is a single step 15-25x longer than everything else
combined.

## Finding 2: master has been red for two weeks — and it's why there's no fresh timing for the back half of the pipeline

Pulled from the Actions API, not a guess:

- The 30 most recent `CI` runs against `master` (2026-08-31 through
  2026-09-02, run numbers 679-708): **29 failures, 1 cancelled, 0 successes.**
- The last run that went fully green: `run 32120532057`, 2026-08-18 — about
  two weeks before this audit.
- Correspondingly, the 30 most recent `Deploy` runs are **all `skipped`** —
  the `workflow_run.conclusion == 'success'` gate is doing exactly its job and
  refusing to auto-deploy a red `master`. That gate is working correctly and
  needs no change.
- The failure is consistent and reproducible, not flaky-random: every one of
  the sampled failing runs dies inside the **same** "Web tests" step, and the
  Postgres service log (visible in the job's own container-log dump) shows
  the same root cause each time:
  ```
  ERROR:  duplicate key value violates unique constraint "bookings_slot_unique"
  DETAIL:  Key (funnel_slug, slot_start)=(book-test_..., 2026-08-18T11:00) already exists.
  ```
  (from `apps/web/test/bookings.test.ts` or `concurrency.test.ts` — a booking
  double-slot race). See run
  [33627163878](https://github.com/goldmanadvertising10/onevyrt/actions/runs/33627163878)
  for the full trace.
- **Why a test failing 3.5 minutes in still takes 25 minutes to report:**
  `node --test` runs its entire matched file glob to completion and only
  exits non-zero at the end — it doesn't stop at the first failure. With
  `--test-concurrency=1` across 135 files / 843 tests, the one real failure
  near the start is silent for the remaining ~21 minutes while the rest of the
  suite finishes anyway. Today's pipeline gives the slowest possible feedback
  on exactly the kind of regression it exists to catch.

This is an application-test bug, not a CI-config bug, so fixing the race
itself is out of scope here — flagged separately (see "Follow-ups" below) —
but two things about *how CI behaves when this happens* are squarely in
scope and are fixed in this PR: bounding the runtime with `timeout-minutes`
(Finding 4) and making the failure visible in under a minute via job summaries
instead of requiring someone to open a 25-minute log.

## Finding 3: the real lever is `--test-concurrency`, not the workflow YAML

`apps/web/package.json`'s `test` script hard-codes
`tsx --test --test-concurrency=1 …` — fully serial. 843 tests at ~1.8s/test
average is exactly what a big serial suite against a real (if local)
Postgres instance looks like: connection setup, real inserts, real cleanup,
per test, one at a time.

The CI workflow's own comments already say the tests are designed for this
*not* to be necessary: "every DB-backed test is uid()-prefixed and
self-cleaning" (`ci.yml`), which is precisely the isolation property that
would let them run concurrently. If that's actually true across all 135 files,
raising `--test-concurrency` (2, then 4, measuring for new flakiness at each
step) is plausibly a **5-10x reduction of the single biggest line item in the
pipeline** — a 27-minute step could plausibly become 3-6 minutes.

This is **not implemented in this PR**. It's a change to application test
code and behavior (not a workflow file), it carries real correctness risk if
isolation has any gaps the "uid-prefixed" comment doesn't fully cover, and
validating it needs a real Postgres instance and a few iterations watching
for cross-test interference — none of which is available or appropriate to
do blind from a CI-config PR. It's the single highest-leverage next step and
is flagged as a follow-up task rather than guessed at here. `DATABASE_POOL_MAX`
(currently `10`) is the first thing to check before raising concurrency much
past 4-5 — more concurrent tests than pool connections just moves the
serialization from the test runner to the pool.

## Finding 4: nothing bounds a hang — default job timeout is 6 hours

Neither workflow sets `timeout-minutes` anywhere. GitHub's default is 360
minutes per job. Today's ~25-minute "Web tests" runs are within that by
luck, not by design — a genuine deadlock (the RUNBOOK's own documented risk:
"a critical section must never hold a checked-out connection and check out a
second connection from the same pool") would currently run for up to 6 hours
before GitHub kills it, burning Actions minutes and delaying the failure
signal by hours instead of minutes. Fixed in this PR (see below).

## Finding 5: production can auto-deploy independent of CI going green at all

`docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md` documents **two** live auto-deploy
paths, and this matters a lot given Finding 2:

1. **GitHub Actions** (`deploy.yml`) — gated on CI success. Correctly
   refusing to fire for two weeks, as confirmed above.
2. **The server-side poller** (`deploy/auto-deploy.sh`, installed via
   `deploy/install-autodeploy.sh`, documented as "Option A — recommended; no
   GitHub Actions minutes") — ticks every ~3 minutes and deploys whatever
   `origin/master` currently points to. **It has no concept of CI status at
   all.** If it's installed on the production host, it has been deploying
   every push to `master` for the last two weeks regardless of the test
   suite being red the entire time — `deploy/deploy.sh`'s own health check
   only verifies the app *starts and answers HTTP 200*, not that the specific
   things covered by the failing test suite are correct.

This is covered in depth, with a concrete recommendation, in
`docs/DEPLOYMENT_RUNBOOK.md`. It is the single most important "safer
deployments" finding in this audit and is a documentation/process fix, not a
workflow-file fix — there's nothing in `ci.yml` or `deploy.yml` to change for
it, since the gap is in a mechanism neither workflow controls.

## What this PR changes

### 1. Split `ci.yml` into two parallel jobs

- **`checks`** (new): install, dependency audit, build engine, engine tests,
  web typecheck, web lint. None of these touch Postgres, so this job no
  longer spins up the service container at all. Real cost: ~60-70s of step
  time.
- **`test`** (renamed from the old single job): Postgres service, build
  engine (again — ~3s of duplicated compute, trivial), run migrations, web
  tests, production build, Playwright install, e2e.

Both jobs run from the same trigger with no `needs:` between them, so total
wall-clock becomes `max(checks, test)` instead of their sum. Per Finding 1,
**expect this to save roughly 1 minute off a ~27-minute run today** — real
but modest — with the payoff growing substantially once Finding 3 lands and
`test` stops being 25x longer than `checks`. The split also gives lint,
typecheck, and audit failures their own named GitHub check instead of being a
few lines in the middle of a 25-minute job's log.

This doesn't change deploy-gating safety: `deploy.yml` triggers off the
*workflow's* overall conclusion, which is still `success` only when every job
in it succeeds — splitting into two jobs doesn't let a failing one through.

### 2. Caching

- Kept: `actions/setup-node`'s `cache: pnpm` (already caches the pnpm store
  keyed on the lockfile hash) — this is the correct pnpm caching primitive;
  it's why "Install dependencies" is already 2-10 seconds in the measured
  runs above. A separate raw `node_modules` cache would be redundant and more
  fragile (native builds for `sharp`/`esbuild`, workspace symlinks) for no
  real gain on top of a warm store, so it was deliberately not added.
- Added: `apps/web/.next/cache`, keyed on the lockfile + a hash of
  `apps/web`'s source, restore-keyed to just the lockfile hash on a partial
  miss. Standard Next.js incremental-build cache; speeds up "Production
  build" specifically. (No real before/after number yet — see "Method".)
- Added: `~/.cache/ms-playwright`, keyed on the lockfile hash (which pins the
  resolved Playwright version). `playwright install --with-deps` already
  skips re-downloading a browser binary that's already present at that path,
  so a cache hit removes the download (typically the largest part of that
  step) while the `--with-deps` apt step still runs (fast — it's a no-op
  install when the packages are already on the runner image).

### 3. Timeouts (new — addresses Finding 4)

| Scope | `timeout-minutes` | Why this number |
|---|---|---|
| `checks` job | 10 | ~20x the ~65s real total; generous, still bounds a hung install/network stall. |
| `test` job | 70 (was 45, revised 2026-09-05) | The 28min ceiling above is stale — two directly observed runs this session hit 44m40s (success) and exactly 45m16s (cancelled by this ceiling mid-e2e, not any step's own sub-timeout). 45min had stopped having headroom; 70min restores real margin over the actual ~45min total. Costs nothing extra in billed minutes (billing is by actual duration, not the ceiling) — it only stops a legitimate in-progress run being killed and forced to restart from scratch, which is the more expensive outcome. |
| `Web tests` step | 35 | ~1.3x the observed 25-28min ceiling — catches a step that's gone *beyond* its unusually-long-but-normal range, distinct from the job-level net. |
| `Production build` step | 8 | Estimate-based headroom (see Method) for a `next build` of this size. |
| `E2E …` step | 10 | Headroom over an estimated 2-5min single-worker Playwright run. |

None of these fire on a normal run, green or red-in-the-usual-way; they exist
to turn "a true deadlock silently costs 6 hours" into "a true deadlock fails
loudly in under 45 minutes."

### 4. Logging — step summaries

Both jobs get a final `if: always()` step that writes a markdown table to
`$GITHUB_STEP_SUMMARY` (each preceding step given an `id:` so its `outcome`
can be read) — so the pass/fail of every stage is visible on the run's
summary page without opening any step's log. `deploy.yml` gets the same
treatment: a summary noting the ref/commit deployed and the outcome. The
existing "upload Playwright traces on failure" artifact step is unchanged.

### 5. Deploy workflow: independent external health check

`deploy/deploy.sh` already health-checks and auto-rolls-back on the box
itself, but it only ever curls `127.0.0.1:8515` — it can't detect a DNS or
Cloudflare Tunnel problem between the public internet and the box. Added a
step that, after a successful SSH deploy, curls the *public* URL
(`https://onevyrt.masteryresearch.com/api/health?ready`) from the Actions
runner with retries, so a deploy that "succeeded" on the box but isn't
actually reachable from outside gets caught by the same workflow run instead
of by the next user complaint.

## Explicitly not done, and why

- **Not** raising `--test-concurrency` — Finding 3, needs its own
  investigation with a real database, not a blind flip in a CI-config PR.
- **Not** adding a step-level "skip if only comments changed" conditional.
  The trigger-level `paths-ignore` already covers the real version of this
  request (whole-file, zero-cost skip on non-code changes); a content-aware
  "comment-only diff" heuristic has no reliable implementation at the
  workflow-trigger level and the failure mode (silently skipping CI on a
  change that wasn't actually comment-only) is worse than the minutes it
  would save.
- **Not** touching `playwright.config.ts`'s `fullyParallel: false` /
  `workers: 1`. That's deliberate per its own comment — one browser against
  one shared dev server — and changing it is an application-test decision
  with the same validation burden as Finding 3, not a workflow tweak.
- **Not** expanding `paths-ignore` to cover `codegen/**` (one-off historical
  generator scripts at the repo root) even though it looks like a safe
  candidate — I didn't fully verify nothing in the runtime app imports from
  it, and a wrong guess there means CI silently stops covering a real change.
  Worth a follow-up once someone who knows that directory confirms it's inert.

## Follow-ups (filed separately, not part of this PR)

1. **Root-cause the `bookings_slot_unique` race** blocking `master` (Finding
   2) — it's the reason CI hasn't been green in two weeks.
2. **Investigate raising `apps/web`'s `--test-concurrency`** above 1 (Finding
   3) now that isolation is documented as already in place — the highest
   remaining leverage in this entire pipeline.
3. **Decide the auto-deploy story** (Finding 5): either make the server
   poller CI-aware (check the commit's combined status via the GitHub API
   before deploying) or consciously accept that it doesn't, and say so loudly
   in the runbook (done — see `docs/DEPLOYMENT_RUNBOOK.md`).
