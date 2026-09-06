# API Routes Inventory

**Complete audit of 157 API routes** across 32 feature areas, with scope analysis, auth patterns, and refactoring recommendations.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Routes | 157 |
| Feature Areas | 32 |
| Authenticated Routes | 133 (85%) |
| Rate-Limited Routes | 28 (18%) |
| Workspace-Scoped Routes | 89 (57%) |
| Admin-Only Routes | 18 (11%) |
| Public Routes | 24 (15%) |

**Key Finding:** Wide variation in rate-limiting coverage and workspace-scope enforcement. Many authenticated routes lack explicit workspace isolation checks.

---

## API Routes by Feature Area

### Authentication (19 routes)

Core identity and session management.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| POST | `auth/login` | public | — | ✓ IP+email | 2FA support |
| POST | `auth/register` | workspace-scoped | — | ✓ | Registration with workspace context |
| POST | `auth/logout` | authenticated | ✓ | — | Session cleanup |
| GET | `auth/me` | authenticated | ✓ | — | Current user profile + impersonation |
| POST | `auth/forgot-password` | public | — | ✓ | Email-based reset flow |
| POST | `auth/reset-password` | public | — | ✓ | Token-based reset completion |
| POST | `auth/change-password` | authenticated | ✓ | ✓ | Password change (requires auth) |
| POST | `auth/change-email` | authenticated | ✓ | ✓ | Email change initiation |
| GET | `auth/confirm-email-change` | public | — | — | Email confirmation token |
| POST | `auth/delete-account` | authenticated | ✓ | ✓ | Account deletion (audit-logged) |
| POST,DELETE | `auth/avatar` | authenticated | ✓ | — | Profile picture management |
| GET | `auth/2fa` | authenticated | ✓ | — | 2FA status |
| POST | `auth/2fa/setup` | authenticated | ✓ | ✓ | TOTP provisioning |
| POST | `auth/2fa/confirm` | authenticated | ✓ | ✓ | TOTP confirmation |
| POST | `auth/2fa/disable` | authenticated | ✓ | ✓ | TOTP disable |
| POST | `auth/2fa/login-verify` | public | — | ✓ | 2FA verification during login |
| GET,DELETE | `auth/sessions` | authenticated | ✓ | — | Session listing & logout all |
| DELETE | `auth/sessions/{id}` | authenticated | ✓ | — | Revoke specific session |
| POST | `auth/stop-impersonating` | admin | ✓ | — | Admin impersonation exit (audit-logged) |

**Notes:**
- Strong rate limiting on password reset and 2FA flows
- IP-based rate limiting on login prevents enumeration
- 2FA setup and confirmation should have stricter rate limits (currently same as login)

---

### Account Management (1 route)

Account-level operations outside of auth flow.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `account/export` | authenticated | ✓ | ✓ | GDPR data export (CPU-intensive) |

**Notes:**
- Single route for data export—should consider moving to `account/` directory for consistency
- Rate limiting is appropriate given CPU cost

---

### Admin Dashboard (18 routes)

Admin-only system management (11% of all routes).

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `admin/overview` | admin | ✓ | — | System stats (Stripe sync) |
| GET | `admin/audit` | admin | ✓ | — | Audit log viewer |
| GET | `admin/client-errors` | admin | ✓ | — | Client-side error aggregation |
| GET | `admin/learners` | admin | ✓ | — | Learner list |
| GET | `admin/settings` | admin | ✓ | — | System settings |
| POST | `admin/settings` | admin | ✓ | — | Update system settings (audit-logged) |
| GET | `admin/curriculum` | admin | ✓ | — | Curriculum management |
| POST | `admin/curriculum` | admin | ✓ | — | Create/update curriculum (audit-logged) |
| GET | `admin/programme-offers` | admin | ✓ | — | Offers list |
| POST | `admin/programme-offers` | admin | ✓ | — | Create offers (audit-logged) |
| GET | `admin/lockouts` | admin | ✓ | — | Login lockout list |
| POST | `admin/lockouts` | admin | ✓ | — | Manage lockouts (audit-logged) |
| DELETE | `admin/community` | admin | ✓ | — | Remove community content (audit-logged) |
| GET | `admin/projects/{wsId}/{id}` | admin | ✓ | — | View workspace project |
| POST | `admin/impersonate/{id}` | admin | ✓ | — | Start user impersonation (audit-logged) |
| DELETE | `admin/users/{id}` | admin | ✓ | — | Permanently delete user (audit-logged, irreversible) |
| POST | `admin/users/{id}/status` | admin | ✓ | — | Set user status (audit-logged) |
| DELETE,GET,POST | `admin/workspaces/{id}/*` | admin | ✓ | — | Workspace management (6 sub-routes, all audit-logged) |

