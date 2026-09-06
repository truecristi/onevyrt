# ONEVYRT Security Checklist & Compliance Tracking

**Last Updated:** 2026-09-02  
**Scope:** Production system audit covering authentication, authorization, data protection, API security, infrastructure, compliance, and incident response.  
**Status Legend:** ✅ Implemented | ⚠️ Partial | ❌ Not Done

---

## Authentication

### Session Management

**Status:** ✅ Implemented (solid foundation)

**What Works:**
- HMAC-SHA256 signed stateless session cookies with 30-day TTL
- Async scrypt password hashing (50-100ms, non-blocking via libuv worker pool)
- Session records in database for per-session revocation (not global secret rotation)
- User agent tracking on session creation for anomaly detection
- 2FA support (TOTP + 10 backup codes) via `lib/twofa.ts`
- Pending 2FA login tokens for gradual auth flow
- Session decay on logout (database-backed, immediate revocation)

**What's Missing:**
- Session timeout policy (should force re-auth after inactivity, e.g., 6 hours)
- Refresh token rotation on sensitive operations
- Session fixation protection (no SameSite cookie flag documented)
- Concurrent session limits (device/browser caps per user)
- User agent change detection (alert on login from new device)
- MFA enforcement for sensitive operations (workspace deletion, billing changes)

**Wave 2 Action Items:**
- [ ] Add session idle timeout (30 mins inactivity → re-auth)
- [ ] Implement SameSite=Strict on session cookies
- [ ] Add user agent change detection + email alert flow
- [ ] Enforce MFA for: workspace deletion, member role changes, billing updates
- [ ] Document session TTL policy per operation (short-lived for payments, long for routine)

---

### CSRF Protection

**Status:** ❌ Not Implemented (critical gap)

**What's Missing:**
- No CSRF tokens on POST/PUT/DELETE endpoints
- No double-submit cookie checks
- No origin/referer validation middleware
- Risk: Form-based cross-origin attacks on state-changing operations

**Wave 2 Action Items:**
- [ ] Add CSRF middleware: generate token on page load, validate on mutations
- [ ] Protect all `POST`, `PUT`, `PATCH`, `DELETE` routes via token verification
- [ ] Implement per-session token (rotate on each request for maximum security)
- [ ] Add origin/referer validation for API calls without valid CSRF token
- [ ] Document CSRF exemptions (webhooks: Stripe requires unsigned POST)

---

### Multi-Factor Authentication

**Status:** ⚠️ Partial (opt-in only)

**What Works:**
- TOTP (Time-based OTP) via authenticator apps
- 10 backup codes printed/stored by user
- 2FA required to complete login flow (cannot bypass to session)
- Separate pending-2FA token (proves password was correct)

**What's Missing:**
- 2FA not enforced for workspace owners
- SMS-based TOTP not offered (only authenticator app)
- Recovery code audit trail missing (which codes were used when)
- 2FA recovery flow unclear if user loses device
- No 2FA setup enforcement for new accounts

**Wave 2 Action Items:**
- [ ] Enforce 2FA for workspace owners (mandatory)
- [ ] Add SMS-based OTP option (via Twilio, existing integration available)
- [ ] Log backup code usage (prevent reuse, track depletion)
- [ ] Build 2FA recovery flow (admin override after identity verification)
- [ ] Email confirmation when 2FA is enabled/disabled/changed

---

### Password Security

**Status:** ✅ Implemented (solid)

**What Works:**
- Scrypt KDF (16-byte salt, 64-byte derived key)
- Timing-safe comparison (prevents timing attacks on hash validation)
- No password complexity rules (UX-friendly, KDF handles entropy)
- Password reset tokens signed with secret (not database-backed)

**What's Missing:**
- No password breach detection (should check against HaveIBeenPwned)
- No password history (reuse allowed)
- No password change enforcement (after X days, after breach, after role change)
- Reset token TTL unclear (should expire after 1 hour)

**Wave 2 Action Items:**
- [ ] Integrate HIBP API on password change (warn if breached)
- [ ] Document reset token TTL and implement if missing
- [ ] Add optional password expiry policy per workspace (compliance)
- [ ] Prevent password reuse (last 5 passwords)

---

## Authorization & Access Control

### Role-Based Access Control (RBAC)

**Status:** ✅ Implemented (workspace-scoped)

