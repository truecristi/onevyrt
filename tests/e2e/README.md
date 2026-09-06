# End-to-end tests (Playwright)

Real, as of Phase 9's first UI slice - `apps/web` now has an actual
register/login/dashboard flow to click through, not just the Phase 0/1
static placeholder. `auth.spec.ts` covers spec §46's first minimum
critical journey ("Register, verify identity, create a workspace and
complete onboarding"), plus the wrong-password and
unauthenticated-redirect cases around it.

Run locally: `pnpm test:e2e` (starts the Next.js dev server on port 3100
itself via Playwright's `webServer` config, against whichever
`DATABASE_URL`/`AUTH_SECRET` are in your environment - same values used
for `pnpm test`). In CI, `.github/workflows/ci.yml`'s `e2e` job builds
and starts a real production build instead of the dev server, against
the same Postgres service container `build-and-test` uses.

§46 names the 20 minimum critical end-to-end journeys a controlled launch
needs. Where each one stands, honestly:

1. **Register, verify identity, create a workspace and complete
   onboarding** - real Playwright coverage now (`auth.spec.ts`), on top
   of the domain-level coverage that already existed
   (`packages/domain/src/auth-workspace-isolation.test.ts`).
2. Invite a member, assign a role and verify permission boundaries -
   domain-level coverage exists; no invite UI exists yet, so no
   Playwright version yet.
3-20. The rest: roughly half have equivalent domain-level integration
   coverage of the underlying logic (see ADR-0022's own accounting of
   this), the other half depend on capabilities that don't exist yet in
   any form (structured canvas, freeform sketch storage, background job
   retry, data export/deletion workflows). Each gets a real Playwright
   test as the UI slice it depends on gets built - added here as that
   happens, not stubbed speculatively ahead of the UI existing.

Not attempted here: a cross-browser matrix (chromium only for now,
`playwright.config.ts`'s own comment explains why), and visual
regression testing (no design freeze exists yet to regress against).