**Notes:**
- All admin routes correctly enforce `requireAdmin()` check
- None have rate limiting (acceptable for admin-only endpoints)
- All mutations are audit-logged
- Consider: separate read-only from write endpoints for better API clarity

---

### Workspace Management (4 routes)

Workspace CRUD and member management.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,POST | `workspaces` | workspace-scoped | ✓ | — | List/create workspaces |
| GET,PATCH | `workspaces/{id}` | workspace-scoped | ✓ | — | Get/update workspace (audit-logged) |
| GET | `workspaces/{id}/activity` | workspace-scoped | ✓ | — | Activity log for workspace |
| POST,DELETE | `workspaces/{id}/members` | authenticated | ✓ | — | Add/remove members (audit-logged) |

**Notes:**
- Member management uses authenticated scope (not workspace-scoped)—potential for cross-workspace access if workspace param missing
- No rate limiting on workspace creation (spam risk)

---

### Billing (10 routes)

Stripe integration for subscription management.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| POST | `billing/subscribe` | workspace-scoped | ✓ | — | Create subscription (advisory-locked) |
| POST | `billing/checkout` | workspace-scoped | ✓ | — | Redirect to Stripe checkout |
| POST | `billing/cancel` | workspace-scoped | ✓ | — | Cancel subscription |
| POST | `billing/resume` | workspace-scoped | ✓ | — | Resume canceled subscription |
| GET,POST | `billing/status` | workspace-scoped | ✓ | — | Get/sync billing status |
| GET,POST | `billing/oto` | workspace-scoped | ✓ | — | One-time offer status |
| POST | `billing/setup-intent` | workspace-scoped | ✓ | — | Create Stripe setup intent |
| POST | `billing/set-default-payment-method` | workspace-scoped | ✓ | — | Update payment method |
| POST | `billing/connect/start` | workspace-scoped | ✓ | — | Start Stripe Connect flow |
| GET | `billing/connect/status` | workspace-scoped | ✓ | — | Check Connect application |

**Notes:**
- All require workspace owner role
- No rate limiting (consider adding to prevent abuse)
- Advisory locking on subscribe prevents double-charging
- Stripe integration is solid with explicit owner-only access

---

### Projects (8 routes)

Core project CRUD with versioning and sharing.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,POST | `projects` | workspace-scoped | ✓ | — | List/create (audit-logged, webhooks) |
| GET | `projects/deleted` | workspace-scoped | ✓ | — | Soft-deleted projects (30-day recovery) |
| GET,DELETE | `projects/{id}` | workspace-scoped | ✓ | — | Get/delete project (audit-logged, webhooks) |
| GET,POST,DELETE | `projects/{id}/comments` | workspace-scoped | ✓ | — | Comments (audit-logged) |
| GET,POST | `projects/{id}/revisions` | workspace-scoped | ✓ | — | Version history (audit-logged) |
| GET,POST,DELETE | `projects/{id}/share` | workspace-scoped | ✓ | — | Share links (audit-logged) |
| POST | `projects/{id}/restore` | workspace-scoped | ✓ | — | Restore from bin (audit-logged) |
| GET,DELETE | `projects/{id}/tracking` | workspace-scoped | ✓ | — | Analytics tracking |

**Notes:**
- Comprehensive audit logging and webhooks
- Role-based access (viewers cannot edit)
- No rate limiting on creation (consider for spam prevention)
- Soft delete with 30-day recovery is well-designed

---

### Programme & Curriculum (14 routes)

