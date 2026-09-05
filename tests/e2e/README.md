# End-to-end tests (Playwright)

Empty for Phase 1 - there is no clickable UI yet beyond a static
placeholder page (`apps/web/app/page.tsx`); a Playwright suite against
that would test nothing meaningful.

§46 names the 20 minimum critical end-to-end journeys a controlled launch
needs, e.g.:

1. Register, verify identity, create a workspace and complete onboarding.
2. Invite a member, assign a role and verify permission boundaries.
   ...

The first of these (register → workspace created) already has real
coverage today, just not via Playwright - see
`packages/domain/src/auth-workspace-isolation.test.ts`, an integration
test against a real Postgres that exercises the same `registerUser`/
`loginUser`/`getMembership` use-cases the API routes call. Add the
Playwright version once `apps/web` has an actual register/login form to
click through (Phase 2+).
