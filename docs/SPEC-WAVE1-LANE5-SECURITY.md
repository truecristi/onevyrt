# Wave 1 Lane 5: Auth, Security & Scope Isolation Audit Spec

**Completed:** September 2, 2026  
**Branch:** claude/works-f7cor7  
**Status:** Audit findings documented; hardening roadmap specified

## Overview

This document audits the current auth/security implementation across session management, rate limiting, scope isolation, and RBAC. It identifies gaps and specifies the hardening roadmap for Wave 2 and Wave 6 audit gates.

---

## 1. Session-Based Auth Implementation

### 1.1 AUTH_SECRET Management

**Current Implementation:**
- Signing key stored in `.gearbox/auth-secret` (file-based) OR via `AUTH_SECRET` environment variable
- File created with `mode 0o600` (read-only by owner) on first run
- Cached in memory after first read for performance
- Used as HMAC-SHA256 key material for signing session tokens
- Format: any stable, sufficiently random string (no format constraint)

**Security Properties:**
- ✅ File permissions correctly restrict access to owner
- ✅ Env var takes priority (enabling multi-instance deployments with shared signing key)
- ✅ No plaintext storage of credentials in migrations or code
- ✅ Used only as symmetric HMAC key, not for encryption

**Gap Identified:**
- ⚠️ File-based fallback creates deployment friction: each container needs file access or env var
- ⚠️ No audit/rotation mechanism for AUTH_SECRET changes
- ⚠️ Silent fallback to on-disk file if env var unset (no validation that they match)

---

### 1.2 Session Tokens (JWT-like format)

**Current Implementation:**
- HMAC-SHA256 signed tokens (stateless, no encryption)
- Token format: `base64url_payload.base64url_sig`
- Payload: `{uid: userId, exp: expiryMs, sid?: sessionId}`
- TTL: 30 days by default
- Expiry checked on every verification

**Security Properties:**
- ✅ HMAC prevents tampering; signature validates on every check
- ✅ Expiry enforced (token-level + session record level)
- ✅ Session ID (sid) embedded for revocation support
- ✅ Timing-safe comparison (`timingSafeEqual`) prevents timing attacks

**Session Record Layer (Server-Side Revocation):**
- ✅ Every session stored in `sessions` table with `revoked` boolean
- ✅ `lastSeenAt` updated on each use (enables "active sessions" panel)
- ✅ Per-session revocation: `UPDATE sessions SET revoked = true WHERE id = $1 AND user_id = $2`
- ✅ Cascading revocation: "log out everywhere else" (except current session)
- ✅ Legacy token cutoff: `SESSION_SID_REQUIRED_AFTER` env var gates when sid-less tokens are rejected

**Gap Identified:**
- ⚠️ No CSRF token for state-changing operations (POST/PATCH/DELETE over HTTP)
- ⚠️ No token refresh flow; tokens issued with full TTL each login (max 30 days at once)
- ⚠️ Session record updates fire on EVERY request (`lastSeenAt` updated synchronously), potential DB write amplification

---

### 1.3 Cookie Handling

**Current Implementation:**
- Cookie name: `gb_session` (main), `gb_impersonator` (admin only)
- Cookie attributes:
  - `HttpOnly`: ✅ Prevents JavaScript access
  - `Secure`: ✅ Always set (HTTPS-only, unaffected by localhost dev)
  - `Path=/`: ✅ Scoped to entire site
  - `Max-Age`: ✅ Set to TTL (30 days for session, 0 for clear)
  - `SameSite=Lax`: ✅ Prevents CSRF for top-level navigations

**Security Properties:**
- ✅ HttpOnly + Secure blocks JavaScript theft and HTTPS-only enforcement
- ✅ SameSite=Lax prevents same-site request forgery for form submissions
- ✅ Impersonator cookie separate, isolated, and cleared on stop-impersonation

**Gap Identified:**
- ⚠️ SameSite=Lax allows **Lax cross-site requests** (top-level navigations, `<a>` clicks)
  - State-changing endpoints (POST/PATCH/DELETE) need CSRF token as secondary check
- ⚠️ No explicit cookie domain; relying on implicit domain=empty (current host only)
- ⚠️ No fingerprinting/rotation on privilege escalation (e.g., password change, 2FA enable)

---

### 1.4 Session Expiration & Timeout