Learning program, chapters, and lesson submissions.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `programme` | authenticated | ✓ | — | User's enrolled program summary |
| GET | `programme/enrollment` | workspace-scoped | ✓ | — | Enrollment + progress detail |
| GET | `programme/offers` | authenticated | ✓ | — | Available programmes to enroll |
| POST | `programme/access` | workspace-scoped | ✓ | — | Control stage/chapter access (audit-logged) |
| GET | `programme/chapters` | workspace-scoped | ✓ | — | Chapter list with gates |
| POST | `programme/chapters/{stageId}/submit` | workspace-scoped | ✓ | — | Submit chapter output (audit-logged) |
| POST | `programme/chapters/{stageId}/review` | workspace-scoped | ✓ | — | Coach review of chapter |
| GET | `programme/lessons` | workspace-scoped | ✓ | — | Lesson list |
| POST | `programme/lessons/{lessonId}/start` | workspace-scoped | ✓ | — | Begin lesson |
| POST | `programme/lessons/{lessonId}/submit` | workspace-scoped | ✓ | — | Submit lesson (audit-logged) |
| POST | `programme/lessons/{lessonId}/review` | workspace-scoped | ✓ | — | Coach review (audit-logged) |
| GET,POST | `programme/messages` | workspace-scoped | ✓ | — | Coach-learner messages |
| POST | `programme/coach-notes` | workspace-scoped | ✓ | — | Private coach notes |
| GET | `programme/coach-workspaces` | authenticated | ✓ | — | Workspaces where user is a coach |
| GET | `programme/review` | workspace-scoped | ✓ | — | Review submissions |

**Notes:**
- Proper role-based filtering (coach notes hidden from learners)
- Audit logging on critical submissions
- Coach access properly restricted to "manager" role
- No rate limiting on submissions (consider for fairness)

---

### Cohorts (6 routes)

Cohort management (groups of learners with paced access).

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,POST | `cohorts` | authenticated | ✓ | — | List/create cohorts |
| GET | `cohorts/{cohortId}` | authenticated | ✓ | — | Cohort details |
| POST | `cohorts/{cohortId}/access-limit` | authenticated | ✓ | — | Set stage/chapter access caps |
| POST | `cohorts/{cohortId}/announcements` | authenticated | ✓ | — | Post cohort announcement |
| POST,DELETE | `cohorts/{cohortId}/members` | workspace-scoped | ✓ | — | Add/remove members |
| POST | `cohorts/{cohortId}/sessions` | authenticated | ✓ | — | Schedule live session |

**Notes:**
- Inconsistent scope: some routes use authenticated (potential cross-workspace), others workspace-scoped
- **Refactor opportunity:** All routes should be workspace-scoped for consistency

---

### Business Module (20 routes)

Business planning, funnel analysis, lead capture.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,PUT | `business/brief` | workspace-scoped | ✓ | — | Business brief (read-only for display) |
| GET,PUT | `business/constraint` | workspace-scoped | ✓ | — | Key constraints |
| GET,PUT | `business/drivers` | workspace-scoped | ✓ | — | Success drivers |
| GET,PUT | `business/economics` | workspace-scoped | ✓ | — | Financial model |
| GET,PUT | `business/execution` | workspace-scoped | ✓ | — | Execution plan |
| GET,PUT | `business/golden-example` | workspace-scoped | ✓ | — | Reference example |
| GET,PUT | `business/journey` | workspace-scoped | ✓ | — | Customer journey map |
| GET,PUT | `business/launches` | workspace-scoped | ✓ | — | Launch plan |
| GET,PUT | `business/message` | workspace-scoped | ✓ | — | Core messaging |
| GET,PUT | `business/offer` | workspace-scoped | ✓ | — | Product/service offer |
| GET,PUT | `business/presentation` | workspace-scoped | ✓ | — | Presentation slides |
| GET,PATCH | `business/reality` | workspace-scoped | ✓ | — | Reality check |
| GET,PUT | `business/review` | workspace-scoped | ✓ | — | Peer review feedback |
| GET,PUT | `business/streak` | workspace-scoped | ✓ | — | Streak/momentum tracking |
| GET,PUT | `business/ai-connection` | workspace-scoped | ✓ | — | AI integration config |
| GET,POST,DELETE | `business/funnels` | workspace-scoped | ✓ | — | Sales funnel management |
| GET,POST | `business/funnels/analytics` | workspace-scoped | ✓ | — | Funnel analytics |
| GET,POST | `business/leads` | workspace-scoped | ✓ | — | Lead capture & list |
| GET | `business/leads/export` | workspace-scoped | ✓ | — | Export leads (CSV) |
| GET,PATCH | `business/leads/{id}` | workspace-scoped | ✓ | — | Lead detail & update |

