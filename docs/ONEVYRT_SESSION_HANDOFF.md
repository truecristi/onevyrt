# ONEVYRT — Session Handoff (start here)

> Written so a fresh session can continue **without the chat history**.
> **Supersedes** the earlier handoff written by the access-less "watch" session (which assumed no repo access and no pushed code). This version reflects the **actual state** after the first session with full GitHub read/write.
> **Updated:** 2026-08-30

## Reality check (what changed vs. the old handoff)

The old handoff said the next session must "get access" and work from `claude/remote-control-ygviv2`, and that "no code was implemented/pushed." **That is no longer true:**

- ✅ This session has **full GitHub read + write** to `goldmanadvertising10/onevyrt`.
- ✅ The **Phase 1 engine foundation is implemented, tested, and on `master`** (commits `9d63697`, `964ccfe`).
- ✅ The four spec/handoff docs are now in git under `docs/`.
- The **working line is `master`** (and the dev branch `claude/works-f7cor7`), **not** `claude/remote-control-ygviv2`.

## Branch map

| Branch | What it is | Action |
|---|---|---|
| `master` | Production line. Has the Phase 1 engine foundation + these docs. Bluehost deploys from here. | The line to build on. |
| `claude/works-f7cor7` | This session's dev branch (== master + in-progress work). | Keep developing here; fast-forward to master when green. |
| `claude/remote-control-ygviv2` | **Separate** prior effort (PR #245): Page Check, page-aware AI, billing/security fixes, engine correctness. **Unmerged, unrelated to the restructure.** | Decide separately whether to merge; don't confuse it with this work. |
| `book` | Static content. | Ignore for this work. |

## Environment truths (this is a CLOUD session)

- This container is an isolated cloud Linux box. It has the repo cloned and can push to GitHub.
- It **cannot** reach the user's Windows machine (`C:\Users\TheKing-i7\...`) or SSH to Bluehost (`root@100.98.30.40`) — proven: no key, no route. Those steps are the user's to run; this session provides exact commands and interprets output.

## Bluehost deploy (confirmed live, 2026-08-30)

Server `100.98.30.40` runs the app in Docker: container `onevyrt-app` on `127.0.0.1:8515`, behind `onevyrt-cloudflared` (Cloudflare tunnel → `onevyrt.masteryresearch.com`), from checkout `/opt/onevyrt-src`, deployed by `deploy/deploy.sh` (migrate → build → swap → health-check → auto-rollback). Postgres (Supabase) is the datastore. Full playbook: `docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md`. **Deploy only a finished, CI-green feature; back up first.**

## What to do next — in order

1. **Finish Phase 1** (the ~55% that remains): the versioned, idempotent, transactional DB migration that (a) reshapes each stored `curriculum` blob via the engine's `reconcileToChapters()` (guarded by `schemaVersion`), (b) makes the seed canonical and stops the rewrite-on-read in `curriculum-store.ts`, (c) adds cohort pacing-audit columns and applies `remapStageAccessLimit()` preserving the original value and flagging inexact maps. Plus the DB test matrix in `ONEVYRT_IMPLEMENTATION_STATUS.md`. Get it green (typecheck, lint, tests, build) before Phase 2.
2. **Phase 2** exactly per `docs/ONEVYRT_NAVIGATION_AND_USER_FLOW.md` — build the single progress source first (§9), then Home/Programme/map/My Business/Coaching/Resources, redirects, a11y.
3. **Preserve:** lesson IDs, progress, assignments, submissions, reviews, cohorts, workbook answers, permissions, deep links. No destructive deletions.
4. **Validate → push → CI green → merge to `master`.**
5. **Deploy** per `docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md` (backup first) → run smoke tests.
6. **Update `docs/ONEVYRT_IMPLEMENTATION_STATUS.md`** after every milestone — evidence-based only.

## The docs in this set

- `ONEVYRT_NAVIGATION_AND_USER_FLOW.md` — the decision-locked Phase 2 spec (menu, map, My Business, coaching gates, resources, redirects).
- `ONEVYRT_IMPLEMENTATION_STATUS.md` — the weighted 100-point checklist + evidence-based dashboard.
- `ONEVYRT_BLUEHOST_DEPLOYMENT.md` — the deploy/rollback/smoke-test playbook (infra confirmed, `⧉ INSPECT` blanks filled).
- `ONEVYRT_SESSION_HANDOFF.md` — this file.