**What Works:**
- Four roles per workspace: `owner` (full control) | `manager` (coach operations) | `editor` (projects) | `viewer` (read-only)
- Member list stored as JSON array in workspace row (indexed via GIN)
- Role check on every workspace operation via `listForUser()` first
- Workspace queries filtered: `WHERE workspace_id = $1` (SQL-level isolation)
- Row-level locking via Postgres `FOR UPDATE` during member mutations

**What's Missing:**
- No permission matrix documentation (what each role can actually do)
- Scope audit for community features incomplete (comments/reactions by author workspace)
- No cross-workspace permissions (e.g., admin viewing all workspaces)
- Permission denial reasons not logged
- Bulk role change operations not atomic

**Wave 2 Action Items:**
- [ ] Document RBAC matrix: role → allowed operations (as code comment or table)
- [ ] Complete scope audit for community features (comments, reactions, moderation)
- [ ] Add cross-workspace admin scope (admins can view/audit any workspace)
- [ ] Log permission denials: `{user_id, action, workspace_id, reason, timestamp}`
- [ ] Implement bulk member operations (add/remove multiple, atomic)
- [ ] Add permission inheritance rules (owner auto-has all viewer/editor/manager perms)

---

### Scope Isolation

**Status:** ⚠️ Partial (audit needed for community)

**What Works:**
- Workspace operations check `listForUser(user.id)` before reading/writing
- Project CRUD filtered by workspace membership
- Enrollment/cohort scoped to workspace enrollment
- Activity log keyed by workspace + user
- GDPR export scoped to `listForUser()` results only

**What's Missing:**
- Community comments/reactions not queryable by author workspace (only by artifact)
- No author-scoped read for shared templates/creatives I've commented on
- Moderation operations may lack scope checks (needs audit)
- API key scope not fully documented

**Wave 2 Action Items:**
- [ ] Add `getCommentsByAuthor(workspaceId)` in lib/community/comments.ts
- [ ] Add `getReactionsByAuthor(workspaceId)` in lib/community/reactions.ts
- [ ] Audit moderation API routes for cross-workspace leakage
- [ ] Document API key scope (what can each key access)
- [ ] Test that viewer role cannot access editor/manager-only endpoints

---

### API Key Authentication (Partial)

**Status:** ⚠️ Partial (exists but needs hardening)

**What Works:**
- API keys stored in database (lib/db.ts: api_keys table)
- Keys likely scoped to workspace or user

**What's Missing:**
- No documented format or security properties
- No rate limiting per API key (only per IP/user)
- No key rotation policy
- No audit log of API key usage
- No granular scopes (e.g., read-only, projects-only)

**Wave 2 Action Items:**
- [ ] Document API key spec: format, how to issue, rotation policy
- [ ] Implement per-key rate limits (separate from IP/user limits)
- [ ] Add rate-limit header response per key
- [ ] Log all API key usage (key_id, endpoint, user_agent, timestamp)
- [ ] Support key scopes: `read`, `read:projects`, `read:programme`, `write:*`
- [ ] Add key expiry date (max 1 year, warn at 90 days)

---

## Data Protection

### Encryption at Rest

**Status:** ⚠️ Partial (relies on infrastructure, not application-level)

**What Works:**
- PostgreSQL on Fly.io (likely encrypted by host, needs verification)
- Sensitive data stored in database (no plaintext secrets in code)
- Password hashes salted and properly derived

**What's Missing:**
- No application-level field-level encryption
- PII not encrypted (email, workspace names, user names visible in DB)
- No transparent data encryption (TDE) configuration documented
- Encryption key material not managed by application
- No encryption key rotation policy

**Wave 2 Action Items:**
- [ ] Document Fly.io data encryption settings (at-rest, backups, TDE)
- [ ] Evaluate field-level encryption for high-risk PII (email in some contexts, sensitive notes)
- [ ] Implement TDE-aware backup/restore process
- [ ] Add key rotation schedule (if using Fly encryption manager)
- [ ] Document compliance implications (PCI-DSS, GDPR encryption requirements)

---

### Encryption in Transit

**Status:** ✅ Implemented (solid)

**What Works:**
- HTTPS enforced via Cloudflare Tunnel (TLS 1.2+)
- HSTS header: `max-age=63072000; includeSubDomains; preload` (2 years, subdomains, preload list)
- Secure cookies: `SameSite` flag (check if Strict/Lax)
- No mixed content (all external resources on HTTPS)