**Notes:**
- All properly workspace-scoped
- Consistent GET/PUT pattern for configuration endpoints
- No rate limiting (consider for lead capture routes)
- Heavy use of PATCH for partial updates (good)

---

### Community Features (5 routes)

Social features: profiles, posts, comments, reactions.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,PUT | `community/profile` | workspace-scoped | ✓ | — | User profile in workspace |
| GET,POST,PATCH,DELETE | `community/creatives` | workspace-scoped | ✓ | ✓ | Posts/content (rate-limited) |
| GET,POST,DELETE | `community/comments` | workspace-scoped | ✓ | ✓ | Comments (rate-limited) |
| GET,POST | `community/reactions` | workspace-scoped | ✓ | ✓ | Likes/reactions (rate-limited) |
| GET | `community/authors/{wsId}` | workspace-scoped | ✓ | — | Author profile lookup |

**Notes:**
- Good rate limiting on user-generated content to prevent spam
- Missing: moderation endpoints for flagging/reporting
- All workspace-scoped correctly

---

### Campaign Studio (6 routes)

Marketing campaign management (email, social).

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,PATCH | `campaign-studio/brand` | workspace-scoped | ✓ | — | Brand settings |
| GET,POST,PATCH,DELETE | `campaign-studio/campaigns` | workspace-scoped | ✓ | — | Campaign CRUD |
| GET,POST | `campaign-studio/campaigns/deleted` | workspace-scoped | ✓ | — | Soft-deleted campaigns |
| GET,POST | `campaign-studio/connections` | workspace-scoped | ✓ | — | Social/email integrations |
| GET | `campaign-studio/entitlements` | workspace-scoped | ✓ | — | Feature access checks |
| POST | `campaign-studio/scan-site` | workspace-scoped | ✓ | — | Website scraping (CPU-intensive) |

**Notes:**
- No rate limiting on scan-site (high CPU cost—should add)
- All workspace-scoped correctly
- Consider: separate endpoints for expensive operations

---

### Segments & Contacts (7 routes)

Audience segmentation and contact management.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,POST | `segments` | workspace-scoped | ✓ | — | List/create segments |
| GET,PUT,DELETE | `segments/{id}` | workspace-scoped | ✓ | — | Segment CRUD |
| GET | `segments/{id}/contacts` | workspace-scoped | ✓ | — | Contacts matching segment |
| POST | `segments/{id}/restore` | workspace-scoped | ✓ | — | Restore deleted segment |
| GET | `segments/deleted` | workspace-scoped | ✓ | — | Soft-deleted segments |
| POST | `segments/preview` | workspace-scoped | ✓ | — | Preview segment matching (CPU-intensive) |
| POST | `segments/contacts` | workspace-scoped | ✓ | — | Add/import contacts |

**Notes:**
- No rate limiting on preview (query can be expensive)
- Soft delete pattern consistent with projects
- All workspace-scoped

---

### Settings & Configuration (6 routes)

User, workspace, and system settings.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,PUT | `settings` | admin | ✓ | — | Instance-level settings |
| GET,POST | `settings/api-keys` | workspace-scoped | ✓ | — | API key management |
| DELETE | `settings/api-keys/{id}` | workspace-scoped | ✓ | — | Revoke API key |
| GET,POST | `settings/webhooks` | workspace-scoped | ✓ | — | Webhook subscriptions |
| DELETE | `settings/webhooks/{id}` | workspace-scoped | ✓ | — | Delete webhook |
| GET | `settings/webhooks/{id}/deliveries` | workspace-scoped | ✓ | — | Delivery logs |