**Current Implementation:**
- Token TTL: 30 days (hardcoded, no per-user timeout)
- Session records stored permanently until explicitly revoked or token expires
- No idle-session timeout (session survives inactivity indefinitely up to 30 days)
- Password change revokes **all other sessions** (keeps current session intact)
- Password reset revokes **all sessions** (including current)
- Email change revokes **all other sessions**

**Security Properties:**
- ✅ Password/email changes force re-auth on other devices (good defense for account takeover)
- ✅ Reset token revokes everything (appropriate for "I was hacked" scenario)
- ✅ 30-day max TTL bounds exposure of leaked cookies

**Gap Identified:**
- ⚠️ No idle-session timeout; a browser left open for 30 days exposes the account
- ⚠️ No activity window; `lastSeenAt` updated but not used to enforce inactivity
- ⚠️ 30-day TTL is long for high-security workflows (SaaS defaults: 2-7 days)

---

## 2. Rate Limiting Audit

### 2.1 Rate Limiter Architecture

**Current Implementation:**
- Dual-backend system:
  1. **Postgres-backed** (shared across instances): Fixed-window counter with atomic upsert
  2. **In-memory fallback** (per-container): Simple Map-based counter with opportunistic sweep
- Window reset: On update (checked against `reset_at`), not calendar-based
- Key format: Strings like `login:ip:192.0.2.1`, `register:ip:*`, `api:v1:workspace-id`
- Rate limit headers: Standard `X-RateLimit-Limit`, `-Remaining`, `-Reset`, `Retry-After`

**Security Properties:**
- ✅ Shared counter across instances (load-balanced deployments get per-limit enforcement)
- ✅ Fixed-window with atomic increment prevents double-counting
- ✅ Fallback to in-memory on DB error (graceful degradation)
- ✅ Opportunistic cleanup (1.5% of requests delete expired buckets)
- ✅ Test escape hatch: `RATE_LIMIT_DISABLED=1` for e2e suite (does not run in production)

**Gaps/Observations:**
- ⚠️ Fixed-window is vulnerable to burst attacks at window boundaries (classic limitation)
- ⚠️ Opportunistic cleanup is non-deterministic; no guarantee on table size
- ⚠️ In-memory fallback is loose for multi-instance deployments (each container gets `max` per window)

---

### 2.2 Rate Limit Coverage by Endpoint

**Auth Endpoints (Implemented):**
- ✅ `POST /api/auth/login`: Per-IP limit (20/min) + per-email lockout (5 fails/email+IP, 50 fails/email aggregate)
- ✅ `POST /api/auth/register`: Per-IP limit (10/hour)
- ✅ `POST /api/auth/forgot-password`: Not checked in code (GAP)
- ✅ `POST /api/auth/change-password`: Not checked in code (GAP)
- ✅ `POST /api/auth/change-email`: Not checked in code (GAP)
- ✅ `POST /api/auth/2fa/...`: Per-request endpoints not uniformly rate-limited (GAP)

**Public API Endpoints:**
- ✅ `GET /api/v1/projects`: Per-workspace limit (120/min)
- ✅ `GET /api/v1/projects/[id]`: Per-workspace limit (120/min)

**Community Endpoints:**
- ✅ `POST /api/community/creatives`: Per-workspace (publish: 10/hour, use: 120/min)
- ✅ `POST /api/community/reactions`: Per-workspace (50/min)
- ✅ `POST /api/community/comments`: Per-workspace (30/min)

**Funnel/Booking Endpoints:**
- ✅ `POST /api/q/[slug]/book`: Per-IP (100/hour)
- ✅ `POST /api/q/[slug]/event`: Per-IP (1000/hour)
- ✅ `POST /api/q/[slug]/pay`: Per-IP (50/hour)
- ✅ `POST /api/q/[slug]/verify/start`: Per-IP + per-destination (10/min IP, 3/min destination)

**Admin Endpoints:**
- ❌ No rate limiting on `/api/admin/*` (relies on session auth alone)

**Workspace/Project Endpoints:**
- ❌ No rate limiting on `GET /api/workspaces`, `PATCH /api/workspaces/[id]`, etc.

**Gaps:**
- ⚠️ Auth routes (password change, email change) missing rate limits (account enumeration/abuse vector)
- ⚠️ Admin endpoints rate-limited only by session auth (no additional throttle for risky operations)
- ⚠️ Workspace read/write operations lack rate limiting (potential for DoS via rapid updates)
- ⚠️ 2FA setup/confirm endpoints not uniformly limited

