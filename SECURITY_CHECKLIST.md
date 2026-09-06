# ONEVYRT Security Checklist

## Critical Security Implementations

### 1. CSRF Token Protection ✅ (Wave 1)

**Status:** Implemented and enforced

**Implementation:**
- **Middleware:** `lib/middleware/csrf.ts`
  - Token generation: 256 bits of cryptographic entropy
  - Token signing: HMAC-SHA256 with server AUTH_SECRET
  - Token storage: httpOnly, Secure, SameSite=Lax cookie (`gb_csrf_token`)
  - Token validation: Checked in `validateCsrf()` before state-changing requests

- **Client-side:** `lib/hooks/use-csrf-token.ts`
  - React hook for accessing CSRF token in client components
  - Usage: Pass token value in `x-csrf-token` request header

- **Layout:** `app/layout.tsx` + `components/SecurityInitializer.tsx`
  - CSRF token auto-initialized on every page load
  - Token meta tag injected in `<head>` for client-side access

**API Route Integration:**
To add CSRF protection to any POST/PUT/DELETE route:

```typescript
import { validateCsrf } from "../lib/middleware/csrf";

export const POST = async (req: Request): Promise<Response> => {
  // Validate CSRF first
  const csrfError = await validateCsrf(req);
  if (csrfError) return csrfError;
  
  // Continue with your handler
  // ...
};
```

**Form/Fetch Integration:**
```typescript
// Client-side with useCSRFToken hook
const { token } = useCSRFToken();

// In forms (add to all POST/PUT/DELETE actions)
const response = await fetch("/api/foo", {
  method: "POST",
  headers: {
    "x-csrf-token": token,
    "content-type": "application/json",
  },
  body: JSON.stringify(data),
});

// In HTML forms (hidden input)
<form method="POST" action="/api/foo">
  <input type="hidden" name="csrf" value={csrfToken} />
</form>
```

**Testing CSRF:**
- CSRF validation will reject requests without a token → 403 Forbidden
- Token mismatch or invalid signature → 403 Forbidden
- Valid token + correct signature → Request proceeds

**Known Issues:**
- [ ] Not yet wired into all state-changing routes (Wave 2 follow-up)
- [ ] Form submission helpers not yet built (placeholder in use-csrf-token.ts)

---

### 2. TLS Certificate Verification ✅ (Wave 1)

**Status:** Implemented and enforced in production

**Implementation:**
- **Database:** `lib/db.ts` - `buildSslConfig()`
  - **Production:** Requires valid TLS certificate verification
    - Must set ONE of: `DATABASE_CA_CERT`, `DATABASE_CA_CERT_PATH`, or `DATABASE_SSL_REJECT_UNAUTHORIZED=1`
    - If not set, app fails to start with clear error message
    - If set but `rejectUnauthorized=false`, throws error at startup
  - **Development:** Allows permissive verification (localhost or no TLS)
    - Auto-generates permissive config with warning if no CA provided
    - Useful for dev-tier Postgres without cert in Node trust store

- **Startup Check:** `lib/startup-checks.ts` - `checkDatabaseTLS()`
  - Validates configuration on app startup
  - Throws immediately if production requirements aren't met

**Configuration:**

**Option 1: Inline CA Certificate**
```bash
# PEM-format CA bundle, often from provider's console
export DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----\n..."
```

**Option 2: CA Certificate File**
```bash
# Path to a PEM file on the filesystem
export DATABASE_CA_CERT_PATH="/etc/ssl/certs/ca-bundle.crt"
```

**Option 3: Use Node's Default Trust Store**
```bash
# For providers whose cert is already in Node's default trust store
export DATABASE_SSL_REJECT_UNAUTHORIZED=1
```

**Testing TLS:**
- Production with no cert config → App fails to start (expected)
- Development with no cert config → App starts with warning
- Valid cert in production → App starts successfully
- Invalid cert + `rejectUnauthorized=true` → Connection fails

---

### 3. AUTH_SECRET Production Enforcement ✅ (Wave 1)

**Status:** Implemented and enforced in production

**Implementation:**
- **Auth Module:** `lib/auth.ts` - `checkAuthSecretConfiguration()`
  - Called automatically when auth.ts is imported (module load time)
  - **Production:** Requires explicit `AUTH_SECRET` environment variable
    - If not set, app fails immediately with actionable error
    - Prevents accidental session loss on container restart
  - **Development:** Allows auto-generation with warning
    - Stored in `.gearbox/auth-secret` (0600 permissions)
    - Used only for session/token signing (HMAC-SHA256 key material)

- **Startup Check:** `lib/startup-checks.ts` - `checkAuthSecret()`
  - Called after DATABASE_TLS check
  - Confirms production readiness

**Configuration:**

