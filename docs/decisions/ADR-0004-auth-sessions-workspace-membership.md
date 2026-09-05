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

## Reversibility

Low-to-medium - changing the password hash format is backward compatible
(the format is versioned); changing the session model (e.g. to JWT) would
require a coordinated cookie-format change for all logged-in users.

**Approvers:** (pending human review)