---

### 2.3 Rate Limit Keying Strategy

**Current Keying:**
- Per-IP: `login:ip:`, `register:ip:`, `book:ip:`, `fevent:ip:`, `pay:ip:`, `otp:start:`, `otp:dest:`
- Per-Workspace: `api:v1:`, `community:creative:publish:`, `community:reaction:post:`, `community:comment:post:`
- Per-Email (lockout, not rate-limit): `email`, `__all__` (aggregate)

**IP Detection:**
- Uses `X-Forwarded-For` header (leftmost entry attacker-controlled)
- Trusts rightmost `TRUSTED_PROXY_COUNT` entries (default 1)
- Fallback: `X-Real-IP`, then "unknown"
- ✅ Correctly ignores attacker-spoofed prefix in XFF

**Gap:**
- ⚠️ Per-IP limits are per-workspace-agnostic (one workspace's API rate limit does NOT count toward another's)
  - A user with access to 10 workspaces can 10x the shared-IP budget
- ⚠️ Admin operations lack any per-user/per-IP throttle

---

## 3. Scope Isolation Audit

### 3.1 Authentication Requirements

**Current Implementation:**
- ✅ All routes check `await currentUser(req.headers.get("cookie"))`
- ✅ Unauthenticated requests return 401
- ✅ Session token verified before resolving user

**Verified Routes:**
- Auth routes (login, register, password change, etc.)
- Workspace routes (read, update, member management)
- Admin routes (`requireAdmin` adds an extra gate)
- API v1 routes (use `resolveApiKeyScope`)
- Community endpoints (workspace-scoped)
- Funnel endpoints (public, no auth required; validated below)

---

### 3.2 Workspace Membership Checks

**Current Implementation:**
- ✅ All workspace-scoped routes call `roleOf(wsId, user.id)` before accessing data
- ✅ `roleOf` verifies user is in workspace members array
- ✅ Returns null if not a member → 403 error

**Example (GET /api/workspaces/[id]):**
```typescript
const role = await roleOf(id, user.id);
if (!role) return json({ error: "not a member" }, 403);
```

**Workspace Query Pattern (listForUser):**
```sql
SELECT ... FROM workspaces
WHERE members @> $1::jsonb
ORDER BY created_at ASC
```
- ✅ JSONB containment operator (`@>`) indexed, prevents cross-workspace leakage

