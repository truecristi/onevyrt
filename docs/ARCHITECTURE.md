# ONEVYRT Architecture Reference

A comprehensive guide to OneVYRT's technical architecture, patterns, and systems for developers onboarding and contributing to the codebase.

---

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [API Architecture](#api-architecture)
3. [Database Schema](#database-schema)
4. [Auth Architecture](#auth-architecture)
5. [Programme State Machine](#programme-state-machine)
6. [Payment Flow](#payment-flow)
7. [Community Marketplace](#community-marketplace)
8. [Coaching System](#coaching-system)
9. [Data Retention](#data-retention)
10. [Rate Limiting](#rate-limiting)
11. [Notifications](#notifications)
12. [Error Handling](#error-handling)
13. [Key Design Patterns](#key-design-patterns)

---

## Stack Overview

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS |
| **Backend** | Node.js runtime via Vercel, Next.js API routes |
| **Database** | PostgreSQL (hosted on Fly.io) with Prisma ORM in some legacy modules |
| **State Machine** | @onevyrt/engine (pure TypeScript, immutable curriculum progression) |
| **Payments** | Stripe Connect (payouts), Stripe Billing (platform invoices) |
| **Messaging** | Twilio (optional SMS, env-configured) + Node SMTP (email) |
| **Hosting** | Vercel (Next.js app) + Fly.io (PostgreSQL) + Tailscale (bastion access) |
| **CI/CD** | GitHub Actions, auto-deploys to onevyrt.masteryresearch.com on master |
| **Monorepo** | pnpm workspaces: `apps/web`, `packages/engine` |

### Key Dependencies

```json
{
  "@onevyrt/engine": "workspace:*",
  "next": "16.2.12",
  "react": "^19.2.0",
  "pg": "^8.23.0",
  "nodemailer": "^9.0.1"
}
```

**Note:** No Stripe SDK — all Stripe integrations use plain REST via `fetch()` with bearer token auth, reducing dependencies and keeping the codebase lean.

---

## API Architecture

### Route Organization (157 routes)

OneVYRT's API is organized by feature area into logical namespaces under `apps/web/app/api/`:

| Namespace | Purpose | Key Routes |
|-----------|---------|-----------|
| `auth/*` | Session management, login, signup, password reset | `login`, `signup`, `session`, `logout`, `reset-password` |
| `account/*` | Profile management, GDPR export, account deletion | `export`, `profile`, `delete`, `settings` |
| `projects/*` | Funnel/campaign CRUD, comments, revisions, soft-delete bin | `list`, `create`, `[id]/details`, `[id]/comments` |
| `programme/*` | Enrollment, chapter submissions, progression gates | `enroll`, `status`, `submit`, `chapters/[id]/content` |
| `coaching/*` | Submission review, approval gates, coach messages | `submissions`, `[id]/approve`, `messages`, `digest` |
| `community/*` | Template/creative publishing, moderation, author profiles | `templates/publish`, `creatives/publish`, `moderate`, `authors/[id]` |
| `cron/*` | Job orchestration, webhook dispatching | `tick` (external cron caller), `webhooks/dispatch` |
| `stripe/*` | Stripe webhook receivers | `webhooks` (charge, refund, payout events) |
| `workspaces/*` | Multi-tenant workspace CRUD, members, roles | `list`, `create`, `[id]/members`, `[id]/settings` |
| `insights/*` | Analytics dashboards, funnel metrics | `funnel/[id]`, `conversion`, `revenue` |
| `notifications/*` | In-app notifications (bell icon) | `list`, `[id]/read`, `mark-all-read` |
| `business/*` | Business setup, constraints, snapshots | `brief`, `constraint`, `snapshot` |
| `campaign-studio/*` | Campaign builder (brand, connections, creatives, copywriting) | `brand/update`, `write/generate`, `creative/list` |

### Route Patterns

All routes follow a consistent pattern:

```typescript
// apps/web/app/api/[feature]/[operation]/route.ts
import { currentUser } from "@/lib/auth";
import { listForUser } from "@/lib/workspaces";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // 1. Verify workspace membership
  const ws = await getWorkspace(user.id, workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  
  // 2. Execute operation scoped to workspace
  const result = await someOperation(ws.id);
  
  // 3. Return response
  return NextResponse.json(result);
}
```

**Key conventions:**
- Every route checks `currentUser()` first
- Every route scopes to the user's workspaces via `listForUser(user.id)` or `getWorkspace()`
- Query parameters use bound parameters (never string interpolation)
- Errors use HTTP status codes (401, 403, 404, 500)
- Soft-deleted items are excluded by default (`WHERE deleted_at IS NULL`)

### Error Handling

See [Error Handling](#error-handling) section for patterns.

---

## Database Schema

### Core Tables

#### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,  -- scrypt + HMAC, see lib/auth.ts
  created_at TIMESTAMP DEFAULT now()
);
```

#### `workspaces`
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  stripe_customer_id TEXT,  -- for billing invoices
  stripe_connect_account_id TEXT,  -- for payment collection
  deleted_at TIMESTAMP  -- soft-delete
);
```

#### `workspaces_users` (Many-to-many with role)
```sql
CREATE TABLE workspaces_users (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,  -- 'owner' | 'manager' | 'editor' | 'viewer'
  PRIMARY KEY (workspace_id, user_id)
);
```

#### `enrollments`
```sql
CREATE TABLE enrollments (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  enrollment JSONB NOT NULL,  -- Complete Enrollment object from @onevyrt/engine
  last_modified_at TIMESTAMP DEFAULT now()
);
```
The `enrollment` JSONB blob holds the complete immutable state machine (see [Programme State Machine](#programme-state-machine)).

#### `projects`
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL,  -- 'funnel' | 'campaign'
  slug TEXT NOT NULL,
  data JSONB NOT NULL,  -- Type-specific project config
  deleted_at TIMESTAMP
);
```

#### `cohorts`
```sql
CREATE TABLE cohorts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  name TEXT NOT NULL,
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  coach_email TEXT NOT NULL,
  sessions JSONB NOT NULL,  -- Array of { id, title, date, meetingUrl? }
  member_workspace_ids TEXT[] NOT NULL,  -- Cross-workspace membership
  created_at TIMESTAMP DEFAULT now()
);
```

#### `otp_verifications`
```sql
CREATE TABLE otp_verifications (
  id TEXT PRIMARY KEY,
  funnel_slug TEXT NOT NULL,
  channel TEXT NOT NULL,  -- 'email' | 'sms'
  destination TEXT NOT NULL,  -- Email or phone number
  code_hash TEXT NOT NULL,  -- HMAC-SHA256 of code
  verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,  -- 7 days
  deleted_at TIMESTAMP  -- soft-delete after verification
);
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT REFERENCES workspaces(id),
  type TEXT NOT NULL,  -- 'cohort_session_reminder', 'coaching_feedback', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_url TEXT,
  dedupe_key TEXT UNIQUE,  -- Idempotency key for job re-runs
  created_at TIMESTAMP DEFAULT now(),
  read_at TIMESTAMP
);
```

### Audit Tables

#### `activity_log`
```sql
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,  -- 'project_created', 'submission_approved', etc.
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

#### `job_runs`
```sql
CREATE TABLE job_runs (
  job_key TEXT PRIMARY KEY,
  last_run_at TIMESTAMP NOT NULL
);
```

### Indexing Strategy

```sql
-- Workspace isolation
CREATE INDEX idx_workspaces_users_user ON workspaces_users(user_id);
CREATE INDEX idx_projects_workspace ON projects(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_enrollments_workspace ON enrollments(workspace_id);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE read_at IS NULL;

-- Soft-delete queries
CREATE INDEX idx_projects_deleted ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
```

### Data Relationships

```
users
  ├─ 1:N workspaces (owner_id)
  ├─ M:N workspaces (workspaces_users)
  ├─ 1:N enrollments (via workspace_id)
  ├─ 1:N activity_log
  └─ 1:N notifications

workspaces
  ├─ 1:N projects
  ├─ 1:N cohorts
  ├─ 1:1 enrollments
  └─ M:N users (workspaces_users)
```

---

## Auth Architecture

### Session-Based Authentication

OneVYRT uses **stateless HMAC-signed session cookies** without OAuth:

#### Session Creation (`lib/auth.ts`)

```typescript
// Session signing: HMAC-SHA256 with a stable signing key
function signSession(payload: { userId: string; expires: number }): string {
  const secret = getSecret();  // From env AUTH_SECRET or .gearbox/auth-secret
  const message = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  return `${Buffer.from(message).toString("base64")}.${signature}`;
}

// On login
async function login(email: string, password: string): Promise<Session | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  
  const verified = await verifyPassword(password, user.password_hash);
  if (!verified) return null;
  
  const session = signSession({
    userId: user.id,
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000  // 30 days
  });
  
  // Set secure, httpOnly cookie
  res.headers.set("Set-Cookie", 
    `session=${session}; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`
  );
  
  return { userId: user.id };
}
```

#### Session Verification

```typescript
// Every API route calls this
async function currentUser(cookie: string | null): Promise<User | null> {
  if (!cookie) return null;
  
  const session = extractSession(cookie);
  if (!session || session.expires < Date.now()) return null;
  
  return getUserById(session.userId);
}
```

### Scope Isolation

Every operation verifies workspace membership before executing:

```typescript
// Typical route pattern
async function getProject(req: NextRequest) {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return Unauthorized();
  
  const workspaceId = req.nextUrl.searchParams.get("workspace_id");
  
  // 1. User owns or is member of workspace
  const ws = await getWorkspace(user.id, workspaceId);
  if (!ws) return Forbidden();
  
  // 2. Query includes workspace_id filter
  const project = await db.query(
    "SELECT * FROM projects WHERE id = $1 AND workspace_id = $2",
    [projectId, ws.id]
  );
  
  return Response.json(project);
}
```

### Key Security Patterns

| Pattern | Implementation | Status |
|---------|----------------|--------|
| **Password Hashing** | scrypt + HMAC-SHA256 (async) | ✅ Implemented |
| **Session Signing** | HMAC-SHA256 with stable secret | ✅ Implemented |
| **Workspace Isolation** | Query filters on workspace_id | ✅ Implemented |
| **Rate Limiting** | Sliding window per IP+user | ✅ Implemented |
| **2FA/TOTP** | Optional per user, HMAC validation | ✅ Implemented |
| **CSRF Tokens** | ❌ Not yet implemented (Wave 2) |
| **PII Encryption** | ❌ Not standardized (Wave 4) |

---

## Programme State Machine

### Curriculum Architecture

OneVYRT uses `@onevyrt/engine` (a pure TypeScript state machine) to manage programme progression. The engine is immutable, deterministic, and fully testable without side effects.

#### Enrollment Model

```typescript
// packages/engine/src/enrollment.ts
export interface Enrollment {
  id: string;
  workspaceId: string;
  userId: string;
  programmeId: string;
  deliveryMode: DeliveryMode;  // 'self_paced' | 'cohort_paced'
  status: EnrollmentStatus;  // 'active' | 'completed' | 'suspended'
  startedAt: string;  // ISO 8601
  completedAt?: string;
  
  lessons: Lesson[];
  currentLessonId?: string;
}

export interface Lesson {
  id: string;
  chapterId: string;
  title: string;
  status: LessonStatus;  // 'locked' | 'open' | 'submitted' | 'approved' | 'rejected'
  startedAt?: string;
  submissions: Submission[];  // Chronological, newest last
  gatedBy?: string;  // Coach approval gate id
}

export interface Submission {
  id: string;
  evidence: string;  // Up to 4000 chars
  submittedAt: string;
  approvedAt?: string;
  rejectionReason?: string;
  coachId?: string;
}
```

#### Chapter Structure

| Chapter | Gate | Artifact | Role |
|---------|------|----------|------|
| **DEFINE** | Coach approval | Business Psychology Blueprint | Strategy north star |
| **IMPLEMENT** | Coach approval | Working Business System | Operations playbook |
| **CONTROL** | Coach approval | Numbers & Control Dashboard | Real-time metrics |
| **IMPROVE & SCALE** | Coach approval | Growth & Improvement Plan | 90-day priorities |
| **FINISH** | Auto-unlock | Transformation Report + 90-Day Plan | Journey summary |

#### State Transitions

```
START
  ↓
CHAPTER 1: DEFINE
  Learn → Build → Submit → [Coach Review] → Approved → Gate Open
  ↓
CHAPTER 2: IMPLEMENT
  Learn → Build → Submit → [Coach Review] → Approved → Gate Open
  ↓
CHAPTER 3: CONTROL
  Learn → Build → Submit → [Coach Review] → Approved → Gate Open
  ↓
CHAPTER 4: IMPROVE & SCALE
  4.1 Find Bottleneck
  4.2 Improve Conversion
  4.3 Improve Profit
  4.4 Systemise & Automate
  4.5 Build Growth Plan
  4.6 Team & Capacity (optional)
  Learn → Build → Submit → [Coach Review] → Approved → Gate Open
  ↓
FINISH: Transformation Report
  Auto-generate from enrollment data
  Email + shareable link + PDF
```

### Engine Integration (`lib/enrollments.ts`)

```typescript
// Mutation: submit a lesson
export async function submitLesson(
  workspaceId: string,
  lessonId: string,
  evidence: string
): Promise<Enrollment> {
  return await withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    if (!enrollment) throw new Error("Enrollment not found");
    
    // Engine mutation (pure function, no side effects)
    const updated = submitLessonInEnrollment(enrollment, lessonId, evidence);
    
    // Persist
    await writeOne(workspaceId, updated, db);
    return updated;
  });
}

// Mutation: approve a submission
export async function approveSubmission(
  workspaceId: string,
  lessonId: string,
  submissionId: string,
  coachId: string
): Promise<Enrollment> {
  return await withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    
    // Engine mutation
    const updated = approveSubmissionInEnrollment(
      enrollment, lessonId, submissionId, coachId
    );
    
    // Emit events (notifications, activity log)
    await createNotification({
      userId: enrollment.userId,
      type: "submission_approved",
      title: "Submission Approved",
      body: `Your ${enrollment.lessons.find(l => l.id === lessonId)?.title} submission was approved.`,
      dedupeKey: `submission_approved:${submissionId}`
    });
    
    await writeOne(workspaceId, updated, db);
    return updated;
  });
}
```

### Advisory Locking

Per-workspace mutations serialize across all containers to prevent race conditions:

```typescript
// lib/db.ts
export async function withAdvisoryLock<T>(
  key: string,
  fn: (db: Queryable) => Promise<T>
): Promise<T> {
  const client = await pgPool().connect();
  try {
    const lockId = Buffer.from(key).readUInt32BE(0);  // Deterministic from key
    await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);
    return await fn(client);
  } finally {
    client.release();
  }
}
```

---

## Payment Flow

### Stripe Connect (For User Collections)

OneVYRT enables each learner to collect payments from their own customers via **Stripe Connect Express accounts**:

```
User A creates account → Connects Stripe → Gets `acct_123` → Collects payments
User B creates account → Connects Stripe → Gets `acct_456` → Collects payments
(OneVYRT takes 2.9% + $0.30 per transaction as platform fee)
```

#### Flow Diagram

```
1. User initiates payment collection
   ↓
2. /api/stripe/connect/create-account
   → Creates Express account at Stripe
   → Returns account id (acct_xxx)
   → Stores account_id in workspace.stripe_connect_account_id
   ↓
3. /api/stripe/connect/onboarding-link
   → Generates time-limited onboarding link
   → User completes form in Stripe (bank, identity, etc.)
   → Stripe redirects back to app
   ↓
4. User's funnel checkout
   → Customer enters card details (Stripe hosted fields, not our server)
   → /api/stripe/checkout/confirm-payment
   → Creates PaymentIntent as destination charge:
      - Destination: User's connected account (acct_xxx)
      - Amount: $100 (example)
      - Application fee: $2.90 (2.9%)
      - Funds: $97.10 → User's account, $2.90 → Platform
   ↓
5. Webhook: charge.succeeded
   → /api/stripe/webhooks
   → Updates funnel conversion stats
   → Creates revenue_ledger entry
   → Triggers downstream: email confirmation, lead capture, etc.
   ↓
6. Payout (Stripe handles automatically)
   → Stripe deposits to User's bank account (daily or weekly)
   → Less platform fee, less any refunds
```

### Stripe Connect Integration (`lib/stripe-connect.ts`)

```typescript
// Pure helpers (no side effects)
export function connectAccountStatus(
  flags: ConnectAccountFlags | null
): ConnectStatus {
  if (!flags) return "onboarding";
  if (flags.charges_enabled && flags.payouts_enabled) return "active";
  if (flags.details_submitted) return "restricted";
  return "onboarding";
}

export function computeApplicationFeeCents(
  amountCents: number,
  feePercent: number = 2.9
): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const pct = Math.min(100, Math.max(0, feePercent));
  const fee = Math.round((amountCents * pct) / 100);
  return Math.min(fee, amountCents);  // Never exceeds total
}

// Integration: Create account and get onboarding link
async function setupStripeConnect(
  user: User,
  workspace: Workspace
): Promise<{ onboardingUrl: string } | { error: string }> {
  // 1. Create Express account
  const account = await createConnectedAccount(user.email, workspace.id);
  if ("error" in account) return account;
  
  // 2. Store account id
  await updateWorkspace(workspace.id, {
    stripe_connect_account_id: account.accountId
  });
  
  // 3. Get onboarding link
  const link = await createAccountLink(
    account.accountId,
    `/business/stripe/refresh`,
    `/business/stripe/complete`
  );
  
  return link;
}
```

### Payment Collection

```typescript
// When a customer submits payment on a funnel
async function checkoutFunnel(
  workspace: Workspace,
  funnel: Project,
  amount: number,
  customerEmail: string
): Promise<{ clientSecret: string } | { error: string }> {
  const accountId = workspace.stripe_connect_account_id;
  if (!accountId) return { error: "Stripe not configured" };
  
  // Check account is active
  const account = await getConnectedAccount(accountId);
  if ("error" in account || !canAcceptPayments(account.flags)) {
    return { error: "Account not ready to accept payments" };
  }
  
  // Create destination charge (funds → user's account, fee → platform)
  const intent = await createDestinationPaymentIntent({
    accountId,
    amountCents: Math.floor(amount * 100),
    currency: "USD",
    feePercent: 2.9,
    description: `Payment via ${funnel.name}`,
    metadata: {
      workspaceId: workspace.id,
      funnelId: funnel.id,
      funnel_slug: funnel.slug
    }
  });
  
  return intent;
}
```

---

## Community Marketplace

### Publishing Flow

#### Templates & Creatives

Users can publish reusable templates and creative assets to the OneVYRT community:

```
User A: "I built a great email sequence"
  → Publishes to /community/templates
  → Other users can browse, rate, reuse
  → OneVYRT can feature best items
  
User B: "I created a high-converting sales page"
  → Publishes to /community/creatives
  → Includes screenshots, description, tags
  → Available for remixing
```

### Data Model

```typescript
interface CommunityItem {
  id: string;
  authorId: string;
  type: "template" | "creative";
  title: string;
  description: string;
  data: Record<string, unknown>;  // Template/creative config
  tags: string[];
  publishedAt: string;
  featured: boolean;
  rating: { average: number; count: number };
  moderation: {
    status: "pending" | "approved" | "rejected";
    reason?: string;
  };
}
```

### Moderation System

```typescript
// lib/community/moderation.ts
export async function submitForModeration(
  itemId: string,
  authorId: string
): Promise<void> {
  const item = await getItem(itemId);
  if (item.authorId !== authorId) throw new Error("Not authorized");
  
  item.moderation.status = "pending";
  await saveItem(item);
  
  // Notify admin
  await createNotification({
    userId: ADMIN_USER_ID,
    type: "moderation_pending",
    title: "New Item for Review",
    body: `"${item.title}" is pending moderation.`,
    linkUrl: `/admin/moderation/${itemId}`
  });
}

export async function approveItem(itemId: string, adminId: string): Promise<void> {
  const item = await getItem(itemId);
  item.moderation.status = "approved";
  item.moderation.reason = undefined;
  await saveItem(item);
  
  // Notify author
  await createNotification({
    userId: item.authorId,
    type: "item_approved",
    title: "Item Approved",
    body: `Your "${item.title}" has been approved and is now live!`
  });
}
```

### Author Profiles

```typescript
// lib/community/authors.ts
export interface AuthorProfile {
  userId: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  publishedItems: CommunityItem[];
  followerCount: number;
}

export async function getAuthorProfile(userId: string): Promise<AuthorProfile> {
  const user = await getUser(userId);
  const items = await listPublishedItems(userId);
  const followers = await countFollowers(userId);
  
  return {
    userId: user.id,
    displayName: user.name || user.email,
    bio: user.community_bio,
    avatar: user.avatar_url,
    publishedItems: items,
    followerCount: followers
  };
}
```

---

## Coaching System

### Submission & Approval Flow

```
Learner submits evidence for a lesson
  ↓
Lesson status: "submitted" (locked for re-edit)
  ↓
Coach sees submission in dashboard
  ↓
Coach writes feedback (max 2000 chars)
  ↓
Coach chooses: Approve or Request Revision
  ↓
If Approved:
  → Lesson status: "approved"
  → Gate opens (next chapter unlocks)
  → Learner gets notification + email
  ↓
If Revision Requested:
  → Lesson status: "revision_requested"
  → Learner can re-submit
  → Loop back to top
```

### Data Model

```typescript
// Every Submission includes revision tracking
export interface Submission {
  id: string;
  evidence: string;  // Learner's answer
  submittedAt: string;
  
  approvedAt?: string;
  approvedByCoach?: string;  // Coach user_id
  
  rejectionReason?: string;
  rejectedAt?: string;
  
  revisionCount: number;
}
```

### Coach Workflow

```typescript
// lib/coach/review.ts
export async function reviewSubmission(
  workspaceId: string,
  lessonId: string,
  submissionId: string,
  coachId: string,
  decision: "approve" | "revise",
  feedback?: string
): Promise<void> {
  const enrollment = await getEnrollment(workspaceId);
  const lesson = enrollment.lessons.find(l => l.id === lessonId);
  const submission = lesson?.submissions.find(s => s.id === submissionId);
  
  if (!submission) throw new Error("Submission not found");
  
  if (decision === "approve") {
    submission.approvedAt = new Date().toISOString();
    submission.approvedByCoach = coachId;
    lesson.status = "approved";
  } else {
    submission.rejectionReason = feedback;
    submission.rejectedAt = new Date().toISOString();
    lesson.status = "revision_requested";
  }
  
  await updateEnrollment(workspaceId, enrollment);
  
  // Notify learner
  const learner = await getUserById(enrollment.userId);
  await createNotification({
    userId: learner.id,
    type: decision === "approve" ? "submission_approved" : "submission_revision",
    title: decision === "approve" ? "Approved!" : "Revision Requested",
    body: feedback || (decision === "approve" ? "Great work!" : "Please revise and resubmit."),
    dedupeKey: `${decision}:${submissionId}`
  });
  
  // Email
  await sendMail({
    to: learner.email,
    subject: decision === "approve" ? "Your submission was approved!" : "Revision requested",
    text: feedback || "Check the app for details."
  });
}
```

### Coach Notifications

#### Digest Job

```typescript
// lib/coach/digest-run.ts - Runs weekly
export async function runCoachDigest(): Promise<{ notified: number }> {
  const coaches = await listCoaches();
  let notified = 0;
  
  for (const coach of coaches) {
    const cohort = await getCohort(coach.cohortId);
    const quiet = cohort.member_workspace_ids.filter(
      wsId => !hasActivitySince(wsId, QUIET_THRESHOLD_DAYS)
    );
    
    if (quiet.length === 0) continue;
    
    const n = await createNotification({
      userId: coach.id,
      type: "coach_digest",
      title: "Weekly Check-In: Members Needing Attention",
      body: `${quiet.length} members haven't submitted work this week.`,
      linkUrl: `/coaching/cohort/${cohort.id}`,
      dedupeKey: `coach_digest:${coach.id}:week-${isoWeek()}`
    });
    
    if (n) {
      notified++;
      await sendMail({
        to: coach.email,
        subject: "OneVYRT: Weekly digest",
        text: `${quiet.length} members need attention. Check the app.`
      });
    }
  }
  
  return { notified };
}
```

---

## Data Retention

### Soft-Delete Pattern

All user-created data (projects, leads, OTP codes) use soft-delete for 30-day recoverability:

```typescript
// lib/soft-delete.ts
export const BIN_RETENTION_DAYS = 30;

// Delete stamps deleted_at (recoverable)
async function softDelete(table: string, id: string): Promise<void> {
  await db.query(
    `UPDATE ${table} SET deleted_at = now() WHERE id = $1`,
    [id]
  );
}

// Restore clears deleted_at
async function restore(table: string, id: string): Promise<void> {
  await db.query(
    `UPDATE ${table} SET deleted_at = NULL WHERE id = $1`,
    [id]
  );
}

// Permanent delete (guarded by deleted_at IS NOT NULL)
async function permanentlyDelete(table: string, id: string): Promise<void> {
  await db.query(
    `DELETE FROM ${table} WHERE id = $1 AND deleted_at IS NOT NULL`,
    [id]
  );
}
```

### Hard-Purge Jobs

Runs daily to permanently delete expired soft-deleted items:

```typescript
// lib/store.ts - Projects
export async function purgeExpiredProjects(): Promise<number> {
  const res = await db.query(
    `DELETE FROM projects 
     WHERE deleted_at IS NOT NULL 
     AND deleted_at < now() - INTERVAL '30 days'`
  );
  return res.rowCount ?? 0;
}

// lib/acquisition/leads.ts - Leads & bookings
export async function purgeExpiredLeadsAndBookings(): Promise<number> {
  const res = await db.query(
    `DELETE FROM leads 
     WHERE deleted_at IS NOT NULL 
     AND deleted_at < now() - INTERVAL '7 days'`
  );
  return res.rowCount ?? 0;
}

// lib/acquisition/otp.ts - OTP codes
export async function purgeExpiredOtpVerifications(): Promise<number> {
  const res = await db.query(
    `DELETE FROM otp_verifications 
     WHERE deleted_at IS NOT NULL 
     AND (expires_at < now() OR deleted_at < now() - INTERVAL '7 days')`
  );
  return res.rowCount ?? 0;
}

// Job registration (lib/jobs.ts)
const jobs: Job[] = [
  { key: "purge_projects", intervalHours: 24, run: purgeExpiredProjects },
  { key: "purge_leads", intervalHours: 24, run: purgeExpiredLeadsAndBookings },
  { key: "purge_otp", intervalHours: 24, run: purgeExpiredOtpVerifications }
];
```

### GDPR Data Export & Deletion

```typescript
// app/api/account/export/route.ts
export async function GET(req: NextRequest) {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return Unauthorized();
  
  // 1. All user data across all workspaces
  const workspaces = await listForUser(user.id);
  const export_data = {
    user: { ...user, password_hash: "[redacted]" },
    workspaces: workspaces.map(ws => ({
      ...ws,
      projects: await listProjectsInWorkspace(ws.id),
      enrollment: await getEnrollment(ws.id),
      activity_log: await listActivityLog(ws.id)
    }))
  };
  
  // 2. Return as JSON (user downloads)
  return new Response(JSON.stringify(export_data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": "attachment" }
  });
}

// app/api/account/delete/route.ts
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return Unauthorized();
  
  // 1. Schedule hard-delete job (runs async)
  await scheduleAccountDeletion(user.id);
  
  // 2. Soft-delete all workspaces immediately
  const workspaces = await listForUser(user.id);
  for (const ws of workspaces) {
    await softDeleteWorkspace(ws.id);
  }
  
  // 3. Invalidate session
  return new Response("Account deletion scheduled. You'll be logged out.", {
    headers: { "Set-Cookie": "session=; Max-Age=0" }
  });
}
```

---

## Rate Limiting

### Sliding Window Algorithm

Rate limits prevent abuse of expensive operations (export, moderation, OTP send):

```typescript
// lib/rate-limit.ts
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  limit: number;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number }
): Promise<RateLimitResult> {
  // In-memory backend (dev) or Postgres (production)
  if (!dbConfigured()) return checkInMemory(key, opts);
  return checkInDatabase(key, opts);
}
```

### In-Memory Backend (Single Container)

```typescript
const buckets = new Map<string, Bucket>();  // key -> { count, resetAt }

function checkInMemory(key: string, opts: { windowMs: number; max: number }): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  
  // New window or window expired
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit: opts.max, remaining: opts.max - 1, resetAt };
  }
  
  // Within window
  if (existing.count >= opts.max) {
    return { 
      allowed: false, 
      retryAfterMs: existing.resetAt - now,
      limit: opts.max,
      remaining: 0,
      resetAt: existing.resetAt
    };
  }
  
  existing.count++;
  return { allowed: true, limit: opts.max, remaining: opts.max - existing.count, resetAt: existing.resetAt };
}
```

### Postgres Backend (Distributed)

```sql
-- Atomic increment-or-reset: shared across all containers
UPDATE rate_limit_buckets
SET count = CASE WHEN reset_at > now() THEN count + 1 ELSE 1 END,
    reset_at = CASE WHEN reset_at > now() THEN reset_at ELSE now() + $2::interval END
WHERE key = $1
RETURNING count, reset_at;
```

### Usage in Routes

```typescript
// Example: Rate limit GDPR export to 5 per hour per user
export async function GET(req: NextRequest) {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return Unauthorized();
  
  const limit = await checkRateLimit(`export:${user.id}`, {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5
  });
  
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      { 
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs! / 1000)) }
      }
    );
  }
  
  // Proceed with export...
}
```

---

## Notifications

### Notification Types

| Type | Trigger | Channel | Dedupe |
|------|---------|---------|--------|
| `cohort_session_reminder` | Session starts in 30 hours | In-app + Email | `cohort_session:{sessionId}:{userId}` |
| `submission_approved` | Coach approves submission | In-app + Email | `submission_approved:{submissionId}` |
| `submission_revision` | Coach requests revision | In-app + Email | `submission_revision:{submissionId}` |
| `coach_digest` | Weekly digest (who's quiet) | In-app + Email | `coach_digest:{coachId}:week-{week}` |
| `item_approved` | Community item approved | In-app | `item_approved:{itemId}` |
| `user_added_to_cohort` | Member added to cohort | In-app + Email | `cohort_member:{cohortId}:{userId}` |

### Idempotent Creation

```typescript
// lib/notifications.ts
export async function createNotification(input: {
  userId: string;
  workspaceId?: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  dedupeKey?: string;  // Idempotency
}): Promise<Notification | null> {
  const id = randomBytes(8).toString("hex");
  
  // ON CONFLICT: if dedupeKey already exists, this is a no-op (returns null)
  const res = await db.query(
    `INSERT INTO notifications (id, user_id, workspace_id, type, title, body, link_url, dedupe_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING ...`,
    [id, input.userId, input.workspaceId, input.type, input.title, input.body, input.linkUrl, input.dedupeKey]
  );
  
  return res.rows[0] ? rowToNotification(res.rows[0]) : null;
}
```

### Job-Based Notifications

```typescript
// lib/jobs.ts - Runs on every external cron tick
export async function cohortSessionReminders(): Promise<JobResult> {
  const cohorts = await db.query("SELECT ... FROM cohorts");
  
  let created = 0;
  
  for (const cohort of cohorts.rows) {
    // Find sessions starting in next 30 hours
    const upcoming = cohort.sessions.filter(s => isUpcoming(s, 30));
    
    for (const session of upcoming) {
      for (const [userId, email] of recipients) {
        const n = await createNotification({
          userId,
          type: "cohort_session_reminder",
          title: `Upcoming: ${session.title}`,
          body: `${cohort.name} — ${session.title} starts ${when}.`,
          dedupeKey: `cohort_session:${session.id}:${userId}`  // ← Prevents duplicates
        });
        
        if (n) {
          // Only send email if notification actually created (not deduplicated)
          created++;
          await sendMail({ to: email, ... });
        }
      }
    }
  }
  
  return { created };
}
```

### Bell UI

```typescript
// Fetch latest notifications (sorted newest first, max 50)
GET /api/notifications
Response:
{
  notifications: [
    {
      id: "abc123",
      userId: "user_123",
      type: "submission_approved",
      title: "Approved!",
      body: "Your DEFINE submission was approved.",
      linkUrl: "/programme/chapter-1",
      createdAt: "2025-09-02T10:30:00Z",
      readAt: null
    }
  ]
}