**Notes:**
- Good separation of instance (admin) vs workspace settings
- Webhook management properly scoped
- No rate limiting on API key creation (consider preventing key exhaustion)

---

### Templates (2 routes)

Reusable templates library.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,POST,DELETE | `templates` | workspace-scoped | ✓ | ✓ | List/create/delete templates |
| GET | `templates/{id}` | workspace-scoped | ✓ | ✓ | Template detail |

**Notes:**
- Rate limiting prevents template bombing
- Good practice for read operations

---

### Coach Tools (2 routes)

Coach-specific endpoints for learner outreach.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `coach/learner` | workspace-scoped | ✓ | — | Get learner being coached |
| POST | `coach/reach-out` | workspace-scoped | ✓ | — | Send outreach message |

**Notes:**
- Should verify user has "manager" role
- No rate limiting on messages (consider for fairness)

---

### Broadcasts (2 routes)

System-wide notifications.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET,POST | `broadcasts` | workspace-scoped | ✓ | — | List/send broadcasts |
| GET,DELETE | `broadcasts/{id}` | workspace-scoped | ✓ | — | Get/delete broadcast |

**Notes:**
- No permission checks visible—should verify workspace owner/admin
- No rate limiting

---

### Public/Third-Party Flows (17 routes)

External-facing endpoints for bookings, verification, payments.

#### Qualified (`q/`) - Booking/Verification Flow (7 routes)

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `q/{slug}/availability` | public | — | — | Check slot availability |
| POST | `q/{slug}/book` | public | — | ✓ | Book appointment |
| POST | `q/{slug}/event` | public | — | ✓ | Log event/interaction |
| POST | `q/{slug}/verify/start` | public | — | ✓ | Start verification flow |
| POST | `q/{slug}/verify/check` | public | — | ✓ | Check verification code |
| POST | `q/{slug}/pay` | public | — | ✓ | Payment checkout (Stripe) |
| POST | `q/qualified/route` | public | — | ✓ | Routing/qualification logic |

**Notes:**
- Good rate limiting on POST operations
- Missing availability should also be rate-limited
- Public access by design (slug-based)

#### Webhooks (3 routes)

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| POST | `webhooks/stripe` | workspace-scoped | — | — | Stripe event webhook (HMAC verified) |
| POST | `webhooks/stripe-billing` | public | — | — | Billing-specific events (audit-logged) |
| POST | `webhooks/stripe-oto` | public | — | — | One-time offer events |

**Notes:**
- Webhooks use HMAC signatures (Stripe)—no session needed
- Billing webhook should verify signature before audit logging

#### Other Public (7 routes)

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `v1/projects` | public | — | ✓ | API: list projects (no auth) |
| GET | `v1/projects/{id}` | public | — | ✓ | API: project detail |
| GET | `v1/openapi.json` | public | — | — | OpenAPI spec |
| GET | `unsubscribe` | public | — | — | Email unsubscribe link |
| POST | `unsubscribe` | public | — | — | Process unsubscribe |
| GET | `changelog` | public | — | — | Feature changelog |
| POST | `track` | public | — | ✓ | Analytics event tracking |

**Notes:**
- Public API uses rate limiting (good for abuse prevention)
- No authentication leakage risk (endpoints return public data)

---

### Cron/Infrastructure (2 routes)

Scheduled background jobs.

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| POST | `cron/tick` | public | — | — | Daily tick (Stripe sync) |
| POST | `cron/digest` | admin | ✓ | — | Send digest emails |

**Notes:**
- Should use secret tokens instead of `admin` check for cron/tick
- Public access to cron/tick is a potential abuse vector

---

### Misc (3 routes)