Generate a secure random AUTH_SECRET:
```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
# Output: 64-character hex string (256 bits of entropy)
```

Set it as environment variable:
```bash
export AUTH_SECRET="abc123def456..."  # Generated value above
```

**Important Notes:**
- ALL app instances MUST share the same AUTH_SECRET
- If instances have different secrets, sessions will be invalidated on failover
- Never commit AUTH_SECRET to source control
- Rotate it if compromised (invalidates all existing sessions)
- For multi-instance deployments, set it in your deployment platform's secrets manager

**Testing AUTH_SECRET:**
- Production without `AUTH_SECRET` → App fails at startup (expected)
- Development without `AUTH_SECRET` → Auto-generates with warning (expected)
- Production with `AUTH_SECRET` set → App starts successfully

---

## Rate Limiting (Wave 1 Enhanced)

**Status:** Postgres-backed rate limiting implemented

**Implementation:**
- **Module:** `lib/rate-limit.ts`
  - Shared Postgres backend (multiple instances honored)
  - In-memory fallback if DB unavailable
  - Fixed-window (resets periodically, not sliding)

**Current Rate Limits:**
- `/api/auth/login` — Per IP, per 15 minutes: 5 attempts
- `/api/auth/register` — Per IP, per 15 minutes: 5 attempts
- `/api/account/export` — Per user, per hour: 5 exports
- `/api/community/comments` — Per workspace, per 15 minutes: 10 comments
- `/api/programme/chapter/4/submit` — Per workspace, per minute: 20 submits

**Adding Rate Limiting to New Routes:**
```typescript
import { checkRateLimit, retryAfterHeader } from "../lib/rate-limit";

export const POST = async (req: Request): Promise<Response> => {
  // Rate limit by user workspace (not IP)
  const rl = await checkRateLimit(`my-action:${workspaceId}`, {
    windowMs: 60_000,  // 1-minute window
    max: 20,           // 20 requests per window
  });
  
  if (!rl.allowed) {
    return json(
      { error: "rate limit exceeded" },
      429,
      retryAfterHeader(rl.retryAfterMs!),
    );
  }
  
  // Proceed with handler
};
```

**Response Headers:**
- `X-RateLimit-Limit` — The window's ceiling (max requests)
- `X-RateLimit-Remaining` — Requests still allowed in current window
- `X-RateLimit-Reset` — When the window resets (epoch seconds)
- `Retry-After` — Seconds to wait (429 responses only)

---

## Security Gaps & Follow-ups (Wave 2+)

### Not Yet Implemented
- [ ] **CSRF:** Not wired into all state-changing API routes (need per-route integration)
- [ ] **CSRF:** Form submission helpers for HTML forms (use-csrf-token.ts stub only)
- [ ] **Rate Limiting:** Not enforced on lesson-level submit/review routes
- [ ] **CORS:** Dedicated CORS middleware (currently only SameSite=Lax cookie)
- [ ] **Input Validation:** Centralized request body schema validation
- [ ] **Scope Isolation:** Full audit of query-level workspace checks
- [ ] **Audit Logging:** Track security-relevant events (login, auth failures, etc.)
- [ ] **PII Encryption:** Standardize encryption at rest for sensitive fields

### Planned for Wave 2
1. **Per-Route CSRF:** Integrate validateCsrf into all POST/PUT/DELETE routes
2. **Form Helpers:** useCSRFForm hook for React form components
3. **Session Management:** Rate limit per-IP login failures (already done)
4. **Admin Audit Log:** Track account mutations, permission changes, exports

### Planned for Wave 3
1. **Enhanced Rate Limiting:** Adaptive limits based on user tier
2. **IP-based Blocks:** Temporary block for repeated auth failures
3. **Audit Trail:** Persistent log of sensitive operations

---

## Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate and set `AUTH_SECRET` (save in secrets manager, never commit)
- [ ] Configure `DATABASE_CA_CERT` or `DATABASE_CA_CERT_PATH` or `DATABASE_SSL_REJECT_UNAUTHORIZED=1`
- [ ] Test startup: App should boot without warnings
- [ ] Test CSRF: Submit a form without x-csrf-token header, expect 403
- [ ] Test TLS: Verify DB connection uses HTTPS with valid certificate
- [ ] Review active session limits (optional: implement max sessions per user)

---

## References

- **OWASP CSRF Prevention:** https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- **OWASP Session Management:** https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- **NIST Password Guidelines:** https://pages.nist.gov/800-63-3/sp800-63b.html
- **Node.js TLS:** https://nodejs.org/api/tls.html
- **Postgres SSL:** https://www.postgresql.org/docs/current/libpq-ssl.html

---

Last Updated: 2026-09-02  
Security Wave: 1 (Foundations)  
Next Review: After Wave 2 implementation
