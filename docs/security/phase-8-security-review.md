# Phase 8 security review

Per the root README's Phase 8 ("Migration and hardening") checklist item
"Run security reviews", and spec §42's threat-model baseline. This is a
self-review of the codebase as it stands after Phase 7 - not a substitute
for external penetration testing or a third-party audit before any real
launch, but a systematic pass over the controls this repository already
claims to have, checking each one is actually true of the code today.

Workspace/tenant isolation is covered separately: see
[ADR-0003](../decisions/ADR-0003-postgres-tenancy.md)'s "Re-verification
at scale" section and `packages/domain/src/workspace-isolation-architecture.test.ts`.
This review covers everything else.

## Scope and method

Read the actual source (not just doc comments claiming a control exists)
for: CSRF, rate limiting, input validation, SQL injection surface,
secrets handling, password/session security, and response-level security
headers. Each finding below states what was checked and how, so the
check is reproducible rather than a bare assertion.

## Findings

### Fixed

- **Logout had no CSRF check** (`apps/web/app/api/auth/session/route.ts`,
  `DELETE`). Every other cookie-authenticated mutation in this codebase
  calls `requireCsrf` (verified by scanning every route exporting
  `POST`/`PATCH`/`PUT`/`DELETE` for a `requireCsrf` call - this was the
  only one missing it). A cross-site request could otherwise force-logout
  a signed-in user - low severity on its own since it destroys a session
  rather than reading or changing business data, but a real gap against
  this repo's own stated policy (spec §11: "verify on every
  cookie-authenticated mutation") and a known stepping stone for
  login-CSRF attacks. Fixed to match every other mutating route.

- **No baseline security response headers anywhere**
  (`apps/web/next.config.js`). Added `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, and a restrictive default
  `Permissions-Policy`. A real Content-Security-Policy is deliberately
  deferred - there's barely any page markup or script origins yet to
  write a meaningful policy against (see "Not yet applicable" below);
  writing one now would either be trivially permissive (worthless) or
  would need revisiting the moment real pages exist anyway.

### Confirmed already correct (no change needed)

- **CSRF**: double-submit-cookie pattern (`packages/security/src/csrf.ts`)
  is verified on every other mutating route.
- **Rate limiting**: login (10/15min per IP) and register (5/15min)
  are both rate-limited with a documented rationale for the different
  limits; every route that calls `runPrompt` (the AI gateway) passes a
  `rateLimitKey`, verified by scanning every route touching `runPrompt(`
  for the option.
- **Input validation**: every route calling `request.json()` validates
  the result through a Zod `safeParse` before using it - verified by
  scanning every route file for `request.json()` without a
  corresponding `safeParse` call; found none.
- **SQL injection surface**: every database access in
  `packages/domain` goes through Drizzle's query builder
  (`.select()`/`.insert()`/`.where(eq(...))`, etc.), which parameterizes
  automatically; the only `sql\`...\``template usages in the codebase are
static schema-level`CHECK`constraints with hardcoded literal enum
values, never runtime request data. The one raw`.execute()` call
outside tests (`apps/web/app/api/health/route.ts`) runs a
constant `select 1` with no interpolated input at all.
- **Secrets handling**: no hardcoded API keys, tokens, or credentials
  found anywhere in source (checked common patterns like `sk-ant-`,
  AWS-style access-key prefixes, PEM private-key headers) - the only
  matches were obviously-fake placeholder values in test files
  (`"sk-ant-test"`). Configuration is entirely environment-variable-based
  via `packages/contracts/src/env.ts`'s validated schema.
- **Password hashing**: `scrypt`, a modern memory-hard KDF, not a fast
  general-purpose hash. Login additionally hashes a fixed dummy value
  when no user matches the given email
  (`DUMMY_HASH_FOR_TIMING` in `auth-use-cases.ts`), so a login attempt
  takes roughly the same time whether or not the email exists - a
  deliberate user-enumeration timing mitigation, and the error response
  itself (`InvalidCredentialsError`) is identical for "no such user" and
  "wrong password" either way.
- **Session tokens**: stored as a keyed hash
  (`hashSessionToken(token, authSecret)`), never in plaintext, so a
  database leak alone doesn't hand out valid session tokens. The session
  cookie is `httpOnly`, `secure` in production, and `sameSite: "lax"`.

### Known, already-documented limitations (not new findings)

- The in-memory `RateLimiter` (`packages/security/src/rate-limit.ts`)
  resets on process restart and doesn't share state across instances -
  already documented in its own doc comment as an honest placeholder
  until a real multi-instance deployment needs a shared store (spec §3
  names Redis as the eventual answer). Not a silent gap; a stated,
  reviewed tradeoff appropriate to this stage.

### Not yet applicable

- **Content-Security-Policy**: deferred, see above - there's essentially
  no rendered page UI yet beyond the Phase 0/1 scaffold. The same
  "not enough real page surface yet to test/write a meaningful policy
  against" reasoning applies to this Phase 8 checklist's separate
  "Conduct accessibility testing" bullet.
- **No password-reset flow exists yet** to review - not a gap in what's
  built, since the feature itself hasn't been built. Whenever it is, it
  needs the same timing-safe-response and single-use-token treatment as
  login/session already get.

## Not covered by this pass

This is a self-review by the same process that wrote the code, not an
independent audit - it is good at catching "does the code actually do
what its own comments claim" and systematic gaps (a route missing a
check every sibling route has), and much weaker at catching a
vulnerability class nobody on this side has thought to look for.
Dependency/supply-chain scanning (spec §44's "dependency and secret
scanning" release gate) and a genuine third-party penetration test are
both still outstanding before any real launch - see the launch-readiness
review (final Phase 8 bullet) for the complete list of what remains.