// Mark as read
PUT /api/notifications/abc123/read
Response: { success: true }

// Mark all as read
PUT /api/notifications/mark-all-read
Response: { success: true }

// Unread count
GET /api/notifications/unread-count
Response: { count: 3 }
```

---

## Error Handling

### Error Handling Pattern

OneVYRT uses try/catch with structured error responses:

```typescript
// Typical pattern in every route
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json();
    const result = await someOperation(body);
    
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/something failed:", message);
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
```

### Safe Operation Wrapper

```typescript
// lib/api/safe.ts
export async function safe<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

// Usage
const result = await safe(() => submitLesson(workspaceId, lessonId, evidence));
if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
return NextResponse.json(result.data);
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| **200** | Success | Query/mutation succeeded |
| **400** | Bad Request | Invalid input, validation failed |
| **401** | Unauthorized | No session or invalid cookie |
| **403** | Forbidden | User not member of workspace |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate key, race condition |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Server Error | Unexpected exception |

### Logging

```typescript
// lib/logger.ts
export function logError(context: string, err: Error, metadata?: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: "error",
    context,
    message: err.message,
    stack: err.stack,
    metadata,
    timestamp: new Date().toISOString()
  }));
}

export function logInfo(context: string, message: string, metadata?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "info",
    context,
    message,
    metadata,
    timestamp: new Date().toISOString()
  }));
}

// Usage
try {
  await submitLesson(...);
} catch (err) {
  logError("submit_lesson", err as Error, { workspaceId, lessonId });
  throw err;
}
```