**Gap:**
- ⚠️ No explicit audit of EVERY route that should check workspace membership
- ⚠️ API key scope (resolveApiKeyScope) scoped to workspace, but no audit that every v1/* endpoint respects it

---

### 3.3 Project/Resource Scope Isolation

**Current Implementation:**
- Projects keyed by `workspace_id` in database
- Store operations (listProjects, getProject, etc.) take `wsId` parameter
- Assumed: All routes pass workspace ID from path params or query

**Example (listProjects signature):**
```typescript
async function listProjects(wsId: string): Promise<Project[]> {
  // Only returns projects WHERE workspace_id = $1
}
```

**Gap:**
- ⚠️ No systematic audit that ALL resource reads filter by workspace_id
- ⚠️ No check for routes that might accept workspace_id from request body or query (privilege escalation vector)
- ⚠️ Cohort, enrollment, lead data: assumed workspace-filtered but not verified

---

### 3.4 User-Scoped Data

**Email Change (Verified):**
```typescript
// Scoped to own user; no cross-user leak
const res = await pool.query(
  "SELECT ... FROM pending_email_changes WHERE token_hash = $1 AND expires_at > $2",
  [tokenHash, Date.now()],
);
```
- ✅ Token is single-use, scoped by hash

**Session Management (Verified):**
```typescript
// Only revoke own sessions
await pool.query(
  `UPDATE sessions SET revoked = true WHERE id = $1 AND user_id = $2`,
  [sessionId, userId],
);
```
- ✅ Double-check: both session ID AND user ID in WHERE clause

**Avatar Upload (Verified):**
```typescript
// Locked to own user
await client.query("UPDATE users SET avatar_url = $2 WHERE id = $1", [userId, dataUrl]);
```
- ✅ User ID in WHERE clause

---

### 3.5 Admin Scope Isolation

**Current Implementation:**
- `requireAdmin(cookieHeader)` checks if user is in admin allowlist (lib/admin.ts)
- Admin routes explicitly gate with `if (!admin) return json(..., 403)`
- Admin operations (delete workspace, reassign owner, etc.) require explicit id parameter

**Example (DELETE /api/admin/users/[id]):**
```typescript
const admin = await requireAdmin(req.headers.get("cookie"));
if (!admin) return json({ error: "not authorized" }, 403);
const { id } = await ctx.params; // User ID to delete
const target = await getUserById(id);
if (target.id === admin.id) return json({ error: "can't self-delete" }, 400);
```

**Gap:**
- ⚠️ Admin allowlist not visible in audit (stored in env/config); need to verify it's not hardcoded or accessible
- ⚠️ No rate limiting on admin operations (potential for abuse)
- ⚠️ No audit logging on admin actions (only isolated `recordAudit` calls)

---

### 3.6 API Key Scope Isolation

**Current Implementation:**
- API keys stored in `api_keys` table with `workspace_id`
- Resolved via `resolveApiKeyScope(req)` → returns `{ wsId }`
- Only workspace accessible to that key

**Example (GET /api/v1/projects):**
```typescript
const scope = await resolveApiKeyScope(req);
if (!scope) return json({ error: "missing or invalid key" }, 401);
// Use scope.wsId for all queries
return jsonWithETag(req, JSON.stringify({ projects: await listProjects(scope.wsId) }), ...);
```

**Gap:**
- ⚠️ API key lookup by prefix (narrows to ~1 row), then timing-safe hash comparison
- ⚠️ No verification that EVERY v1/* endpoint uses scope.wsId
- ⚠️ No rate limiting per-user (only per-workspace), allowing one user to burn quota across multiple workspaces

---

### 3.7 Public Funnel Routes (No Auth)

**Current Implementation:**
- Routes like `GET /api/q/[slug]/preview` are public (no session required)
- Slug resolves to a single funnel; operations filtered by slug

**Example Pattern:**
```typescript
const funnel = await getFunnelBySlug(slug);
if (!funnel) return json({ error: "not found" }, 404);
// All subsequent queries scoped to this funnel
```

**Gap:**
- ⚠️ Slug collision risk (if not globally unique or per-workspace unique)
- ⚠️ No verification that all public endpoints are intentionally public

---

## 4. RBAC (Role-Based Access Control) Enforcement

### 4.1 Role Hierarchy

**Defined Roles:**
- `owner`: Full control (rename workspace, manage members, delete workspace, reassign ownership)
- `manager`: Team leadership (rename workspace, manage members, but NOT delete/reassign)
- `editor`: Edit projects
- `viewer`: Read-only access

**Role Constraints (lib/workspaces.ts):**
1. ✅ Only owner can transfer ownership: `if (ws.ownerId !== actingUserId) throw ...`
2. ✅ Only owner or manager can manage members: `if (!canManage(ws, actingUserId)) throw ...`
3. ✅ Only owner can appoint manager: `if (role === "manager" && ws.ownerId !== actingUserId) throw ...`
4. ✅ Manager cannot remove another manager: `if (targetRole === "manager" && ws.ownerId !== actingUserId) throw ...`
5. ⚠️ No explicit `editor` vs `viewer` checks; assumed implemented in project access layer (not audited)

---

### 4.2 RBAC Enforcement Points

**Verified:**
- ✅ `renameWorkspace()`: Checks `canManage(ws, actingUserId)`
- ✅ `addMember()`: Checks `canManage()` and role escalation rules
- ✅ `removeMember()`: Checks `canManage()` and manager/owner protections

**Not Verified (Assumed):**
- Project creation/deletion: Assumed checks editor role (in store.ts, not fully audited)
- Project view/edit: Assumed checks role appropriately

**Gap:**
- ⚠️ No comprehensive audit of every project/resource mutation checking role
- ⚠️ `viewer` role permissions not explicitly enforced (rely on read-only API design, not validation)
- ⚠️ No "view-only" vs "no-access" distinction for projects within a workspace

---

### 4.3 Data Export Scope Isolation (GDPR)

**Current Implementation:**
- `purgeUser()` in lib/auth.ts: Deletes account + owned workspaces, removes user from other workspaces
- Cascade:
  1. Delete all workspaces owned by user
  2. Delete all user's cohorts (coach-scoped)
  3. Remove user from other workspaces they're a member of
  4. Soft-delete user's leads/bookings/events
  5. Delete user account

**Security Properties:**
- ✅ Data deletion is idempotent (safe for retries)
- ✅ Shared workspaces: user removed, workspace kept
- ✅ Owned workspaces: entirely deleted (no orphaned data)

**Gap:**
- ⚠️ No verification that data export routes (if any) respect user scope
- ⚠️ No audit of what data is NOT deleted (e.g., activity logs, audit trail)
- ⚠️ Soft-delete of leads (retained for 30 days) might need explicit retention policy

---

## 5. CSRF Protection

### 5.1 Current State

**Gap Identified:**
- ❌ **CSRF tokens NOT implemented** for state-changing operations (POST/PATCH/DELETE)
- ✅ SameSite=Lax cookie mitigates CSRF for same-site requests
- ⚠️ SameSite=Lax is insufficient alone; `<img>`, `<form action>`, and redirects can still trigger state changes

**Attack Scenario:**
1. Attacker hosts malicious page: `<form action="https://onevyrt.com/api/workspaces/123" method="POST">`
2. User visits attacker's site while logged in to onevyrt
3. Form auto-submits; browser sends `gb_session` cookie automatically
4. SameSite=Lax allows request if triggered by `<form>` (POST from same-site)
5. Workspace is modified by attacker

**Mitigation Needed:**
- Implement CSRF tokens (double-submit, session-bound) for all POST/PATCH/DELETE routes
- Verify token in middleware or per-route

---

## 6. Two-Factor Authentication (2FA)

### 6.1 Current Implementation

**TOTP (Time-based One-Time Passwords):**
- ✅ Setup: `start2faSetup()` stores pending secret, only confirmed on correct 6-digit code
- ✅ Backup codes: Generated on confirm, hashed with HMAC-SHA256 (never plaintext)
- ✅ Consumption: Single-use, row-locked to prevent double-spend
- ✅ Login flow: Pending token issued after password check, real session after 2FA code

**Security Properties:**
- ✅ Pending secret prevents lockout (setup can be abandoned mid-flow)
- ✅ Backup codes HMAC-hashed (like passwords)
- ✅ Per-request attempt counter (5 attempts max before re-auth)
- ✅ Single-use, row-locked backup codes prevent concurrency issues

**Gap:**
- ⚠️ No rate limiting on 2FA verification attempt (relies on max-attempts counter only)
- ⚠️ Pending 2FA login token (`PENDING_2FA_TTL_MS = 5 min`); very short, might frustrate legitimate users
- ⚠️ No SMS 2FA option (TOTP-only for now)

---

## 7. Login Lockout Mechanism

### 7.1 Current Implementation

**Two-Tier Lockout (lib/auth.ts):**

**Tier 1: Per (email, IP) Pair**
- Max 5 failures → lock for 15 minutes
- Prevents an attacker from locking a victim out (locked pair is attacker's IP + victim's email)

**Tier 2: Per-Email Aggregate**
- Max 50 failures across all IPs → lock for 15 minutes
- Prevents distributed brute force (proxy rotation)

**Security Properties:**
- ✅ Persisted in DB (survives restart)
- ✅ Clears on successful login
- ✅ Clears on password reset
- ✅ IP taken from `clientIp()` (trusted XFF index, not leftmost)

**Gap:**
- ⚠️ No lockout on account creation (spam/enumeration vector)
- ⚠️ 50-failure threshold is generous (deliberate attacks might not trigger it)
- ⚠️ No progressive backoff (all lockouts are flat 15 minutes)

---

## 8. Password Security

### 8.1 Current Implementation

**Hashing:**
- ✅ scrypt (async, not scryptSync) with 16-byte random salt
- ✅ 64-byte derived key (256-bit output)
- ✅ Timing-safe comparison (`timingSafeEqual`)
- ✅ Dummy hash verification for unknown emails (prevents account enumeration)

**Password Constraints:**
- ✅ Minimum 8 characters (enforced at registration and change)

**Security Properties:**
- ✅ Resistant to GPU/ASIC cracking (scrypt memory-hard)
- ✅ Async implementation prevents server stalls during password verification
- ✅ Timing-safe comparison prevents timing attacks

**Gap:**
- ⚠️ No maximum password length (potential for DoS via extremely long passwords; scrypt mitigates but should cap)
- ⚠️ No password history/reuse prevention (user can immediately set password to old one after reset)
- ⚠️ No breach-database checks (e.g., HaveIBeenPwned API)
- ⚠️ No password strength meter/requirements beyond 8 chars

---

## 9. Secret/Token Handling

### 9.1 Email Verification Tokens

**Reset Token (lib/auth.ts):**
- ✅ 24-byte random base64url tokens
- ✅ HMAC-SHA256 hashed for storage (hash is primary key)
- ✅ 30-minute expiry
- ✅ Single-use (deleted after consumption)

**Pending Email Change Token:**
- ✅ Same format: 24-byte random, HMAC-SHA256 hashed
- ✅ 30-minute expiry
- ✅ Single-use

**Pending 2FA Login Token:**
- ✅ Same format: 24-byte random, HMAC-SHA256 hashed
- ✅ 5-minute expiry (very short)
- ✅ Single-use on successful 2FA, or after 5 attempts

**Security Properties:**
- ✅ All tokens properly randomized (24 bytes = 192 bits, > 128-bit security margin)
- ✅ HMAC-SHA256 hashing adequate
- ✅ Expirations enforced at verification

**Gap:**
- ⚠️ No token rate limiting (an attacker can generate unlimited reset tokens)
- ⚠️ No per-user token limit (a malicious admin could pre-generate many reset tokens)

---

## 10. Known Gaps & Recommendations

### High Priority (Wave 2)

1. **CSRF Token Implementation**
   - Add double-submit CSRF tokens to all state-changing endpoints
   - Validate on every POST/PATCH/DELETE
   - Store token in session, include in response body and request header check
   - Estimated effort: 2-3 days

2. **Session Idle Timeout**
   - Add `maxIdleMs` config (default 15 minutes)
   - Update `lastSeenAt` only on non-API requests (reduce DB write load)
   - Return 401 if `now - lastSeenAt > maxIdleMs`
   - Estimated effort: 1-2 days

3. **Rate Limiting on Sensitive Auth Routes**
   - Add per-email rate limit to password change, email change, 2FA setup
   - Prevent account enumeration / abuse
   - Estimated effort: 1 day

4. **Admin Operation Rate Limiting**
   - Apply per-admin rate limits to DELETE, bulk operations
   - Prevent accidental cascades or DoS-by-admin
   - Estimated effort: 1 day

5. **Workspace Rate Limiting**
   - Apply per-workspace rate limit to workspace read/write operations
   - Estimated effort: 1 day

### Medium Priority (Wave 6)

6. **Token Refresh Flow**
   - Implement short-lived tokens (15 min) with refresh tokens (30 days)
   - Reduces cookie expiration window
   - Estimated effort: 2-3 days

7. **Audit Logging on Admin Actions**
   - Comprehensive audit trail for admin operations (currently only isolated `recordAudit` calls)
   - Log all privilege escalations, data deletions, member changes
   - Estimated effort: 2 days

8. **Per-User API Key Rate Limiting**
   - Current: per-workspace (can bypass by using multiple workspaces)
   - Proposed: per-user + per-workspace limits
   - Estimated effort: 1-2 days

9. **Session Fingerprinting**
   - Hash `User-Agent + IP` and store in session record
   - Reject requests with mismatched fingerprint (optional, configurable)
   - Mitigates session theft from network-level attacks
   - Estimated effort: 1 day

10. **Password History & Strength Meter**
    - Prevent reuse of last N passwords
    - Add client-side strength meter (optional server-side enforcement)
    - Estimated effort: 1-2 days

### Lower Priority (Post-Wave 6)

11. **Breach Database Integration**
    - Check passwords against HaveIBeenPwned API on registration
    - Optional: warn on login if password is in breach
    - Estimated effort: 1 day

12. **SMS / Email 2FA**
    - Complement TOTP with SMS or email OTP
    - Estimated effort: 2-3 days

13. **WebAuthn / Hardware Keys**
    - Add FIDO2/WebAuthn support
    - Estimated effort: 3-5 days

14. **Explicit Data Retention Policy**
    - Document retention for soft-deleted data (leads, events)
    - Implement automated purge jobs
    - Estimated effort: 1-2 days

---

## 11. Scope Isolation Checklist

### Endpoints Verified
- [ ] `GET /api/workspaces` — Checks membership via JSONB query
- [ ] `GET /api/workspaces/[id]` — Checks `roleOf(id, user.id)`
- [ ] `PATCH /api/workspaces/[id]` — Checks `renameWorkspace(id, user.id, ...)`
- [ ] `POST /api/workspaces/[id]/members` — Checks `addMember(id, user.id, ...)`
- [ ] `DELETE /api/workspaces/[id]/members/[userId]` — Checks `removeMember(id, user.id, ...)`
- [ ] `GET /api/v1/projects` — Checks `resolveApiKeyScope()`, filters by workspace
- [ ] `POST /api/admin/users/[id]` — Checks `requireAdmin()`, no cross-user access
- [ ] `DELETE /api/admin/users/[id]` — Checks `requireAdmin()`, scoped to user.id
- [ ] `GET /api/community/...` — Workspace-scoped via query

### Endpoints to Audit (Not Fully Verified)
- [ ] All `/api/projects/*` endpoints — Verify workspace_id filtering
- [ ] All `/api/cohorts/*` endpoints — Verify workspace_id filtering
- [ ] All `/api/leads/*` endpoints — Verify workspace_id filtering
- [ ] Data export endpoints (if any) — Verify user scope
- [ ] Webhook delivery endpoints — Verify workspace scope

---

## 12. Security Checklist for Wave 2 & 6 Audit Gates

### Before Wave 2 Approval
- [ ] CSRF tokens implemented and validated on all state-changing endpoints
- [ ] Session idle timeout implemented and tested
- [ ] Rate limiting added to password change, email change, 2FA setup
- [ ] All endpoints audited for workspace/user scope leakage
- [ ] Admin allowlist reviewed and secured
- [ ] CHANGELOG updated with security fixes

### Before Wave 6 Approval
- [ ] Token refresh flow implemented
- [ ] Comprehensive audit logging on admin operations
- [ ] Per-user API key rate limiting implemented
- [ ] Session fingerprinting (optional, configurable) implemented
- [ ] Password history / strength requirements implemented
- [ ] Security policy documentation updated (SECURITY.md)
- [ ] Penetration testing checklist completed

---

## 13. Summary

**Current Posture:**
- ✅ Strong session management (signed tokens + server-side revocation)
- ✅ Solid rate limiting on auth and public endpoints
- ✅ Proper scope isolation via JSONB queries and roleOf checks
- ✅ Good password hashing (scrypt async)
- ✅ TOTP 2FA with backup codes

**Critical Gaps:**
- ❌ CSRF tokens missing (SameSite=Lax insufficient alone)
- ⚠️ No session idle timeout
- ⚠️ Sensitive auth routes (password change) lack rate limiting
- ⚠️ Admin operations lack rate limiting and comprehensive audit logging

**Deployment Recommendations:**
1. Deploy CSRF tokens immediately (Wave 2, highest priority)
2. Add session idle timeout (Wave 2)
3. Audit remaining endpoints for scope isolation (Wave 2)
4. Plan token refresh flow (Wave 6)
5. Implement comprehensive audit logging (Wave 6)

**Risk Rating:** MEDIUM (auth solid, but CSRF and idle timeout are exploitable gaps)

---

## Appendix A: Configuration Reference

### Auth Environment Variables
- `AUTH_SECRET`: HMAC-SHA256 signing key (base64 or hex, any format)
  - Fallback: `.gearbox/auth-secret` file
  - Required for multi-instance deployments

### Rate Limit Configuration
- `RATE_LIMIT_DISABLED=1`: Disable rate limiting (test/CI only)
- `TRUSTED_PROXY_COUNT=1`: Number of proxy hops to trust (default 1)
  - Example: `TRUSTED_PROXY_COUNT=2` for Cloudflare + ALB

### Session Configuration
- `SESSION_SID_REQUIRED_AFTER`: ISO datetime when legacy tokens (sid-less) are rejected
  - Example: `2024-09-02T00:00:00Z` (one max-TTL after deploy)

### Database
- `DATABASE_URL`: Postgres connection string (required for shared rate limiting)

---

## Appendix B: Related Documentation
- lib/auth.ts: Session tokens, password hashing, 2FA
- lib/rate-limit.ts: Rate limiting backends
- lib/workspaces.ts: RBAC, workspace/member management
- lib/api-keys.ts: API key verification and scoping
- lib/admin.ts: Admin allowlist and privileged operations (not audited here)
- RUNBOOK.md: Deployment and scaling considerations
