# ONEVYRT — Audit Remediation Progress

> Living ledger of what has been fixed against the audit, and what is next.
> Read this first when resuming audit work so you know where we are.
>
> - **Source-of-record audit:** [`docs/onevyrt-product-ux-audit.md`](./onevyrt-product-ux-audit.md) (original, 21 Aug 2026).
> - **Independent re-audit (post-hardening):** published Artifact — scorecard, 61 findings across 9 dimensions, prioritized roadmap. (Ask the owner for the `claude.ai/code/artifact/...` link; it reflects the app *after* this cycle's fixes.)
> - **Branch:** `claude/remote-control-ygviv2` → PRs to master. Deploy is via the owner's push-to-master auto-deploy (`deploy/AUTODEPLOY.md`); the sandbox cannot deploy.

Last updated: 23 Aug 2026.

---

## Done — shipped this remediation cycle

Each landed as its own commit on `claude/remote-control-ygviv2`, typechecked, linted, and tested.
Full local CI is green: engine 316/316 · web unit **740 passed** (1 skipped, needs a live Stripe test key) · typecheck 0 · lint 0 · prod build ✓ (150/150 pages) · **e2e 23/23**.

### P0 — launch blockers
- **Billing: no lost upgrades.** `stripe-billing` webhook marks an event processed only *after* the plan change is durable. Regression test asserts a failed apply leaves the event un-marked so Stripe's retry still works. `app/api/webhooks/stripe-billing/route.ts`.
- **Tenancy: scope `stripe_events` + auth the read.** Migration adds `workspace_id`; the receiver attributes each event (client_reference_id / metadata); the cap is per-workspace; `GET /api/webhooks/stripe` now requires a signed-in member and returns only that workspace's aggregates; admin keeps an instance-wide view via `listAllStripeEvents()`. Isolation test.
- **Paid funnel can be turned on.** "Charge a fee" card in the funnel editor writes `doc.payment` (price/currency/label/description), gated on Stripe Connect status. Compile-through test. `app/business/funnels/page.tsx`.

### P1
- **Dark-mode contrast (was invisible to CI).** Studio `ACCENT` is now theme-aware `var(--accent)`; white-on-accent buttons use a fixed dark green (`ACCENT_SOLID` / `--ds-brand-solid`); dark `--dim` nudged to clear AA. **axe now scans dark mode + the Command Centre**; all 6 surfaces gate strictly.
- **Read-only canvas** enforced at the ReactFlow level (`nodesDraggable`/`nodesConnectable`/`deleteKeyCode` gated on `canEdit`), not 30 scattered guards.
- **Misdirected flows fixed.** AI-key card added to `/campaign-studio/connections` so "Connect AI →" lands somewhere usable; Execution "Broadcast" points at `/business/segments`.
- **Rate limiter fails closed** — degrades to the in-memory bound on DB error instead of a full open window.

### Further audit items
- **SSRF** in the site scanner closed — manual redirects, re-validated per hop, hop cap. 4 tests. `app/api/campaign-studio/scan-site/route.ts`.
- **A11y** — mobile nav tabs + all icon-only close/remove buttons now have accessible names.
- **Funnel UX** — draft/publish split, per-row publish/unpublish, **Delete**, wizard progress bar reaches 100% (aria + fill).
- **Workspace currency** — `lib/studio/currency.ts`; break-even no longer hardcoded USD; persisted with a picker.
- **DB TLS** — production can opt into real cert verification via `DATABASE_CA_CERT[_PATH]` / `DATABASE_SSL_REJECT_UNAUTHORIZED`; non-breaking default. Tests.
- **`/dev/ui`** gated to non-prod (server gate + client Showcase).
- **Connections page** re-branded off the off-brand indigo to brand green.
- **`/welcome`** fabricated "£48,200" hero replaced with a placeholder + `role="img"`.
- **Studio clarity** — node-toolbar tabs made distinct (Basics/Numbers/Advanced); stepper↔panel titles aligned.
- **Silent truncation** — leads/bookings show "Showing N of M" instead of hiding rows past the 200 cap.

---

## Next — prioritized backlog (not yet done)

### The big one (product decision + visual review)
1. **One home, one nav, one "next move", one taxonomy** *(audit §Top-10 #1/#3, re-audit IA #1–#6, #69)* — the highest-value remaining UX win, and the audit's only "L". **Substantially underway:**
   - **✅ Done:** account/sign-out menu on `AppNav` (commit "Add an account / sign-out menu to the persistent nav"). Post-auth now routes to `/command-center`, and the e2e helper + `auth.spec`/`canvas.spec` updated to the new flow (commit "Route post-auth to the Command Centre"). Full e2e green.
   - **Remaining:** (a) demote the Studio's internal `home` view to a plain project/canvas launcher so it stops reading as a second dashboard (the two-homes finding, IA #1) — a visual change to the 4,056-line `funnel-studio.tsx`, best paired with the decomposition below; (b) the "next move" engines — **assessed:** `/start` and `/command-center`'s *banner* already share `computeJourney` (`lib/studio/journey`). The remaining three (`api/command-center` route's `nextMove` card, Studio `homeNextAction`) read genuinely different data sources — journey steps vs. acquisition/plan signals vs. live funnel-model state — and drive different UI. A single shared selector would be a behaviour-changing product refactor across server + client, not a mechanical dedup; **left for a deliberate product pass, not folded in blindly** (regressions here wouldn't be caught by the e2e). (c) unify the label taxonomy (AppNav tabs vs pillars/stages vs Studio TriNav).

### High value
2. **Decompose `funnel-studio.tsx`** *(re-audit reliability #7, studio #11; task #43)* — was 4,074 lines. **Underway, hook-per-slice pattern established:** cohesive feature slices whose state is self-contained move into a custom hook (state stays co-located → no prop-drilling; the component just calls the hook and destructures). Done so far: `useApiKeysAndWebhooks`, `useWorkspaceMembers` (file now 3,991 lines; each verified by typecheck + prod build + canvas e2e). Next clean slices, in rough order: the setup/configure wizard, live tracking, comments/notes, the journey/recurring/timeline panels' state, then the harder coupled core (canvas nodes/edges/sim → a reducer, which also fixes the fragile hand-listed autosave dep array). Extract one slice per commit and re-run the canvas e2e each time.
3. **Real list virtualization / pagination** *(reliability #6; task #46)* — **re-assessed:** the leads inbox is already server-capped at 200 rows (renders `shown`, ≤200) with a truncation note, and Segments renders only a small preview `sample`, not the full audience — so there is no 5,000-row unwindowed render in the UI today. Windowing ≤200 rows would be over-engineering. The genuine remaining gap is *cursor pagination* (see past-the-cap rows without the CSV export) — a real feature, but not a perf hazard at current scale. Deferred as a feature, not a fix.
4. **Token-system consolidation** *(a11y #5)* — collapse `--gear-*`, the studio set, and per-page aliases onto `--ds-*` as the single source (the lockstep-by-hand drift that caused the dark-mode bug).

### Security / reliability (mostly small)
5. ~~**Legacy sessions without `sid`** *(reliability #8)*~~ — **✅ done.** `SESSION_SID_REQUIRED_AFTER` env sets a cutoff; once passed, sid-less tokens are refused (grace-period-friendly, fails permissive on a bad/unset value). `lib/auth.ts` + `test/legacy-session-cutoff.test.ts` (4 tests).
6. **Public ingest storage cap** *(reliability #11)* — absolute per-key cap / global circuit breaker on `/api/track` + funnel `event`.
7. ~~**Gate `pnpm audit`** *(reliability #12)*~~ — **✅ done.** CI now has a gating step at `--audit-level=critical` (no criticals today, so it blocks a real regression without tripping on the triaged backlog); the high-level report stays advisory. Promote to `high` once the transitive-via-next backlog clears.
8. **Handler-level integration tests** *(reliability #13)* — **mostly covered.** Webhook idempotency *ordering* (`stripe-billing-idempotency.test.ts` — a failed apply leaves the event un-marked so the retry still works) and tenant scope (`stripe-events-scope.test.ts` — one workspace never sees another's events, cap can't evict) both have dedicated tests, plus `stripe-webhook`, `webhooks`, `api-keys`, `billing-e2e`. The only untested sliver is the *duplicated* authz scope-guard itself — each route inlines the `roleOf`/`requireManage` check — but that's a **consolidate-into-a-shared-helper refactor across many routes**, not a missing test; deferred so it's done deliberately, not rushed.

### A11y / polish
9. ~~**Studio glass panels focus-trap** *(a11y #10)*~~ — **✅ done.** New `GlassDrawer` wrapper gives every Studio slide-in panel (Risk, Comments, Notes, Checklist, Constraints, Live tracking, History, Activity, Members, AI Copilot, Integrations) + the Tools hub `role="dialog"` + aria-modal, a Tab focus-trap, Escape-to-close, and focus-restore via `useDialogA11y`. Verified by axe + a11y e2e (incl. dark).
10. ~~**React Flow keyboard nav** *(a11y #11, task #49)*~~ — **✅ done.** `nodesFocusable` pinned on (was riding React Flow's default); a "Canvas — keyboard" group added to the shortcuts overlay (Tab/⇧Tab move focus, arrows nudge, ⇧+arrows faster) so the aria-label's promise is discoverable. Canvas e2e green.
11. **44px touch targets** in the studio *(a11y #7)*; **migrate inline-style sprawl** to `Button`/`--ds-*` tokens *(a11y #8)*.
12. ~~**Studio mobile header collapse + `100dvh`** *(studio #2)*~~ — **✅ done.** The four full-height studio shells were `100vh` (measured against the address-bar-hidden viewport on mobile, so the canvas fell below the fold); switched to `gb-fill-*` utility classes that declare `vh` then `dvh`. The header already wraps (`flex-wrap`), so no separate collapse needed. Canvas e2e green.
13. **Report/calibrate persistent entry point** *(studio #6)*.

### Product / flows
14. ~~**Business-OS progress: "touched" ≠ "done"** *(biz #7)*~~ — **✅ done.** Each step now splits `started` (touched) from a stricter `done`; the card shows "In progress" vs "Done"; logic extracted to `lib/business/progress.ts` with a unit test (7 cases).
15. ~~**Currency threads** — default funnel-payment currency from the workspace currency~~ — **✅ done (funnel payments).** A new paid step now defaults its currency from the workspace economics currency (was hardcoded `usd`) and its dropdown is driven off the shared `CURRENCIES` list. *(Offer-label currency, where relevant, can follow the same pattern.)*
16. **Free first-run** — allow one real savable project before the paywall *(IA #9)* [remaining]; ~~give `/start` + `/glossary` the AppNav shell *(IA #10)*~~ **✅ done** (both now carry the shared `ToastProvider` + `AppNav` + `<main>` layout — were orphaned nav-less pages); retire or make `/welcome` canonical *(IA #7)* [remaining].
17. ~~**Momentum: weekly goal + streak + digest** *(tasks #38/#51)*~~ — **✅ already built.** `lib/studio/streak.ts` + `weekly-moved.ts` + `/api/business/streak` power the Command Centre's "✨ What moved this week" digest (diffs a rolling weekly baseline into tone-coded chips) and the 🔥 streak counter (scores each closed week, remembers the best run). Nothing further needed.

### Operational (not code — for the owner / infra)
- **DB pool ceiling** *(reliability #5)* — pgBouncer transaction pooler + a larger tier + `DATABASE_POOL_MAX` + a real load test. The code is already env-tunable; don't blind-bump the default (the session pooler caps this tier at 15 clients).
- **Turn on the new opt-in hardening in prod env** — set `DATABASE_CA_CERT_PATH` (or `DATABASE_SSL_REJECT_UNAUTHORIZED=1`) once the CA bundle is available.