---

## Key Design Patterns

### 1. Workspace Isolation Pattern

Every operation verifies membership before scoping:

```typescript
// ✅ Safe: Query includes workspace_id
const project = await db.query(
  "SELECT * FROM projects WHERE id = $1 AND workspace_id = $2",
  [projectId, ws.id]
);

// ❌ Unsafe: No workspace filter
const project = await db.query(
  "SELECT * FROM projects WHERE id = $1",
  [projectId]
);
```

### 2. Idempotent Mutations via Dedupe Keys

Jobs can safely re-run without double-notifying:

```typescript
const notif = await createNotification({
  userId,
  type: "event_type",
  title: "Title",
  dedupeKey: `event_type:${eventId}:${userId}`  // ← Unique per event+user
});

if (notif) {
  // Only send email/SMS if notification actually created
  await sendMail({ to: email, ... });
}
```

### 3. Soft-Delete for Recoverability

User can undo accidental deletion for 30 days:

```typescript
// Delete
await softDeleteRow("projects", workspaceId, projectId);

// Undo (within 30 days)
await restoreRow("projects", workspaceId, projectId);

// Permanent (after 30 days)
await purgeRow("projects", workspaceId, projectId);
```

### 4. Advisory Locking for Race Conditions

Per-workspace mutations serialize across containers:

```typescript
await withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
  const enrollment = await readOne(workspaceId, db);
  const updated = mutateEnrollment(enrollment, ...);
  await writeOne(workspaceId, updated, db);
});
```

### 5. Pure State Machine (Engine)

Programme state lives in `@onevyrt/engine` — all mutations are pure functions, no I/O:

```typescript
// Pure (testable, no database calls)
const updated = submitLessonInEnrollment(enrollment, lessonId, evidence);

// Side effect: persist the result
await writeOne(workspaceId, updated, db);
```

### 6. Job Idempotence via Interval + Dedupe

Jobs run on a schedule but never duplicate work:

```typescript
// 1. Check if job is due
const due = await dueJobKeys(["session_reminders"], intervalMap);
if (!due.has("session_reminders")) return;  // Not due yet

// 2. Run job (uses dedupeKey to prevent duplicates)
const result = await cohortSessionReminders();

// 3. Mark as run
await markRun("session_reminders");
```

---

## File Map: Critical Paths

### Authentication & Authorization
- `lib/auth.ts` — Session signing, password hashing, current user verification
- `lib/workspaces.ts` — Workspace CRUD, membership listing, owner verification
- `middleware.ts` — Cookie extraction, session validation for every request

### Programme & Learning
- `lib/enrollments.ts` — Enrollment state machine wrapper
- `lib/curriculum-store.ts` — Curriculum metadata, chapter/lesson definitions
- `lib/chapter-submissions.ts` — Submission CRUD, revision tracking
- `packages/engine/src/enrollment.ts` — Pure state machine (pure TS)