| Method | Route | Scope | Auth | Rate Limit | Features |
|--------|-------|-------|------|------------|----------|
| GET | `health` | public | — | — | Health check |
| POST | `ai/generate` | workspace-scoped | ✓ | — | AI content generation |
| GET | `command-center` | workspace-scoped | ✓ | — | Command palette data |
| GET | `insights` | workspace-scoped | ✓ | — | Analytics dashboard |
| GET | `notifications` | authenticated | ✓ | — | User notifications list |
| PATCH | `notifications` | authenticated | ✓ | — | Mark notifications read |
| POST | `coach/reach-out` | workspace-scoped | ✓ | — | Coach contact (duplicate?) |
| GET | `referrals` | workspace-scoped | ✓ | — | Referral program links |
| POST | `reports/email` | authenticated | ✓ | ✓ | Email report generation |
| POST | `client-error` | public | — | ✓ | Frontend error logging |

**Notes:**
- `cron/tick` should use HMAC verification (not `admin` role)
- `ai/generate` should have rate limiting (GPU cost)
- `client-error` rate limiting is appropriate for frontend spam

---

## Security & Scope Audit

### Missing Rate Limits (High Risk for Abuse)

| Route | Risk | Suggested Limit |
|-------|------|-----------------|
| `billing/*` | Account takeover, fraud | 5/min per user |
| `ai/generate` | GPU exhaustion | 3/min per user |
| `campaign-studio/scan-site` | Network/CPU abuse | 1/min per user |
| `segments/preview` | Query complexity | 3/min per user |
| `workspaces` POST | Workspace bombing | 10/day per user |
| `broadcast` POST | Spam | 5/day per workspace |
| `coach/reach-out` | Email bombing | 20/day per workspace |
| `projects` POST | Project bombing | 100/day per workspace |
| `programme/*` submit routes | Fairness | 3/day per learner |

### Workspace Scope Issues

**Routes Using Authenticated Scope (Should Be Workspace-Scoped):**
- `cohorts/*` (6 routes) - List/get operations allow cross-workspace queries if ws param missing
- `programme` (GET) - Returns user's enrollment across workspaces (intended, but unclear)
- `programme/offers` (GET) - Similar cross-workspace aggregation
- `workspaces/{id}/members` - Uses authenticated instead of workspace-scoped

**Mitigation:** All routes in the above list should enforce workspace scope checks explicitly.

### Missing Admin/Owner Checks

**Routes Needing Owner Verification:**
- `broadcasts` POST/DELETE - No visible owner check
- `command-center` GET - No visible permission check
- `cohorts/*` member operations - Should require owner/admin
- `coach/reach-out` - Should verify manager role

### Public Webhook Security

**`cron/tick` (Public):**
- Currently accessible without authentication
- Should use HMAC signature verification (like Stripe webhooks)
- Alternative: use environment-gated secret token

**`webhooks/stripe-billing` (Public):**
- Should verify Stripe signature before processing
- Before audit logging sensitive events

---

## Refactoring Roadmap

### Phase 1: Security & Risk Mitigation (Wave 1 - Urgent)

#### 1.1 Add Missing Rate Limits

**Files to Update:**
- `apps/web/app/api/billing/subscribe/route.ts` - Add 5 req/min limit
- `apps/web/app/api/ai/generate/route.ts` - Add 3 req/min limit
- `apps/web/app/api/campaign-studio/scan-site/route.ts` - Add 1 req/min limit
- `apps/web/app/api/segments/preview/route.ts` - Add 3 req/min limit
- `apps/web/app/api/workspaces/route.ts` - Add 10 req/day limit on POST
- `apps/web/app/api/broadcasts/route.ts` - Add 5 req/day limit on POST
- `apps/web/app/api/coach/reach-out/route.ts` - Add 20 req/day limit
- `apps/web/app/api/programme/lessons/[lessonId]/submit/route.ts` - Add 3 req/day limit

**Implementation Pattern:**
```typescript
const LIMIT = { windowMs: 60_000, max: 5 }; // per minute
const checkLimit = await checkRateLimit(`route-name:${userId}`, LIMIT);
if (!checkLimit.allowed) return json({ error: "Too many requests" }, 429, retryAfterHeader(checkLimit.retryAfterMs!));
```

#### 1.2 Fix Public Webhook Authentication

**`cron/tick` (Route: `apps/web/app/api/cron/tick/route.ts`)**

Replace current implementation:
```typescript
export const POST = async (req: Request) => {
  // Currently public—no auth
```