**What's Missing:**
- SameSite cookie setting not confirmed in code (should be Strict or Lax)
- Certificate pinning not implemented (if MITM risk relevant)
- No documented TLS version enforcement (should be 1.2+ minimum)
- Websocket encryption not documented (if used for real-time features)

**Wave 2 Action Items:**
- [ ] Confirm SameSite=Strict on session cookies (check `lib/auth.ts`)
- [ ] Document TLS minimum version in Cloudflare/Vercel config
- [ ] Audit WebSocket usage for TLS enforcement (should use wss://, not ws://)
- [ ] Add Public Key Pinning (HPKP) if MITM is high-risk concern

---

### PII Handling

**Status:** ⚠️ Partial (not standardized)

**What Works:**
- No password hashes in GDPR export (currentUser never returns hash)
- 2FA secrets not exposed via API
- Email verification OTP scoped (7-day retention, hard-delete after)
- Soft-delete on account deletion (deleted_at IS NULL queries)

**What's Missing:**
- No data classification (what counts as PII, what needs protection)
- No standard for PII purging (some data retained after deletion, no clear policy)
- Email stored in plaintext (searchable but visible to DB admins)
- User names, avatars not encrypted (visible to anyone in same workspace)
- Workspace names visible to all members (ok for team setting, but document assumption)

**Wave 2 Action Items:**
- [ ] Create PII classification policy: Tier 1 (email, passwords) | Tier 2 (user names, workspace names) | Tier 3 (business data in projects)
- [ ] Implement PII purging schedule (30/60/90 days after soft-delete based on tier)
- [ ] Document workspace name visibility (assume team collaboration, OK to share within workspace)
- [ ] Evaluate email encryption (if needed for compliance; likely overkill)
- [ ] Audit user-visible queries for PII leakage (e.g., workspace switcher showing names)

---

### Data Retention & Deletion

**Status:** ⚠️ Partial (soft-delete implemented, policies not documented)

**What Works:**
- Soft-delete pattern: `deleted_at IS NULL` for live records
- Hard-purge jobs run nightly (retention window 7-30 days)
- Activity log, job runs, OTP codes auto-expire
- GDPR export gives users data portability
- Account deletion cascade (delete enrollments, cohort rosters, leads/bookings)

**What's Missing:**
- Retention policy not documented by data type (activity log: 30 days? 90? 1 year?)
- Hard-purge schedule not centralized (scattered in jobs)
- Backup retention policy not documented (how long are DB backups kept?)
- Deleted workspace recovery window unclear (can owner restore soft-deleted projects?)

**Wave 2 Action Items:**
- [ ] Document retention tiers: transient (7d: OTP, job runs) | operational (30d: activity log) | long-term (90d+: project history, invoices)
- [ ] Centralize hard-purge schedule in `lib/jobs.ts` (one source of truth)
- [ ] Document backup retention (Fly.io policy: 7 days? 30 days?)
- [ ] Test account deletion cascade (ensure no orphaned records)
- [ ] Add recovery option: workspace owner can restore soft-deleted projects within 7 days

---

## API Security

### Input Validation

**Status:** ⚠️ Partial (not consistent)

**What Works:**
- Login route validates email/password are strings (line 19, api/auth/login)
- JSON parsing wrapped in try/catch (rejects malformed JSON)
- Rate limiting applied on heavy endpoints (export, OTP send, moderation)

**What's Missing:**
- No schema validation library (zod, joi, valibot)
- Text inputs not length-checked (email, workspace name, project title)
- JSON payloads not validated beyond type checks (shape, required fields)
- XSS prevention not explicit (relies on React's default escaping)
- SQL injection protection: parameterized queries used, but no automated audit

**Wave 2 Action Items:**
- [ ] Add zod/valibot schema validation to all API routes
- [ ] Define max lengths: email (254), names (100), text fields (5000), JSON (10MB)
- [ ] Validate POST/PUT payloads against schema before processing
- [ ] Add XSS content sanitizer for user-generated content (project titles, comments, workspace names)
- [ ] Audit parameterized queries (grep for non-parameterized constructs)
- [ ] Add NoSQL injection tests if using any document stores

---

### Rate Limiting

**Status:** ✅ Implemented (solid, but could be per-key)

**What Works:**
- Per-user + per-IP sliding window limiting (dual strategy)
- 5 data-export requests per hour (avoid DB hammering)
- 20 login attempts per IP per minute (brute-force defense)
- Per-email login lockout (email + IP key prevents account enumeration)
- Postgres-backed shared limiter across instances (not per-process)
- Graceful degradation to in-memory if DB unavailable

**What's Missing:**
- No per-API-key rate limiting (should have separate tier)
- No endpoint-specific limits documented (which endpoints, what limits?)
- No rate-limit bypass for admins (e.g., bulk imports)
- No fine-grained limiting by endpoint category (auth, data, community)
- Limits hardcoded in routes (should be centralized + configurable)

**Wave 2 Action Items:**
- [ ] Centralize rate-limit config in `lib/rate-limit.ts` with named constants
- [ ] Add per-API-key rate limits (e.g., 100 req/min for free tier, 1000 for paid)
- [ ] Document limits by endpoint: login (20/min/ip), export (5/hour/user), webhook (100/sec), etc.
- [ ] Add admin bypass flag (for bulk operations)
- [ ] Implement graduated backoff: 429 with Retry-After that increases (exponential)

---

### Cross-Origin Resource Sharing (CORS)

**Status:** ⚠️ Partial (no explicit CORS middleware, assumes same-origin)

**What Works:**
- X-Frame-Options: SAMEORIGIN (no clickjacking)
- Form-action: 'self' (no cross-origin form submission)
- Frame-ancestors: 'self' (no embedding in other domains)

**What's Missing:**
- No CORS headers (Access-Control-Allow-Origin, etc.)
- No CORS policy documented (is cross-origin API access intended?)
- Webhooks likely need cross-origin support (Stripe, Twilio)
- No CORS preflight handling documented

**Wave 2 Action Items:**
- [ ] Define CORS policy: which origins can call which endpoints?
- [ ] Add CORS middleware (if needed for external API consumers)
- [ ] Document webhook CORS exemptions (Stripe, Twilio should not require CORS)
- [ ] Test CORS headers on public API endpoints (if any)

---

### CORS, CSRF, and Webhook Security

**Status:** ⚠️ Webhook signatures validated, but CSRF missing

**What Works:**
- Stripe webhooks validated via HMAC-SHA256 signature (lib/stripe.ts likely)
- Webhook handler only processes signed events

**What's Missing:**
- Webhook replay attack protection (idempotency keys not documented)
- Webhook retry/duplicate handling (what if Stripe resends same event?)

**Wave 2 Action Items:**
- [ ] Add webhook event deduplication (track processed event_id + timestamp)
- [ ] Implement idempotency key support for webhook handlers
- [ ] Test webhook security: unsigned event (should reject), modified signature (should reject)

---

## Infrastructure & Secrets Management

### Secrets Management

**Status:** ⚠️ Partial (env vars + file-based, but no rotation)

**What Works:**
- AUTH_SECRET stored in .gearbox/auth-secret (0600 file permissions, not readable by others)
- ENV var priority: `process.env.AUTH_SECRET` first, then file fallback
- Multi-instance compatible: same AUTH_SECRET across replicas
- Secrets not logged (no accidental leak in debug output, check logger)

**What's Missing:**
- No secrets rotation policy (how often should AUTH_SECRET change?)
- No key versioning (multiple keys active for gradual rotation)
- No secrets audit trail (which secrets, who accessed, when)
- Backup process unclear (are secrets in backups? encrypted?)
- Third-party secrets not centralized (Stripe, OpenAI, Twilio keys)

**Wave 2 Action Items:**
- [ ] Implement key versioning (old + new AUTH_SECRET valid during rotation period)
- [ ] Add 90-day AUTH_SECRET rotation reminder (ops manual step or automated)
- [ ] Centralize third-party secrets in env (no hardcoded API keys in code)
- [ ] Document backup encryption: secrets in backups encrypted-at-rest
- [ ] Add secrets audit log: every secret read logged (optional, high-overhead)
- [ ] Use Vercel secrets / Fly Secrets only (not .env.local in production)

---

### Logging & Monitoring

**Status:** ⚠️ Partial (activity log exists, but monitoring/alerts undocumented)

**What Works:**
- Activity log table: `{workspace_id, user_id, action, metadata, created_at}`
- Route logging wrapper: `withRouteLogging()` captures handler execution
- Client error tracking: `/api/client-error` endpoint for frontend errors
- Analytics events: `track()` function for business metrics

**What's Missing:**
- No security event logging (login failures, permission denials, 2FA usage)
- No unauthorized access attempts tracking (403 denials per user/IP)
- No monitoring/alerting on security events (intrusion detection, rate-limit triggers)
- Logs retention policy not documented
- No log aggregation (where are logs stored? searchable?)
- No real-time alert rules (e.g., 10 failed logins in 5 minutes → alert)

**Wave 2 Action Items:**
- [ ] Add security event log: `{timestamp, event_type, user_id, ip, workspace_id, details}`
- [ ] Log all security-relevant actions: login (success/failure), 2FA, role changes, data exports
- [ ] Integrate monitoring (e.g., Sentry, DataDog) for error tracking + alerting
- [ ] Document log retention: security logs 90+ days, activity logs 30 days, access logs 7 days
- [ ] Create alert rules: failed login rate spike, permission denials, rate-limit exhaustion
- [ ] Test log aggregation (can ops team search logs by user_id, timestamp, event_type?)

---

### Infrastructure Hardening

**Status:** ⚠️ Partial (Cloudflare, Vercel, Fly used, but hardening undocumented)

**What Works:**
- Cloudflare Tunnel (no exposed IPs, WAF rules possible)
- Vercel hosting (auto-scales, DDoS mitigation)
- Fly.io PostgreSQL (managed DB, backups)
- Tailscale bastion (private access option)

**What's Missing:**
- WAF rules not documented (is Cloudflare WAF enabled?)
- Database firewall rules not documented (only app can connect?)
- Network isolation not confirmed (app ↔ DB encrypted? Private network?)
- Firewall deny-by-default not confirmed
- DDoS mitigation threshold not documented
- Intrusion detection not configured

**Wave 2 Action Items:**
- [ ] Enable Cloudflare WAF: OWASP rules, rate limiting, bot management
- [ ] Configure Fly.io private network (database only accessible from app)
- [ ] Document network flow: Cloudflare → Vercel app → Fly.io DB (all encrypted)
- [ ] Test database connection from outside (should fail)
- [ ] Document DDoS mitigation: Cloudflare defaults usually sufficient
- [ ] Set up VPN/Tailscale for sensitive ops (admin CLI access)

---

## Compliance

### GDPR

**Status:** ⚠️ Partial (export implemented, but scope & retention incomplete)

**What Works:**
- Data export endpoint (`/api/account/export`) gives users all their data
- Export includes: account, workspaces, projects, enrollments, cohorts, activity log, invoices
- Soft-delete pattern allows account deletion
- GDPR export rate-limited (5 exports per hour per user)

**What's Missing:**
- Right to be forgotten (data deletion) not fully automated (soft-delete only, no hard purge schedule documented for user data)
- Data processing addendum (DPA) with Cloudflare, Vercel, Fly.io not documented
- Consent management (did user opt into email, SMS, analytics?)
- Sub-processor list not public
- Breach notification procedure not documented
- Privacy policy not linked in CLAUDE.md

**Wave 2 Action Items:**
- [ ] Create comprehensive privacy policy (covering data collection, retention, processing)
- [ ] Document data processing agreements with hosting/service providers
- [ ] Implement data deletion automation (hard purge user data X days after soft-delete)
- [ ] Add consent management (email opt-in, SMS opt-in, analytics opt-out)
- [ ] Document GDPR breach notification process (timeline, stakeholders)
- [ ] Add "right to be forgotten" option in account settings
- [ ] Link privacy policy + terms in web app footer

---

### PCI-DSS (Payment Card Industry)

**Status:** ⚠️ Partial (Stripe handles PCI compliance, but integration needs audit)

**What Works:**
- Stripe Billing integration (invoices, recurring payments)
- Stripe Connect (payouts to partner accounts)
- No card data stored in application (Stripe is PCI-compliant)
- Stripe API keys used only for backend operations

**What's Missing:**
- PCI compliance scope not documented (what's in-scope for application?)
- Webhook signature validation should prevent tampering (check if implemented)
- Secure transmission of Stripe API responses (check SSL/TLS)
- No documentation of Stripe security requirements (API key rotation, webhook secrets)

**Wave 2 Action Items:**
- [ ] Create PCI compliance documentation (Stripe's SAC cert fulfills most requirements)
- [ ] Confirm Stripe webhook signature validation is in place
- [ ] Document Stripe secret management (key rotation every 90 days)
- [ ] Audit Stripe integration for secure data handling
- [ ] Verify no card/payment data logged (check for PII in logs)
- [ ] Test Stripe API call encryption (should be HTTPS only)

---

### SOC 2 (Service Organization Control)

**Status:** ❌ Not Started

**What's Missing:**
- No SOC 2 Type II audit completed
- No change management process documented
- No access control policy documented
- No incident response playbook
- No security awareness training program documented
- No vendor risk management process
- No asset inventory / data catalog

**Wave 2 Action Items:**
- [ ] Create change management process (code review, approval, deployment log)
- [ ] Document access control policy (who can access what, approval workflow)
- [ ] Develop incident response playbook (breach, outage, security event)
- [ ] Establish security awareness training (annual for team)
- [ ] Create vendor risk assessment framework (vendors: Cloudflare, Vercel, Stripe, etc.)
- [ ] Build asset inventory (servers, databases, keys, third-party services)
- [ ] Plan SOC 2 Type II audit (timeline, auditor selection)

---

### HIPAA (Health Insurance Portability & Accountability)

**Status:** ❌ Not Applicable (currently)

**Note:** ONEVYRT does not handle healthcare data. If expansion into healthcare coaching planned, full HIPAA audit required.

---

### CCPA (California Consumer Privacy Act)

**Status:** ⚠️ Partial (similar to GDPR)

**What's Missing:**
- CCPA opt-out mechanism not documented
- Data sale disclosure (does ONEVYRT share data with third parties? Should document)
- Consumer rights (access, delete, opt-out) implementation status unclear

**Wave 2 Action Items:**
- [ ] Audit data sharing practices (is user data shared with partners? Should disclose)
- [ ] Implement "Do Not Sell My Personal Information" link (if applicable)
- [ ] Create CCPA-specific privacy notice (overlap with GDPR, but state-specific)

---

## Incident Response & Security Operations

### Breach Procedures

**Status:** ❌ Not Documented

**What's Missing:**
- No incident classification (critical vs. high vs. medium)
- No incident response team identified
- No communication escalation (who to notify, when)
- No data breach notification timeline (GDPR: 72 hours, CCPA: varies)
- No post-incident review process

**Wave 2 Action Items:**
- [ ] Create incident response playbook:
  - Incident classification (P1: data breach | P2: service unavailable | P3: degraded)
  - First responders: [ops, security lead, CEO]
  - Detection to notification: within 24 hours for P1
- [ ] Define notification timeline (GDPR: 72 hours; CCPA: without undue delay)
- [ ] Create customer notification template (breach email, offers, next steps)
- [ ] Document law enforcement notification (when to involve authorities)
- [ ] Set up incident log (spreadsheet or ticketing system)
- [ ] Plan post-incident review (root cause, preventive measures, follow-up)

---

### Audit Log Retention

**Status:** ⚠️ Partial (activity log exists, but retention policy not documented)

**What Works:**
- Activity log table captures user actions by workspace
- Hard-purge jobs run nightly

**What's Missing:**
- Audit log retention policy not documented (how long to retain?)
- Security events (login, 2FA, permission changes) not captured separately
- Audit log not tamper-proof (how to prevent admin deleting logs?)
- No immutable audit log backend (append-only log storage)

**Wave 2 Action Items:**
- [ ] Define retention tiers:
  - Security logs (login, 2FA, role changes): 90 days minimum
  - Activity logs (project changes, exports): 30 days
  - Access logs (API calls, page views): 7 days
- [ ] Implement tamper-proof audit log (append-only, no deletes)
- [ ] Create audit log export for compliance reports
- [ ] Log admin actions separately (separate table for audit)
- [ ] Test audit log integrity (can logs be modified? Should fail)

---

### Security Awareness & Training

**Status:** ❌ Not Started

**What's Missing:**
- No security training program for team
- No phishing simulation
- No secure coding guidelines
- No security policies for employees

**Wave 2 Action Items:**
- [ ] Create security policy handbook (password, VPN, data handling)
- [ ] Schedule annual security training (2 hours minimum)
- [ ] Conduct quarterly phishing simulations (track click rates)
- [ ] Document secure coding standards (in CLAUDE.md or separate guide)
- [ ] Establish code review security checklist

---

### Vulnerability Management

**Status:** ⚠️ Partial (dependencies managed, but no formal process)

**What Works:**
- pnpm with lock file (reproducible dependencies)
- TypeScript compilation (catches some errors)
- No known critical CVEs in public scan

**What's Missing:**
- No automated vulnerability scanning (e.g., Snyk, Dependabot)
- No patching SLA documented (how fast to patch critical CVE?)
- No security advisory subscription (Node.js, npm, framework updates)

**Wave 2 Action Items:**
- [ ] Enable Dependabot (GitHub) for automatic dependency updates
- [ ] Set up Snyk scanning (critical vulns block merge, high/med create issues)
- [ ] Define patching SLA: critical (1 day), high (1 week), med (2 weeks)
- [ ] Subscribe to security advisories (Node.js, Next.js, Stripe)
- [ ] Test CI/CD: security scanners integrated, failed checks prevent deploy

---

## Deployment & Environment Hardening

### Environment-Specific Security

**Status:** ⚠️ Partial (Vercel deploys to prod, but dev hardening unclear)

**What Works:**
- Auth required for app (no public access without login)
- Rate limiting applies to auth/API routes
- Environment variables set per deployment (Vercel secrets)

**What's Missing:**
- RATE_LIMIT_DISABLED used for testing (should not exist in production)
- Dev origins listed in next.config.ts (could leak dev infrastructure)
- No documented environment parity (dev ≠ prod attack surface)

**Wave 2 Action Items:**
- [ ] Remove RATE_LIMIT_DISABLED in production (only for CI/test)
- [ ] Remove dev origins from production build (Vercel build process should strip)
- [ ] Document environment differences: prod (HTTPS, rate limiting enabled) vs dev (HTTP allowed, limits disabled)
- [ ] Audit Vercel environment variables (no secrets in version control)
- [ ] Test production configuration (rate limits on, CSP enforced, etc.)

---

## Summary: Implementation Status by Wave

### Wave 1 (Discovery) — Completed
- ✅ Security audit (this document)
- ✅ Threat model (auth/data/infra risks identified)
- ✅ Gap identification (CSRF, PII encryption, incident response missing)

### Wave 2 (Hardening) — Priority Items
1. **CSRF protection** (implement tokens on all mutations)
2. **Input validation** (schema validation on all API routes)
3. **Session hardening** (idle timeout, SameSite flag, device change alerts)
4. **Security logging** (login events, permission denials, rate-limit triggers)
5. **Incident response** (playbook, breach procedures, notification timeline)
6. **PII handling** (classification, retention, purging policy)
7. **API key security** (scopes, rate limits, audit log)
8. **Compliance docs** (privacy policy, GDPR DPA, PCI scope documentation)

### Waves 3–6 (Future)
- Testing (E2E security test suite, pen testing)
- Monitoring (alerting on security events, intrusion detection)
- Compliance (SOC 2 audit, HIPAA if needed)
- Automation (security checks in CI/CD, secret scanning, SAST)

---

## Risk Prioritization

### Critical (Block Production)
- [ ] CSRF tokens on all mutations (allow form-based attacks today)
- [ ] Input validation on API routes (prevent injection/overflow)
- [ ] Incident response playbook (no breach response today)

### High (Implement Before Scaling)
- [ ] Session idle timeout (prevent session hijacking)
- [ ] Security event logging (cannot audit incidents today)
- [ ] Rate-limit hardening (per-key, bypass for admins)
- [ ] PII retention policy (GDPR compliance risk)

### Medium (Implement in Wave 2)
- [ ] API key scopes (least privilege)
- [ ] 2FA enforcement for owners (defense in depth)
- [ ] Audit log tamper-proof (SOC 2 preparation)
- [ ] Webhook replay protection (payment integrity)

### Low (Implement in Future Waves)
- [ ] Certificate pinning (MITM risk low with Cloudflare)
- [ ] SOC 2 audit (not blocking unless customers require)
- [ ] HIPAA (only if healthcare expansion planned)

---

## Review & Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Lead | — | — | — |
| Engineering Lead | — | — | — |
| Compliance Officer | — | — | — |

**Next Review Date:** 2026-12-02 (quarterly)  
**Last Updated:** 2026-09-02 by [Claude Haiku 4.5 Security Audit]