### Data Management
- `lib/store.ts` — Project CRUD, soft-delete, bin restoration
- `lib/soft-delete.ts` — Generic soft-delete + hard-purge pattern
- `lib/db.ts` — PostgreSQL connection pool, advisory locks

### Payments
- `lib/stripe-connect.ts` — Stripe Connect account creation, onboarding links
- `lib/stripe-billing.ts` — Platform invoices (Stripe Billing)
- `lib/stripe-webhook.ts` — Webhook handlers for charge/payout events

### Coaching & Community
- `lib/coach/digest-run.ts` — Weekly coach digest job
- `lib/coach/messages.ts` — Coach-to-learner messaging
- `lib/community/moderation.ts` — Item approval/rejection
- `lib/community/authors.ts` — Author profiles

### Notifications & Jobs
- `lib/notifications.ts` — Create, list, mark-read (in-app)
- `lib/jobs.ts` — Job registry, interval tracking, idempotence
- `lib/mailer.ts` — Email sending via Nodemailer + SMTP

### Operational
- `app/api/cron/tick/route.ts` — External cron caller (orchestrates all jobs)
- `app/api/account/export/route.ts` — GDPR data export
- `app/api/account/delete/route.ts` — Account deletion with hard-purge job

---

## Architecture Decisions & Rationale