With HMAC verification:
```typescript
const WEBHOOK_SECRET = process.env.CRON_WEBHOOK_SECRET;

export const POST = async (req: Request) => {
  const signature = req.headers.get("x-webhook-signature");
  const body = await req.text();
  
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  
  if (signature !== expected) {
    return json({ error: "invalid signature" }, 401);
  }
  // ... rest of handler
};
```

**`webhooks/stripe-*` — Verify Signatures**

Ensure all Stripe webhooks verify the signature before processing:
```typescript
const sig = req.headers.get("stripe-signature");
if (!sig) return json({ error: "missing signature" }, 400);

try {
  const event = stripe.webhooks.constructEvent(body, sig, SECRET);
} catch {
  return json({ error: "invalid signature" }, 400);
}
```

#### 1.3 Add Permission Checks

**Broadcast Routes** (`apps/web/app/api/broadcasts/route.ts` & `broadcasts/{id}/route.ts`):
```typescript
// Add to POST/DELETE handlers
const role = await roleOf(wsId, user.id);
if (role !== "owner" && role !== "manager") {
  return json({ error: "Only owners/managers can manage broadcasts" }, 403);
}
```

**Command Center** (`apps/web/app/api/command-center/route.ts`):
```typescript
// Verify workspace membership
const role = await roleOf(wsId, user.id);
if (!role) return json({ error: "not a member" }, 403);
```

**Coach Reach-Out** (`apps/web/app/api/coach/reach-out/route.ts`):
```typescript
// Verify manager role
const role = await roleOf(wsId, user.id);
if (role !== "manager") return json({ error: "managers only" }, 403);
```

#### 1.4 Secure Cron Endpoint

**Recommended: Use environment-gated secret token**

```typescript
// apps/web/app/api/cron/tick/route.ts
const CRON_TOKEN = process.env.CRON_WEBHOOK_TOKEN;

export const POST = async (req: Request) => {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== CRON_TOKEN) return json({ error: "unauthorized" }, 401);
  // ... rest
};
```

**Call with:**
```bash
curl -X POST https://app/api/cron/tick \
  -H "Authorization: Bearer $CRON_WEBHOOK_TOKEN"
```

---

### Phase 2: Consistency & Consolidation (Wave 2 - 2-4 weeks)

#### 2.1 Fix Workspace Scope Inconsistencies

**Cohorts Routes** — Convert 6 routes to workspace-scoped:

Current: `cohorts`, `cohorts/{id}`, `cohorts/{id}/access-limit`, `cohorts/{id}/announcements`, `cohorts/{id}/sessions`

```typescript
// Before
const wsParam = new URL(req.url).searchParams.get("ws");
const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;

// After (explicit)
const wsId = new URL(req.url).searchParams.get("ws");
if (!wsId) return json({ error: "workspace required" }, 400);

const role = await roleOf(wsId, user.id);
if (!role) return json({ error: "not a member" }, 403);
```

**Programme GET** — Clarify cross-workspace behavior:

Decision: Is programme enrollment workspace-specific or per-user? If cross-workspace, document clearly. If workspace-specific, add ws param requirement.

#### 2.2 Consolidate Duplicate Patterns

**Programme Access Control Routes:**

Consolidate these 3 routes:
- `POST /api/programme/access` - Control stage access
- `POST /api/programme/chapters/{id}/review` - Coach review
- `POST /api/programme/lessons/{id}/review` - Coach review

Into unified structure:
```
POST /api/programme/{type}/{id}/review
  with type in [chapter, lesson]
```

**Segment & Community CRUDs:**

Both follow same pattern. Consider shared handler:
```typescript
// lib/crud-handlers.ts
export async function createCrudRoutes(collection: string, workspace: boolean = true) {
  // Returns { GET, POST, DELETE } handlers with auth/logging built-in
}

// api/segments/route.ts
const handlers = await createCrudRoutes("segments", true);
export { handlers as default };
```

#### 2.3 Separate Read vs Write Endpoints (Clarity)

**Admin routes** currently mix read and write on same endpoint:
- `GET /api/admin/settings`
- `POST /api/admin/settings`

