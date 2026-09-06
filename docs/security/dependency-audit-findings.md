# Dependency audit findings

Per README "Migration and hardening" (extended, Phase 9) -> "Add
dependency and secret scanning to CI", one of ADR-0022's own "before any
real launch" recommendations. This document is the honest record of
what `pnpm audit` found the first time it was actually run against this
repository, and what's been done about it versus tracked as follow-up.

**This is not a clean bill of health.** The point of adding scanning is
to surface real findings, not to wait until the tree is clean to turn it
on - see "Why this isn't a blocking CI gate yet" below.

## Summary (as of this review, 2026-09-06)

`pnpm audit --audit-level=low`: **33 vulnerabilities** - 1 critical, 12
high, 18 moderate, 2 low - across three packages, all transitive:

| Package       | Current                | Needs       | Severity range      | Production or dev dependency                                        |
| ------------- | ---------------------- | ----------- | ------------------- | ------------------------------------------------------------------- |
| `next`        | `^14.2.15`             | `>=15.5.21` | low - high (18)     | **Production** (`apps/web`)                                         |
| `drizzle-orm` | `^0.36.1`              | `>=0.45.2`  | high (1)            | **Production** (`apps/web`, `packages/database`, `packages/domain`) |
| `postcss`     | (via next)             | `>=8.5.23`  | moderate - high (4) | Production, transitive via `next`                                   |
| `vite`        | (via vitest)           | `>=6.4.3`   | moderate - high (3) | Dev only (test runner)                                              |
| `esbuild`     | (via vite/drizzle-kit) | `>=0.25.0`  | moderate (1)        | Dev only (test runner, migration tooling)                           |
| `vitest`      | `^2.1.4`               | `>=3.2.6`   | **critical** (1)    | Dev only (test runner)                                              |

## The critical finding, read carefully

The one **critical** advisory is in `vitest`: "When Vitest UI server is
listening, arbitrary file can be read and executed"
(GHSA-9crc-q9x8-hgqq class of issue). This repository never runs
`vitest --ui` anywhere - not in `pnpm test`, not in CI, not in any
package's scripts (`grep -r '"test"' packages/*/package.json` shows
plain `vitest run` everywhere). The vulnerable code path is never
exercised. Flagging that explicitly rather than let the word "critical"
stand unexplained - the actual exposure here is effectively nil, not
because the finding is wrong, but because the vulnerable feature isn't
used.

## What each remaining package needs, and why it's not fixed in this PR

- **`next` 14 -> 15**: an actual major-version upgrade, not a patch bump.
  Next.js 15 changed several APIs this codebase may depend on (dynamic
  APIs like `cookies()`/`headers()`/route `params` becoming asynchronous
  being the best-known one). Given how much of `apps/web` is App Router
  route handlers, this needs its own dedicated slice with the full
  verification gate plus a real pass over every route handler, not a
  version bump folded into a CI-tooling PR. Tracked as follow-up work.
- **`drizzle-orm` 0.36 -> 0.45**: the SQL-injection advisory
  (GHSA-r6vm-h7q9-hh4m class - improperly escaped SQL identifiers) is
  real and matters, but drizzle-orm's pre-1.0 versioning has carried
  breaking changes across minor versions before; jumping nine minor
  versions needs the same dedicated-slice treatment as `next`, since it
  touches every schema and query file in `packages/database`,
  `packages/domain`, and `apps/web`. Tracked as follow-up work.
- **`postcss`**: resolved automatically once `next` is upgraded (it's
  next's own transitive dependency).
- **`vite`/`esbuild`/`vitest`**: dev-only tooling. Lower urgency since
  none of it ships to production or runs against untrusted input in this
  repo's own usage, but bumping `vitest` to 3.x is worth doing on its own
  merits soon (closes the critical finding outright, and `vite`/`esbuild`
  come along as its own transitive dependencies) - also tracked as
  follow-up rather than rushed into this PR alongside the CI wiring
  itself.

## Why this isn't a blocking CI gate yet

The new `security-scan` job's `pnpm audit` step is deliberately
`continue-on-error: true` - it runs on every push and is visible in the
Checks tab, but doesn't fail the PR. Turning that off is next after the
`next`/`drizzle-orm` upgrades above land and the audit is actually clean;
until then, making it blocking would fail every PR on findings nobody
has triaged yet, defeating the point of separating "we now scan for
this" from "we've fixed everything scanning found." The secret-scanning
half of the same job (gitleaks) has no such carve-out - it found nothing
against the current repository history, so it's a real, immediate,
blocking gate from this PR onward.

## Also needed, and not something a workflow file can turn on

GitHub's native Dependabot security alerts and secret-scanning/push
protection are repository _settings_, toggled under Settings -> Code
security, not something `dependabot.yml` or a CI job can enable via a
committed file - this session has no admin API access to the
repository's settings to flip them from here. `dependabot.yml` (added
alongside this document) configures Dependabot's _version-update_ PRs,
which works regardless, but the repository owner should also turn on
native Dependabot alerts and secret-scanning/push protection in the
GitHub UI for the belt-and-suspenders coverage those provide on top of
this CI job.

## Verification

- `pnpm audit --audit-level=low --json` run directly, findings above
  transcribed from its actual output (`grep`/`python3` summarization,
  not estimated).
- `gitleaks detect --source . --redact -v` run locally against the full
  222-commit history of this repository: "no leaks found" - confirmed
  before wiring the same command into CI as a blocking step, so the
  first real run in CI isn't a surprise.
- Confirmed via `grep` that no package in this repository invokes
  `vitest --ui` anywhere in its scripts, which is what the critical
  finding's vulnerable code path requires.