### Why Stateless Sessions?
- **Pro:** No session store to manage, scales horizontally instantly
- **Pro:** Single signing key (env var or disk) is enough for all containers
- **Con:** Sessions don't revoke instantly (TTL-based expiry only)

### Why Advisory Locks Instead of Transactions?
- **Pro:** Serializes mutations per workspace, allowing read/modify/write under lock
- **Pro:** Multiple instances compete fairly (no deadlock risk)
- **Con:** Adds ~50-100ms latency per locked mutation

### Why Soft-Delete + Hard-Purge?
- **Pro:** Users can recover accidents for 30 days
- **Pro:** Clean audit trail (deleted_at timestamps)
- **Con:** Requires retention job discipline (otherwise DB grows unbounded)

### Why @onevyrt/engine Over Active Record?
- **Pro:** Pure state machine (testable, no database coupling)
- **Pro:** Curriculum changes are code changes (auditable via git)
- **Pro:** No ORM impedance mismatch on complex state
- **Con:** Manual serialization (engine doesn't know about database)

### Why Stripe REST API Over SDK?
- **Pro:** Fewer dependencies, smaller bundle
- **Pro:** Easy to audit (plain fetch calls, no abstraction)
- **Con:** More boilerplate (string formatting, headers)

---

## Known Gaps & Future Work

| Gap | Severity | Wave | Notes |
|-----|----------|------|-------|
| CSRF token protection | High | 2 | Every mutation should validate token |
| PII encryption at rest | Medium | 4 | Standardize on field-level encryption |
| Scope isolation audit | Medium | 2 | Query-level tests to prevent leakage |
| Audit logging completeness | Medium | 4 | Who changed workspace settings? |
| E2E test coverage | Medium | 5 | Auth, checkout, notifications, deletion |
| TypeScript noImplicitAny | Low | 5 | Type-safe routing, strict mode |

---

## Conclusion

OneVYRT's architecture prioritizes **safety** (workspace isolation, soft-delete recovery), **scale** (stateless sessions, Postgres rate limits), and **sanity** (pure engine, idempotent jobs, deduplication). The result is a system that can handle complex programme workflows, multi-user coaching, and real money transactions while remaining approachable for developers new to the codebase.

For questions or corrections, see the CLAUDE.md project brief and the docs/ directory for deep dives into specific features.