Consider separating:
- `GET /api/admin/settings` (read-only)
- `PUT /api/admin/settings` (write, audit-logged)

Same for: `curriculum`, `programme-offers`, `lockouts`

---

### Phase 3: API Standardization (Wave 3 - 4-8 weeks)

#### 3.1 Consistent Error Responses

Standardize all routes to use error response format:
```typescript
{ error: string, code?: string, details?: Record<string, unknown> }
```

Example:
```typescript
return json({
  error: "Insufficient permissions",
  code: "PERMISSION_DENIED",
  details: { requiredRole: "owner", userRole: "member" }
}, 403);
```

#### 3.2 Pagination Standardization

For list endpoints (programmes, projects, segments, etc.), standardize pagination:

```typescript
// Response format
{
  items: T[],
  cursor?: string,  // for next page
  total?: number,    // if available
  hasMore: boolean
}

// Query params
GET /api/projects?cursor=abc123&limit=20
```

#### 3.3 Rate Limit Headers

All responses should include rate limit info:
```typescript
{
  "RateLimit-Limit": "60",
  "RateLimit-Remaining": "42",
  "RateLimit-Reset": "1234567890"
}
```

#### 3.4 API Versioning Strategy

Current state: Mixed (v1 exists for public API, internal routes unversioned).

Proposed:
- `v1/` prefix for stable public APIs
- Internal routes remain unversioned but stable
- Use deprecation headers for breaking changes:
  ```
  Deprecation: true
  Sunset: Wed, 21 Dec 2025 07:28:00 GMT
  Link: </api/v2/projects>; rel="successor-version"
  ```

---

## Quick Reference: Scope Audit Table

| Scope | Routes | Auth Check | Workspace Check | Risk |
|-------|--------|-----------|-----------------|------|
| Admin-Only | 18 | requireAdmin() | N/A | Low (auth enforced) |
| Workspace-Scoped | 89 | currentUser() | roleOf() + ws param | Medium (verify all routes) |
| Authenticated | 25 | currentUser() | None | High (cross-workspace access possible) |
| Public | 24 | None | None | Medium (rate limit critical) |

---

## Implementation Checklist

- [ ] Phase 1.1 - Add rate limits to 8 high-risk routes
- [ ] Phase 1.2 - Implement HMAC for webhooks
- [ ] Phase 1.3 - Add permission checks to 3 routes
- [ ] Phase 1.4 - Secure cron/tick endpoint
- [ ] Phase 2.1 - Fix cohorts scope (6 routes)
- [ ] Phase 2.2 - Consolidate duplicate patterns
- [ ] Phase 2.3 - Separate admin read/write endpoints
- [ ] Phase 3.1 - Standardize error responses
- [ ] Phase 3.2 - Add pagination to list endpoints
- [ ] Phase 3.3 - Add rate limit response headers
- [ ] Phase 3.4 - Document API versioning strategy

---

## Metrics

**Before Refactoring:**
- Rate-limited routes: 28 (18%)
- Workspace-scoped: 89 (57%)
- Potential permission vulnerabilities: 12+
- Public endpoints without rate limiting: 8

**Target After Wave 1:**
- Rate-limited routes: 36+ (23%)
- Workspace-scoped with explicit checks: 95 (60%+)
- Permission vulnerabilities: 0
- Public endpoints rate-limited: 15/24

**Target After Waves 2-3:**
- Rate-limited routes: 40+ (25%)
- Consistent response format: 100%
- Pagination standardized: 25/30 list endpoints
- API versioning documented: All public routes

---

## Related Documentation

- **Workspace Isolation:** See `lib/workspaces.ts` for `roleOf()` and `ensurePersonalWorkspace()`
- **Rate Limiting:** See `lib/rate-limit.ts` for `checkRateLimit()` usage
- **Audit Logging:** See `lib/audit-log.ts` for `recordAudit()` and activity tracking
- **Auth:** See `lib/auth.ts` for `currentUser()`, `requireAdmin()`, user session handling
- **Stripe Integration:** See `lib/stripe-billing.ts` for webhook and subscription management
