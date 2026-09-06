# ADR-0004: Authentication, sessions and workspace membership

**Status:** Accepted
**Date:** 2026-09-05

## Context

Phase 1's exit criterion (README) explicitly includes "Add authentication
and workspace isolation." §11 requires "password hashing using a current
memory-hard method and secure parameters." No MFA, password reset or email
verification yet - those are real, separately-scoped follow-up work
packages (§35), not part of this decision.

## Decision

- **Passwords:** `node:crypto` `scrypt` (N=2^15, r=8, p=1, 64-byte key,
  16-byte random salt), self-describing stored format
  (`scrypt$N$r$p$saltHex$hashHex`) so parameters can change later without
  invalidating existing hashes. No external Argon2 dependency added for
  Phase 1 - scrypt via the standard library meets "current memory-hard
  method" without a new native-binding dependency; revisit if a real
  security review asks for Argon2id specifically.
- **Sessions:** opaque random 32-byte tokens in an `httpOnly`, `sameSite:
lax`, 30-day cookie. Only an HMAC-SHA256 of the token (keyed by
  `AUTH_SECRET`) is stored server-side (`sessions.token_hash`) - a
  database read alone can never produce a usable session token.
- **Login timing:** a fixed dummy hash is compared against even when the
  email doesn't exist, so `loginUser`'s response time doesn't reveal
  account existence (§42's threat-model baseline lists this class of
  leak).
- **Workspace membership:** `workspace_members(workspace_id, user_id,
role)`, `role` a plain `text` with a `CHECK (role IN ('owner',
'member'))` rather than a Postgres enum - adding `manager`/`editor`/
  `viewer` (§4's full role table) later is a data migration, not a type
  migration requiring `ALTER TYPE`.
- Registration is one atomic transaction: create user → create workspace →
  create membership (role `owner`) → create session → two audit-log rows.
  Any failure rolls all of it back - there is no path to a user that
  exists without a workspace, or a workspace without an owner membership
  row.

## Alternatives considered

- **JWT sessions** - rejected for Phase 1: revocation (logout, and any
  future "sign out everywhere") is trivial with a server-side session
  table and non-trivial with stateless JWTs; nothing in Phase 1 needs
  JWT's cross-service portability yet.
- **bcrypt** - considered, scrypt chosen instead since it's in Node's
  standard library (no new dependency) and is an accepted memory-hard KDF.
- **Full role table (owner/manager/editor/viewer) now** - deferred:
  building four roles' worth of permission logic before any UI
  distinguishes them would be speculative; the `CHECK` constraint above is
  the deliberate seam for adding them later.

## Consequences

MFA, password reset, and email verification (§6.1) are explicitly _not_
covered by this ADR - each is its own future decision when its phase
starts, since each has its own security shape (reset-token expiry, MFA
recovery codes, etc.) that shouldn't be bolted onto this one.

## Security effects

Directly implements the "password hashing" and part of the "session
theft" line items in §42's threat model. Session-fixation is mitigated by
issuing a fresh token on every register/login rather than reusing one.

## Migration effects

None yet.

## Amendments (post-review, 2026-09-05)

A code review of PRs #1-#4 found two real gaps in this ADR's original
implementation, both fixed in place rather than left as follow-ups:

- **Logout didn't revoke the session.** `DELETE /api/auth/session`
  originally only cleared the browser cookie
  (`apps/web/lib/session.ts`'s `clearSessionCookie`) - the corresponding
  `sessions` row stayed valid until its 30-day TTL, so a captured raw
  token kept working after logout. Fixed with `revokeSession()`
  (`packages/domain/src/auth-use-cases.ts`), which deletes the session row
  by its token hash; the route now calls a new `logout()` helper that
  revokes, then clears the cookie.
- **`registerUser`'s email-uniqueness check was a non-atomic
  check-then-insert.** Two concurrent registrations for the same email
  could both pass the upfront `findFirst` before either inserted, and the
  second would hit `users.email`'s UNIQUE constraint as an unhandled
  Postgres error (a 500, not the intended 409). Fixed by catching the
  unique-violation (Postgres error code `23505`) on the insert itself and
  re-throwing the same `EmailAlreadyRegisteredError` the fast path
  throws - the upfront check remains as an optimization, but the database
  constraint is now what's actually relied on for correctness.

One gap is **flagged, not fixed**, because fixing it requires a decision
this ADR can't make alone:

- **Rate-limiting keys trust `x-forwarded-for` unconditionally**
  (`apps/web/lib/client-ip.ts`). That header is set by whatever reverse
  proxy sits in front of the app and Next.js does not validate it - until
  this is deployed behind a specific, known proxy chain (see ADR-0021),
  an attacker can set an arbitrary value on every request and get a fresh
  rate-limit bucket each time, defeating §11's per-IP limits on
  register/login entirely. The extraction is centralized in one function
  with this limitation documented prominently, so it's one place to fix
  once the deployment topology (and therefore which hop to trust) is
  known - not something to guess at now.

## Reversibility

Low-to-medium - changing the password hash format is backward compatible
(the format is versioned); changing the session model (e.g. to JWT) would
require a coordinated cookie-format change for all logged-in users.

**Approvers:** (pending human review)
