# Database Schema Audit & Normalization Roadmap

**Last Updated:** 2026-09-02  
**Total Migrations:** 68  
**Database:** PostgreSQL (via node-pg-migrate)  
**Architecture:** Migrated from JSON files (.gearbox) to Postgres (ongoing cutover by domain)

---

## Migration Timeline

The application is undergoing a phased migration from JSON file-based storage (.gearbox) to PostgreSQL. This section documents the migration sequence, grouped by architectural layer.

### Phase 1: Core Authentication & Sessions (Migrations 1-3)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786520829386 | 2025-01-20 | create-sessions | `sessions` | Pilot migration: HTTP session tokens (mirroring lib/auth.ts) |
| 1786528429683 | 2025-01-22 | create-users | `users` | User accounts, password hashes, 2FA secrets (full read/write atomic contract) |
| 1786536425849 | 2025-01-24 | create-workspaces | `workspaces` | Workspace records; members stored as JSONB array (not normalized yet) |

**Key Pattern:** Full read/write atomicity preserved from JSON layer; `members` column denormalized (array of objects instead of separate table).

### Phase 2: Projects & Collaboration (Migrations 4-11)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786536927190 | 2025-01-24 | create-projects | `projects` | Workspace projects/funnels with soft-delete support |
| 1786537357897 | 2025-01-25 | create-activity | `activity` | Per-workspace collaboration feed (audit/timeline) |
| 1786537749650 | 2025-01-25 | create-tracking | `tracking_keys`, `tracking_counts`, `tracking_journeys` | Live tracking: metrics, counts, user journeys |
| 1786539880916 | 2025-01-26 | create-auth-security-stores | `login_guard`, `reset_tokens`, `pending_2fa` | Auth security: brute-force protection, password resets, 2FA pending |
| 1786540198608 | 2025-01-27 | create-referrals | `referral_codes`, `referrals` | Referral program state |
| 1786540471858 | 2025-01-28 | create-comments | `comments` | Project-level comments/notes |
| 1786540688810 | 2025-01-28 | create-revisions | `revisions` | Version history snapshots (capped at 50 per scope/project) |
| 1786540886567 | 2025-01-28 | create-report-shares | `report_shares` | Shareable report links |

**Index Strategy:** `login_guard` indexed on (email, ip) for brute-force protection; tracking tables indexed on user_id.

### Phase 3: Education Platform (Migrations 12-15)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786541104748 | 2025-01-29 | create-cohorts | `cohorts` | Programme cohorts with embedded members/sessions/announcements (JSONB) |
| 1786541348897 | 2025-01-29 | create-curriculum | `curriculum`, `curriculum_deletions` | Programme curriculum (chapters, lessons, modules) |
| 1786541639222 | 2025-01-29 | create-programme-offers | `programme_offers` | Commercial programme tier definitions |
| 1786541862535 | 2025-01-30 | create-enrollments | `enrollments` | Student enrollments with progress as JSONB (lessons/submissions embedded) |

**JSONB Denormalization:** `cohorts.sessions`, `cohorts.announcements`, `enrollments.enrollment` all stored as nested arrays instead of separate tables.

### Phase 4: Backend Stores & Infrastructure (Migrations 16-24)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786542301782 | 2025-01-30 | create-final-small-stores | `audit_log`, `instance_settings`, `stripe_events` | Audit trail, instance config, Stripe webhook cache |
| 1786543068855 | 2025-02-01 | create-stripe-billing-processed-events | `stripe_billing_processed_events` | Billing events processed (idempotency log) |
| 1786607502579 | 2025-02-10 | create-notifications-and-jobs | `notifications`, `job_runs` | In-app notifications (bell icon), background job execution log |
| 1786621070988 | 2025-02-15 | create-app-events | `app_events` | Internal product analytics (usage tracking) |
| 1786628568230 | 2025-02-20 | create-api-keys | `api_keys` | Public read-only API credentials (per-workspace) |
| 1786629800000 | 2025-02-23 | create-outbound-webhooks | `outbound_webhooks` | Integration framework: webhook endpoint definitions |
| 1786630000000 | 2025-02-25 | create-workspace-entitlements | `workspace_entitlements` | Feature flags/plan tier entitlements (alternative to hardcoded plan column) |
| 1786630100000 | 2025-02-26 | create-brand-profiles | `brand_profiles` | Campaign Studio: brand voice, style, guidelines |
| 1786630300000 | 2025-02-27 | platform-connections | `platform_connections` | Ad/social platform integrations (placeholder for future OAuth tokens) |

**Pattern:** Small domain stores, each with workspace_id + created_at indexing.

### Phase 5: Campaign Studio (Migrations 25-28)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786630600000 | 2025-02-28 | workspace-business | `workspace_business` | Business OS: strategic goals, growth drivers, customer profiles (JSONB) |
| 1786630700000 | 2025-03-01 | campaigns | `campaigns` | Marketing campaigns with ordered steps stored as JSONB array |
| 1786631000000 | 2025-03-02 | rate-limits | `rate_limits` | Cross-instance rate limiting (API, login, etc.) |
| 1786631100000 | 2025-03-02 | client-errors | `client_errors` | Client-side render crashes (observability) |

**Indexing:** `rate_limits(key)`, `campaigns(workspace_id, created_at)`.

### Phase 6: Acquisition OS – Leads & Bookings (Migrations 29-36)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786631200000 | 2025-03-03 | pending-email-changes | `pending_email_changes` | Email change confirmations (temporary parking lot) |
| 1786631300000 | 2025-03-03 | bookings | `bookings` | Qualified lead's chosen call slot (funnel_slug, slot_start indexed) |
| 1786631400000 | 2025-03-04 | leads | `qual_funnel_owners`, `leads` | Leads inbox: qualified/nurture/unqualified with ownership tracking |
| 1786631500000 | 2025-03-05 | qual-funnels | `qual_funnels` | Persisted qualification funnels (builder output) |
| 1786631600000 | 2025-03-05 | otp-verifications | `otp_verifications` | Contact verification (OTP) before booking |
| 1786631700000 | 2025-03-06 | funnel-events | `funnel_events`, `funnel_spend` | Funnel analytics: step-through events, ad spend tracking |
| 1786649000000 | 2025-03-26 | lead-events | `lead_events` | Lead activity timeline (append-only log) |
| 1786654000000 | 2025-04-07 | funnel-event-daily-rollup | `funnel_event_daily` | Daily aggregation of funnel_events (retention control) |

**Key Indexes:**
- `leads(workspace_id, created_at)` — inbox queries
- `leads(funnel_slug, created_at)` — funnel analysis
- `funnel_events(workspace_id, created_at)` — analytics
- `funnel_events(created_at)` — retention prune (added migration 1786655000000)

**Soft Deletes:**
- `leads.deleted_at` (migration 1786300200000)
- `bookings.deleted_at` (migration 1786300200000)
- `funnel_events.deleted_at` (migration 1786300200000)

### Phase 7: Creative & Content Management (Migrations 37-45)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786631800000 | 2025-03-07 | creatives | `creatives` | Saved ad creatives (generated variants) |
| 1786632000000 | 2025-03-08 | shared-templates | `shared_templates` | Community-shared funnel templates |
| 1786633000000 | 2025-03-19 | shared-creatives | `shared_creatives` | Community swipe file (shared ad creatives) |
| 1786634000000 | 2025-04-02 | community-identity | `community_profiles` | Workspace public display identity |
| 1786635000000 | 2025-04-13 | community-comments | `community_comments` | Discussion threads on shared artifacts |
| 1786636000000 | 2025-04-25 | community-reactions | `community_reactions` | Helpful reactions (👍) on shared artifacts |
| 1786640000000 | 2025-05-09 | segments | `segments` | Saved contact filters (composable over leads/contacts) |
| 1786641000000 | 2025-05-21 | broadcasts | `broadcasts`, `broadcast_sends`, `contact_optouts` | Bulk messaging: campaigns, delivery log, unsubscribe list |
| 1786643000000 | 2025-06-02 | webhook-deliveries | `webhook_deliveries` | Outbound webhook delivery history |

**Schema Notes:**
- `segments` rules stored as JSONB (no column normalization)
- `broadcasts` segment rules snapshotted as JSONB at send time
- `contact_optouts(workspace_id, channel, address)` — composite key, no secondary index needed
- `community_reactions` also uses composite key pattern

### Phase 8: Soft Deletes & Lifecycle Stages (Migrations 46-50)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786645000000 | 2025-07-06 | soft-delete-projects | — | Add `deleted_at` to projects (30-day recoverable bin) |
| 1786646000000 | 2025-07-18 | soft-delete-segments-campaigns | — | Add `deleted_at` to segments, campaigns (partial index for bin scans) |
| 1786647000000 | 2025-07-29 | lead-lifecycle | — | Add lifecycle stage to leads (new → contacted → booked → won) |
| 1786648000000 | 2025-08-10 | lead-assignment | — | Add assignment (owner_id, next_action) to leads |
| 1786650000000 | 2025-08-22 | stripe-events-workspace-scope | — | Add workspace_id to stripe_events (multi-tenant) |

**Partial Indexes (Performance):**
```sql
projects_deleted_idx ON projects(workspace_id, deleted_at) WHERE deleted_at IS NULL
segments_deleted_idx ON segments(workspace_id, deleted_at) WHERE deleted_at IS NULL
campaigns_deleted_idx ON campaigns(workspace_id, deleted_at) WHERE deleted_at IS NULL
```

### Phase 9: Security & Billing Hardening (Migrations 51-55)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786651000000 | 2025-09-03 | login-guard-per-ip | — | Change login_guard key from email → (email, ip) (non-weaponizable lockout) |
| 1786652000000 | 2025-09-14 | workspace-revenue-ledger | `workspace_revenue` | Durable per-workspace revenue accumulator (prevents 500-event losses) |
| 1786653000000 | 2025-09-26 | broadcast-sending-heartbeat | — | Add heartbeat column to broadcasts (un-strand mid-send) |
| 1786655000000 | 2025-11-08 | funnel-events-created-at-index | — | Index funnel_events(created_at) for retention prune (optimization) |

### Phase 10: Curriculum Reshaping (Migrations 56-60)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1786700000000 | 2025-12-20 | curriculum-three-chapter-arc | — | Reshape curriculum into initial three-chapter arc (now extended to six-stage canonical structure via later migrations) |
| 1786800000000 | 2026-03-22 | curriculum-master-course-map-v3 | — | Replace curriculum with 20-module Master Course (content update) |
| 1786900000000 | 2026-06-24 | chapter-submissions | `chapter_submissions` | Chapter-level coach approval gates (Phase 2 spec) |
| 1787000000000 | 2026-09-26 | create-learner-messages | `learner_messages` | In-app messages from coaches/admins to learners |
| 1787100000000 | 2026-12-28 | bookings-workspace-email-index | — | Add functional index on bookings(workspace_id, lower(email)) for segment builds |

### Phase 11: Analytics & Community Extensions (Migrations 61-68)

| Timestamp | Date | Migration | Tables Created | Summary |
|-----------|------|-----------|-----------------|---------|
| 1787200000000 | 2027-04-01 | workspace-last-billing-event | — | Add event-ordering guard to workspaces (billing webhook idempotency) |
| 1787300100000 | 2027-06-04 | community-artifact-uses | `community_artifact_uses` | Dedupe table for community "uses" popularity counters |
| 1787300200000 | 2027-06-05 | soft-delete-leads-bookings-events | — | Add `deleted_at` to leads, bookings, funnel_events, lead_events (account/workspace deletion) |

---

## Current Schema

### Core Tables (Authentication & Multi-Tenancy)

#### `users`
Primary key model for all authentication and identity.

```
id (TEXT, PK) — unique user identifier
email (TEXT, UNIQUE, NOT NULL) — login email
created_at (TIMESTAMPTZ, NOT NULL) — account creation time
pass (TEXT, NOT NULL) — bcrypt password hash
disabled (BOOLEAN, default: false) — account freeze flag
avatar_url (TEXT) — profile image URL
twofa_enabled (BOOLEAN, default: false) — 2FA activation state
twofa_secret (TEXT) — TOTP secret (base32, RFC 4648)
twofa_pending_secret (TEXT) — temporary secret during 2FA setup
twofa_backup_hashes (TEXT[], pgsql array) — backup codes (one-time, hashed)
```

**Indexes:** `UNIQUE (email)` (implicit on PK)  
**Soft Delete:** None (users are disabled, not deleted)

---

#### `workspaces`
Multi-tenant container for projects, leads, campaigns, etc.

```
id (TEXT, PK) — workspace identifier
name (TEXT, NOT NULL)
owner_id (TEXT, NOT NULL, FK → users.id)
created_at (TIMESTAMPTZ, NOT NULL)
plan (TEXT) — billing tier (e.g., 'free', 'pro', 'enterprise')
stripe_customer_id (TEXT) — Stripe account for billing
stripe_connect_id (TEXT) — Stripe Connect account for marketplace
last_billing_event_id (TEXT) — event-ordering guard for webhook deduplication
members (JSONB, default: []) — array of {userId, role, joinedAt, email}
deleted_at (TIMESTAMPTZ) — soft-delete marker (account deletion)
```

**Indexes:**
- `workspaces(owner_id)` — find workspaces by owner
- `workspaces_members_gin` (GIN on members JSONB) — O(1) member lookup via `members @> [{"userId": ...}]`

**Denormalization Issues:**
- `members` array stores repeated user emails and roles instead of FK to workspace_members table
- Could normalize: `CREATE TABLE workspace_members (workspace_id, user_id, role, joined_at)`

---

#### `sessions`
HTTP session tokens (signed/verified by lib/auth.ts).

```
id (TEXT, PK) — session token
user_id (TEXT, NOT NULL, FK → users.id)
workspace_id (TEXT) — NULL for cross-workspace operations
created_at (TIMESTAMPTZ, NOT NULL, default: now())
expires_at (TIMESTAMPTZ, NOT NULL)
ip_address (TEXT) — optional, for audit
user_agent (TEXT) — optional, for audit
```

**Indexes:** `sessions(user_id)`, `sessions(expires_at)` (for purge)

---

### Projects & Collaboration

#### `projects`
Qualification funnels / marketing projects.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT, NOT NULL)
slug (TEXT) — URL-safe identifier
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
description (TEXT)
deleted_at (TIMESTAMPTZ) — soft-delete marker (30-day bin)
```

**Indexes:**
- `projects(workspace_id, created_at)`
- `projects(workspace_id, deleted_at)` (partial, WHERE deleted_at IS NULL)

---

#### `activity`
Per-workspace collaboration feed (audit trail, mentions, changes).

```
id (TEXT, PK) — event id
workspace_id (TEXT, NOT NULL, FK)
user_id (TEXT, FK → users.id)
type (TEXT, NOT NULL) — 'project_created', 'comment_added', etc.
subject_type (TEXT) — 'project', 'comment', 'funnel', etc.
subject_id (TEXT) — id of the subject (project, comment, etc.)
content (TEXT) — free-text description
metadata (JSONB) — extra context (attribution, diff, etc.)
created_at (TIMESTAMPTZ, NOT NULL, default: now())
```

**Indexes:** `activity(workspace_id, created_at)` DESC

---

#### `comments`
Project-level comments/notes.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
project_id (TEXT, NOT NULL, FK → projects.id)
user_id (TEXT, NOT NULL, FK → users.id)
content (TEXT, NOT NULL)
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
```

**Indexes:** `comments(project_id)`, `comments(user_id, created_at)`

---

#### `revisions`
Version-history snapshots (50 per project, oldest auto-purged).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
project_id (TEXT, NOT NULL, FK → projects.id)
user_id (TEXT, NOT NULL, FK → users.id)
snapshot (JSONB, NOT NULL) — entire project state at this revision
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `revisions(project_id)`, `revisions(created_at)` (for pruning)  
**Prune Logic:** `DELETE FROM revisions WHERE project_id = $1 ORDER BY created_at DESC OFFSET 50`

---

### Education Platform

#### `cohorts`
Student learning cohorts/groups within a programme.

```
id (TEXT, PK)
name (TEXT, NOT NULL)
programme_id (TEXT, NOT NULL, FK → programmes)
coach_user_id (TEXT, NOT NULL, FK → users.id)
coach_email (TEXT, NOT NULL)
start_date (TEXT, NOT NULL) — ISO 8601
end_date (TEXT, NOT NULL) — ISO 8601
created_at (TEXT, NOT NULL)
stage_access_limit (INTEGER) — curriculum stage the cohort can access
member_workspace_ids (JSONB, default: []) — array of workspace UUIDs
sessions (JSONB, default: []) — array of {id, title, date, recording_url, ...}
announcements (JSONB, default: []) — array of {id, title, body, posted_at, ...}
```

**Indexes:** `cohorts(coach_user_id)`

**Denormalization Issues:**
- `member_workspace_ids` array → could be `cohort_members(cohort_id, workspace_id)` table
- `sessions` array → could be `cohort_sessions(cohort_id, title, date, ...)`
- `announcements` array → could be `cohort_announcements(cohort_id, title, body, posted_at, ...)`

**Normalization Impact:** Would enable:
- Per-member queries (e.g., "which cohorts is this user in?")
- Session history indexing (e.g., "cohort sessions after start_date")
- Announcement search/pagination

---

#### `curriculum`
Programme curriculum (chapters, lessons, modules).

```
id (TEXT, PK)
name (TEXT, NOT NULL)
content (JSONB, NOT NULL) — tree structure {chapters: [{id, title, lessons: [...]}]}
version (INTEGER) — curriculum version (V1, V2, V3, etc.)
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
```

**Schema Note:** Content is a monolithic JSONB tree. Recent migrations reshaped this into the canonical six-stage curriculum: initial three-chapter arc (1786700000000), extended to 20-module Master Course map (1786800000000), then Chapter 4 added via v4 migration (1788372500000).

---

#### `enrollments`
Student programme enrollments and progress tracking.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
programme_id (TEXT, NOT NULL, FK)
cohort_id (TEXT, FK → cohorts.id)
user_id (TEXT, NOT NULL, FK → users.id)
status (TEXT) — 'enrolled', 'in_progress', 'completed', 'dropped'
progress (INTEGER) — 0-100 percentage
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
enrollment (JSONB) — complex: {lessons: [{id, completed, submission, feedback}], submissions: {...}}
```

**Indexes:** `enrollments(workspace_id, programme_id)`, `enrollments(user_id)`

**Denormalization Issues:**
- `enrollment.lessons` array → could be `enrollment_lessons(enrollment_id, lesson_id, completed, submitted_at)`
- `enrollment.submissions` → could be `chapter_submissions(enrollment_id, chapter_id, submitted_at, status, ...)`

**Migration Note:** 1786900000000 added `chapter_submissions` table to house coach-approval gates separately.

---

#### `chapter_submissions`
Coach-approval gates at chapter boundaries (Phase 2 spec).

```
id (TEXT, PK)
enrollment_id (TEXT, NOT NULL, FK → enrollments.id)
chapter_id (TEXT, NOT NULL)
submitted_at (TIMESTAMPTZ, NOT NULL, default: now())
status (TEXT) — 'pending', 'approved', 'rejected'
feedback (TEXT) — coach feedback
reviewed_at (TIMESTAMPTZ)
reviewed_by (TEXT, FK → users.id)
```

**Indexes:** `chapter_submissions(enrollment_id, chapter_id)`

---

#### `learner_messages`
In-app messages from coaches/admins to learners.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
from_user_id (TEXT, NOT NULL, FK → users.id)
to_user_id (TEXT, NOT NULL, FK → users.id)
subject (TEXT)
body (TEXT, NOT NULL)
read_at (TIMESTAMPTZ) — NULL until read
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `learner_messages(to_user_id, read_at)` — for unread-message badges

---

### Acquisition OS (Leads, Bookings, Funnels)

#### `qual_funnels`
Persisted qualification funnels (builder output).

```
id (TEXT, PK)
slug (TEXT, UNIQUE) — URL slug for public embed
workspace_id (TEXT, FK) — NULL for shared public demo
steps (JSONB, NOT NULL) — array of {type: 'qualify'|'email'|'book', config: {...}}
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
deleted_at (TIMESTAMPTZ)
```

**Indexes:** `qual_funnels(workspace_id)`, `qual_funnels(slug)`

---

#### `qual_funnel_owners`
Multi-tenant safety: funnel → workspace mapping (for unclaimed funnels).

```
slug (TEXT, PK, FK → qual_funnels.slug)
workspace_id (TEXT, NOT NULL, FK)
created_at (TIMESTAMPTZ, NOT NULL, default: now())
```

**Indexes:** `qual_funnel_owners(workspace_id)`

---

#### `leads`
Lead inbox: qualified/nurture/unqualified prospects.

```
id (TEXT, PK)
funnel_slug (TEXT, NOT NULL, FK → qual_funnels.slug)
workspace_id (TEXT) — NULL until funnel is owned; back-filled on claim
status (TEXT, NOT NULL) — 'qualified', 'nurture', 'unqualified'
score (INTEGER, default: 0)
route (TEXT) — which ad/traffic source
name (TEXT)
email (TEXT)
phone (TEXT)
answers (JSONB) — qualification form answers {field_id: value}
attribution (JSONB) — {utm_source, utm_medium, utm_campaign, ...}
lifecycle_stage (TEXT) — 'new', 'contacted', 'booked', 'won'
assigned_to (TEXT, FK → users.id)
next_action (TEXT)
created_at (TIMESTAMPTZ, NOT NULL, default: now())
updated_at (TIMESTAMPTZ)
deleted_at (TIMESTAMPTZ) — soft-delete (account/workspace deletion)
```

**Indexes:**
- `leads(workspace_id, created_at)` DESC — inbox view
- `leads(funnel_slug, created_at)` DESC — funnel analysis
- `leads(email, workspace_id)` — segment builds (functional index with lower(), migration 1787100000000)

**Soft Delete:** `deleted_at` added migration 1787300200000

**Performance Gap:** `leads(assigned_to)` missing — needed for "my leads" queries.

---

#### `lead_events`
Append-only log of lead activity (state transitions, assignments, etc.).

```
id (TEXT, PK)
lead_id (TEXT, NOT NULL, FK → leads.id)
workspace_id (TEXT, NOT NULL, FK)
type (TEXT, NOT NULL) — 'lifecycle_changed', 'assigned', 'contacted', 'booked'
previous_value (TEXT) — old state
new_value (TEXT) — new state
changed_by (TEXT, FK → users.id)
created_at (TIMESTAMPTZ, NOT NULL)
deleted_at (TIMESTAMPTZ)
```

**Indexes:** `lead_events(lead_id)`, `lead_events(created_at)` (for retention)

---

#### `bookings`
Qualified lead's chosen call slot.

```
id (TEXT, PK)
funnel_slug (TEXT, NOT NULL, FK → qual_funnels.slug)
lead_id (TEXT, FK → leads.id)
workspace_id (TEXT) — added migration 1786631400000
email (TEXT, NOT NULL)
name (TEXT)
slot_start (TIMESTAMPTZ, NOT NULL) — booking start time
slot_end (TIMESTAMPTZ) — booking end time
status (TEXT) — 'confirmed', 'no-show', 'rescheduled'
calendar_url (TEXT) — Google Calendar, Zoom link, etc.
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
deleted_at (TIMESTAMPTZ) — soft-delete
```

**Indexes:**
- `bookings(funnel_slug, slot_start)` — availability queries
- `bookings(workspace_id, slot_start)` — workspace calendar view
- `bookings(workspace_id, lower(email))` — functional, for segment builds (migration 1787100000000)

**Missing Index:** `bookings(workspace_id, email)` for segment lookups.

---

#### `otp_verifications`
Contact verification (one-time password) before booking confirmation.

```
id (TEXT, PK)
funnel_slug (TEXT, NOT NULL, FK)
email (TEXT, NOT NULL)
phone (TEXT)
otp_code (TEXT, NOT NULL) — hashed OTP (e.g., bcrypt)
expires_at (TIMESTAMPTZ, NOT NULL)
verified_at (TIMESTAMPTZ) — NULL until verified
attempt_count (INTEGER, default: 0)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `otp_verifications(email, expires_at)` — for verification checks  
**Performance Gap:** `otp_verifications(funnel_slug, expires_at)` missing — needed for purge job.

---

#### `funnel_events`
Funnel analytics: step-through events (highest-volume table).

```
id (BIGSERIAL, PK)
workspace_id (TEXT, NOT NULL, FK)
funnel_slug (TEXT, NOT NULL, FK)
step_id (TEXT) — which step in the funnel
event_type (TEXT) — 'entered', 'qualified', 'submitted', 'error'
contact_id (TEXT) — or lead_id, for tracking
data (JSONB) — extra event data {duration, error, ...}
created_at (TIMESTAMPTZ, NOT NULL, default: now())
deleted_at (TIMESTAMPTZ)
```

**Indexes:**
- `funnel_events(workspace_id, created_at)` DESC — analytics queries
- `funnel_events(created_at)` — retention prune (added migration 1786655000000)
- `funnel_events_workspace_created_idx` (partial, WHERE deleted_at IS NULL)

**High Volume:** ~500K events per day per workspace; retention prune needed.

**Optimization:** Migration 1786654000000 added `funnel_event_daily` rollup table for bound retention.

---

#### `funnel_event_daily`
Daily aggregation of funnel_events (retention control).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
funnel_slug (TEXT, NOT NULL, FK)
date (DATE)
entered_count (INTEGER)
qualified_count (INTEGER)
submitted_count (INTEGER)
error_count (INTEGER)
created_at (TIMESTAMPTZ)
```

**Indexes:** `funnel_event_daily(workspace_id, date)`

**Purpose:** Allows deletion of raw funnel_events older than N days while preserving aggregates.

---

### Campaign Studio (Campaigns, Segments, Broadcasts)

#### `segments`
Saved contact filters (composable over leads/bookings).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT, NOT NULL)
description (TEXT)
rules (JSONB, NOT NULL) — filter tree: {op: 'and'|'or', conditions: [...]}
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
deleted_at (TIMESTAMPTZ)
```

**Indexes:**
- `segments(workspace_id, created_at)`
- `segments_deleted_idx (partial, WHERE deleted_at IS NULL)` — for bin/purge scans

**Schema Note:** Rules are stored as a tree structure (no normalization).

---

#### `campaigns`
Marketing campaigns (ordered sequence of steps).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT, NOT NULL)
description (TEXT)
status (TEXT) — 'draft', 'active', 'paused', 'completed'
segment_id (TEXT, FK → segments.id)
steps (JSONB, default: []) — array of {type: 'email'|'sms'|'delay', config: {...}}
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
deleted_at (TIMESTAMPTZ)
```

**Indexes:**
- `campaigns(workspace_id, created_at)`
- `campaigns_deleted_idx (partial, WHERE deleted_at IS NULL)`

**Denormalization:** Steps array stores entire config inline instead of separate table.

---

#### `broadcasts`
One-off bulk messaging campaigns.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT, NOT NULL)
channel (TEXT, NOT NULL) — 'email' or 'sms'
subject (TEXT)
body (TEXT, NOT NULL)
rules (JSONB, NOT NULL) — segment rules snapshotted at send time
segment_id (TEXT, FK → segments.id)
status (TEXT) — 'draft', 'sending', 'sent'
recipient_count (INTEGER, default: 0)
sent_count (INTEGER, default: 0)
failed_count (INTEGER, default: 0)
scheduled_at (TIMESTAMPTZ) — NULL for immediate send
heartbeat_at (TIMESTAMPTZ) — for un-stranding mid-send broadcasts
created_at (TIMESTAMPTZ, NOT NULL)
sent_at (TIMESTAMPTZ)
```

**Indexes:** `broadcasts(workspace_id, created_at)` DESC

---

#### `broadcast_sends`
Per-recipient delivery log for broadcasts.

```
id (TEXT, PK)
broadcast_id (TEXT, NOT NULL, FK → broadcasts.id)
workspace_id (TEXT, NOT NULL, FK)
address (TEXT, NOT NULL) — email or phone
status (TEXT, NOT NULL) — 'sent', 'failed', 'skipped'
reason (TEXT) — why skipped/failed (e.g., 'opted_out')
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `broadcast_sends(broadcast_id)` — for delivery log view

**High Volume:** One row per recipient per broadcast. No secondary index on (address) because lookups are broadcast-scoped.

---

#### `contact_optouts`
Unsubscribe list (do-not-contact addresses).

```
workspace_id (TEXT, NOT NULL, FK)
channel (TEXT, NOT NULL) — 'email' or 'sms'
address (TEXT, NOT NULL)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Primary Key:** Composite (workspace_id, channel, address)  
**Indexes:** None needed (all reads are point lookups on full key)

---

### Creative & Content

#### `creatives`
Saved ad creatives (generated variants).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT)
platform (TEXT) — 'facebook', 'google', 'linkedin', etc.
format (TEXT) — 'image', 'video', 'carousel'
url (TEXT) — location of the creative file
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `creatives(workspace_id, created_at)`

---

#### `creative_spend`
Per-creative ad spend (cost-per-qualified-lead).

```
creative_id (TEXT, PK, FK → creatives.id)
workspace_id (TEXT, NOT NULL, FK)
spend (DECIMAL)
leads_generated (INTEGER)
qualified_leads (INTEGER)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `creative_spend(workspace_id)`

---

#### `shared_templates`
Community-shared funnel templates.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK) — template author
template_name (TEXT, NOT NULL)
description (TEXT)
funnel_config (JSONB, NOT NULL) — full funnel structure
preview_image (TEXT)
downloads (INTEGER, default: 0)
community_profile_id (TEXT, FK → community_profiles.id)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `shared_templates(community_profile_id)`, `shared_templates(created_at)` (for browsing)

---

#### `shared_creatives`
Community swipe file (shared ad creatives).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK) — creative author
name (TEXT, NOT NULL)
platform (TEXT)
format (TEXT)
url (TEXT)
community_profile_id (TEXT, FK → community_profiles.id)
created_at (TIMESTAMPTZ, NOT NULL)
uses_count (INTEGER, default: 0) — popularity counter
```

**Indexes:** `shared_creatives(community_profile_id)`, `shared_creatives(created_at)`

---

#### `community_profiles`
Workspace's public community identity.

```
id (TEXT, PK)
workspace_id (TEXT, UNIQUE, NOT NULL, FK)
display_name (TEXT, NOT NULL)
bio (TEXT)
avatar_url (TEXT)
brand_colors (JSONB) — {primary, secondary, accent, ...}
brand_message (JSONB) — {value_prop, tone, ...}
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `community_profiles(workspace_id)` (UNIQUE index)

---

#### `community_comments`
Discussion threads on shared artifacts.

```
id (TEXT, PK)
artifact_id (TEXT, NOT NULL) — shared_templates.id or shared_creatives.id
artifact_type (TEXT, NOT NULL) — 'template' or 'creative'
user_id (TEXT, NOT NULL, FK → users.id)
body (TEXT, NOT NULL)
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
```

**Indexes:** `community_comments(artifact_id, created_at)`

---

#### `community_reactions`
Lightweight endorsements (👍) on shared artifacts.

```
artifact_id (TEXT, NOT NULL)
artifact_type (TEXT, NOT NULL)
user_id (TEXT, NOT NULL, FK → users.id)
reaction (TEXT, NOT NULL) — 'helpful' | emoji
created_at (TIMESTAMPTZ, NOT NULL)
```

**Primary Key:** Composite (artifact_id, user_id, reaction) — one reaction per user per artifact  
**Indexes:** None needed (reads are point lookups)

---

#### `community_artifact_uses`
Dedupe table for "uses" popularity counters (migration 1787300100000).

```
artifact_id (TEXT, NOT NULL)
artifact_type (TEXT, NOT NULL)
workspace_id (TEXT, NOT NULL, FK) — workspace that used it
used_at (TIMESTAMPTZ, NOT NULL)
```

**Primary Key:** Composite (artifact_id, workspace_id) — one use per workspace per artifact  
**Purpose:** Prevents double-counting when multiple team members copy the same creative.

---

### Backend Infrastructure

#### `audit_log`
Durable audit trail (workspace/project changes, user actions).

```
id (BIGSERIAL, PK)
workspace_id (TEXT, NOT NULL, FK)
user_id (TEXT, FK → users.id)
action (TEXT, NOT NULL) — 'created', 'updated', 'deleted', 'login', etc.
subject_type (TEXT) — 'project', 'lead', 'campaign', etc.
subject_id (TEXT)
changes (JSONB) — {before: {...}, after: {...}}
ip_address (TEXT)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `audit_log(workspace_id, created_at)` DESC

---

#### `stripe_events`
Stripe webhook cache (idempotency log, now workspace-scoped).

```
id (TEXT, PK, Stripe event ID)
workspace_id (TEXT, NOT NULL, FK)
type (TEXT, NOT NULL) — Stripe event type (e.g., 'charge.succeeded')
data (JSONB, NOT NULL) — full Stripe event payload
processed_at (TIMESTAMPTZ) — NULL until processed
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `stripe_events(workspace_id, created_at)` DESC

**Migration Note:** 1786650000000 added workspace_id (was global before).

---

#### `stripe_billing_processed_events`
Billing webhook events that have been processed (separate from raw stripe_events).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
stripe_event_id (TEXT, NOT NULL, FK → stripe_events.id)
processed_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `stripe_billing_processed_events(workspace_id)` — for idempotency checks

---

#### `stripe_connect`
Stripe Connect account configuration (for marketplace features).

```
workspace_id (TEXT, PK, FK)
stripe_connect_id (TEXT, NOT NULL) — Stripe Connect account ID
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** None needed (PK lookup only)

---

#### `workspace_revenue`
Durable per-workspace revenue accumulator (prevents 500-event losses).

```
workspace_id (TEXT, PK, FK)
currency (TEXT, NOT NULL) — 'USD', 'GBP', etc.
gross_revenue (DECIMAL) — sum of successful charges
refunded_amount (DECIMAL) — sum of refunds
net_revenue (DECIMAL) — gross - refunded
last_updated_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `workspace_revenue(workspace_id)` (PK lookup)

---

#### `notifications`
In-app notifications (bell icon).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
user_id (TEXT, NOT NULL, FK → users.id)
type (TEXT, NOT NULL) — 'lead_qualified', 'booking_confirmed', 'campaign_sent'
title (TEXT, NOT NULL)
body (TEXT)
action_url (TEXT)
read_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `notifications(user_id, read_at)` — for unread count badges

---

#### `job_runs`
Background job execution log (for debugging, monitoring).

```
id (TEXT, PK)
job_name (TEXT, NOT NULL) — 'broadcast-send', 'funnel-prune', etc.
status (TEXT) — 'running', 'succeeded', 'failed'
started_at (TIMESTAMPTZ, NOT NULL)
completed_at (TIMESTAMPTZ)
error_message (TEXT)
metadata (JSONB) — {workspace_id, batch_count, ...}
```

**Indexes:** `job_runs(job_name, completed_at)` DESC — for job history

---

#### `instance_settings`
Global instance configuration (not per-workspace).

```
key (TEXT, PK)
value (TEXT or JSONB)
updated_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** None needed (settings are small, rarely queried)

---

#### `rate_limits`
Cross-instance rate limiting (API calls, login attempts, etc.).

```
key (TEXT, PK) — e.g., 'api_calls:workspace_id:60m', 'login:email:hour'
count (INTEGER, default: 0)
expires_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** None needed (Redis-like simple key-value)

---

#### `client_errors`
Client-side render crashes (posted to backend for observability).

```
id (TEXT, PK)
workspace_id (TEXT, FK) — NULL for anonymous errors
user_id (TEXT, FK → users.id)
error_message (TEXT, NOT NULL)
stack_trace (TEXT)
user_agent (TEXT)
url (TEXT) — page where error occurred
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `client_errors(workspace_id, created_at)` DESC

---

#### `pending_email_changes`
Email-change confirmation (temporary parking lot).

```
id (TEXT, PK)
user_id (TEXT, NOT NULL, FK → users.id)
new_email (TEXT, NOT NULL)
confirmation_token (TEXT, NOT NULL)
expires_at (TIMESTAMPTZ, NOT NULL)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `pending_email_changes(user_id)`, `pending_email_changes(confirmation_token)`

---

#### `reset_tokens`
Password reset tokens (temporary).

```
id (TEXT, PK)
user_id (TEXT, NOT NULL, FK → users.id)
token (TEXT, NOT NULL, unique)
expires_at (TIMESTAMPTZ, NOT NULL)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `reset_tokens(user_id)`, `reset_tokens(token)` UNIQUE

---

#### `login_guard`
Brute-force protection (keyed by email + IP).

```
email (TEXT, NOT NULL)
ip_address (TEXT, NOT NULL)
attempt_count (INTEGER, default: 0)
first_attempt_at (TIMESTAMPTZ, NOT NULL)
locked_until (TIMESTAMPTZ)
```

**Primary Key:** Composite (email, ip_address)  
**Migration Note:** 1786651000000 changed from email-only to (email, ip) to prevent weaponization.

---

#### `pending_2fa`
2FA code delivery (temporary, one-time use).

```
user_id (TEXT, NOT NULL, FK → users.id)
code (TEXT, NOT NULL) — hashed TOTP code
expires_at (TIMESTAMPTZ, NOT NULL)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Primary Key:** (user_id) — one pending 2FA per user  
**Indexes:** None (usually accessed by PK)

---

### API & Integration

#### `api_keys`
Read-only public API credentials (per-workspace).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT)
key (TEXT, NOT NULL, unique, hashed) — used for auth header
last_used_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `api_keys(workspace_id)`, `api_keys(key)` UNIQUE

---

#### `outbound_webhooks`
Webhook endpoint definitions (framework for integrations).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT, NOT NULL)
url (TEXT, NOT NULL)
events (JSONB) — array of subscribed event types: ['lead.qualified', 'booking.created', ...]
secret (TEXT) — HMAC secret for signing
status (TEXT) — 'active', 'disabled', 'failed'
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `outbound_webhooks(workspace_id)`

---

#### `webhook_deliveries`
Delivery history for outbound webhooks.

```
id (BIGSERIAL, PK)
webhook_id (TEXT, NOT NULL, FK → outbound_webhooks.id)
workspace_id (TEXT, NOT NULL, FK)
event_type (TEXT, NOT NULL) — which event triggered this
status (TEXT) — 'pending', 'delivered', 'failed'
http_status (INTEGER)
response_body (TEXT)
attempt_count (INTEGER, default: 1)
next_retry_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `webhook_deliveries(webhook_id)`, `webhook_deliveries(workspace_id, created_at)` DESC

**Note:** Using BIGSERIAL for cheap recent-first ordering and stable prune anchor.

---

### Brand & Business

#### `brand_profiles`
Campaign Studio "Brand Brain" — persistent brand voice/style, one row per
workspace (see `apps/web/lib/brand.ts`). Real typed columns, not a jsonb
blob, except `message`/`products`/`testimonials`. Several fields
(`business_in`/`business_really_in`/`audience`/`guarantees`/`pricing_notes`
and part of `message`) overlap with facts a more specific Business-OS tool
now owns — `app/api/campaign-studio/brand/route.ts`'s PATCH redirects those
into the canonical store instead, and GET reads them back from there,
falling back to this table's own (frozen, pre-migration) value only when
the canonical source has nothing. See that route's module doc comment for
the exact field mapping.

```
workspace_id (TEXT, PK)
website_url (TEXT)
company_name (TEXT)
industry (TEXT)
description (TEXT)
logo_url (TEXT)
primary_color (TEXT)
primary_color_name (TEXT)         — added 1786630200000
secondary_color (TEXT)
secondary_color_name (TEXT)       — added 1786630200000
business_in (TEXT)                — added 1786630200000
business_really_in (TEXT)         — added 1786630200000
language (TEXT)
brand_voice (TEXT) — plain free text, not structured
prohibited_words (TEXT[], NOT NULL, default '{}')
products (JSONB, NOT NULL, default '[]') — [{name, description?, price?}]
audience (TEXT)
competitors (TEXT)
guarantees (TEXT)
pricing_notes (TEXT)
locations (TEXT)
testimonials (JSONB, NOT NULL, default '[]') — [{quote, author?}]
message (JSONB, NOT NULL, default '{}')  — added 1786630400000;
  {hero?, problem?, guide?, plan?, callToAction?, success?, failure?, oneLiner?}
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** none beyond the `workspace_id` primary key itself (a second
row per workspace is impossible at the schema level). No FK to
`workspaces` — isolation is enforced in application code
(`app/api/campaign-studio/brand/route.ts`'s `resolveScope()`).

---

#### `workspace_business`
Business OS: strategic goals, growth drivers, customer profiles.

```
id (TEXT, PK)
workspace_id (TEXT, UNIQUE, NOT NULL, FK)
data (JSONB) — {mission, vision, goals, customer_segments, market, growth_drivers, ...}
created_at (TIMESTAMPTZ, NOT NULL)
updated_at (TIMESTAMPTZ)
```

**Indexes:** `workspace_business(workspace_id)` UNIQUE

---

#### `workspace_entitlements`
Feature flags/plan tier entitlements (alternative to hardcoded plan column).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
entitlement (TEXT, NOT NULL) — 'campaigns', 'broadcasts', 'api', 'integrations'
granted_at (TIMESTAMPTZ, NOT NULL)
expires_at (TIMESTAMPTZ) — NULL for perpetual
```

**Indexes:** `workspace_entitlements(workspace_id, entitlement)` UNIQUE

---

#### `platform_connections`
Ad/social platform integrations (placeholder for future OAuth tokens).

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
platform (TEXT, NOT NULL) — 'facebook', 'google_ads', 'linkedin'
status (TEXT) — 'connected', 'disconnected', 'expired'
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `platform_connections(workspace_id, platform)` UNIQUE

**Future Migration:** When OAuth lands, add encrypted columns: `access_token`, `refresh_token`, `token_expires_at`.

---

#### `referral_codes`
Referral programme: promotional codes.

```
id (TEXT, PK)
code (TEXT, NOT NULL, unique)
generated_by (TEXT, NOT NULL, FK → users.id)
discount_percent (INTEGER)
created_at (TIMESTAMPTZ, NOT NULL)
expires_at (TIMESTAMPTZ)
```

**Indexes:** `referral_codes(code)` UNIQUE

---

#### `referrals`
Referral redemptions.

```
id (TEXT, PK)
code_id (TEXT, NOT NULL, FK → referral_codes.id)
referred_user_id (TEXT, NOT NULL, FK → users.id)
referrer_user_id (TEXT, NOT NULL, FK → users.id)
status (TEXT) — 'pending', 'active', 'expired'
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `referrals(referred_user_id)`, `referrals(referrer_user_id)`

---

#### `app_events`
Internal product analytics (usage tracking).

```
id (BIGSERIAL, PK)
workspace_id (TEXT, NOT NULL, FK)
user_id (TEXT, NOT NULL, FK → users.id)
event_name (TEXT, NOT NULL) — 'funnel_created', 'lead_qualified', 'campaign_sent'
properties (JSONB) — {duration, count, ...}
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `app_events(workspace_id, event_name, created_at)` — for analytics queries

**High Volume:** Needs retention prune (similar to funnel_events).

---

#### `report_shares`
Shareable report links.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
report_id (TEXT, NOT NULL)
token (TEXT, NOT NULL, unique)
expires_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `report_shares(token)` UNIQUE

---

#### `tracking_keys`
Live tracking: metric definitions.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
name (TEXT, NOT NULL)
description (TEXT)
created_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `tracking_keys(workspace_id)`

---

#### `tracking_counts`
Live tracking: current metric values.

```
key_id (TEXT, PK, FK → tracking_keys.id)
value (INTEGER, default: 0)
updated_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** None (PK lookup only)

---

#### `tracking_journeys`
Live tracking: user journey milestones.

```
id (TEXT, PK)
workspace_id (TEXT, NOT NULL, FK)
user_id (TEXT, FK)
milestone (TEXT) — 'signup', 'first_funnel', 'first_lead', etc.
reached_at (TIMESTAMPTZ, NOT NULL)
```

**Indexes:** `tracking_journeys(workspace_id, user_id)`, `tracking_journeys(milestone)`

---

#### `referral_codes`
(Duplicate entry — see above under referral_codes)

---

## Index Analysis

### ✅ Implemented Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| users | (email) | UNIQUE | Login email uniqueness |
| workspaces | (owner_id) | B-tree | Find owner's workspaces |
| workspaces | (members) | GIN | Fast member lookup via JSONB containment |
| sessions | (user_id) | B-tree | Find active sessions |
| sessions | (expires_at) | B-tree | Purge expired sessions |
| projects | (workspace_id, created_at) | B-tree | Recent projects |
| projects | (workspace_id, deleted_at) | Partial | Undeleted projects in bin |
| activity | (workspace_id, created_at) | B-tree | Workspace feed DESC |
| comments | (project_id) | B-tree | Project comments |
| comments | (user_id, created_at) | B-tree | User activity |
| revisions | (project_id) | B-tree | Version history |
| cohorts | (coach_user_id) | B-tree | Find coach's cohorts |
| enrollments | (workspace_id, programme_id) | B-tree | Workspace programs |
| enrollments | (user_id) | B-tree | User's enrollments |
| leads | (workspace_id, created_at) | B-tree | Inbox view |
| leads | (funnel_slug, created_at) | B-tree | Funnel analysis |
| leads | (email, workspace_id) | Functional | Segment builds (lower()) |
| bookings | (funnel_slug, slot_start) | B-tree | Availability |
| bookings | (workspace_id, slot_start) | B-tree | Calendar view |
| bookings | (workspace_id, email) | Functional | Segment lookups (lower()) |
| funnel_events | (workspace_id, created_at) | B-tree | Analytics queries |
| funnel_events | (created_at) | B-tree | Retention prune |
| funnel_event_daily | (workspace_id, date) | B-tree | Daily aggregates |
| segments | (workspace_id, created_at) | B-tree | List segments |
| segments | (workspace_id, deleted_at) | Partial | Bin/purge scans |
| campaigns | (workspace_id, created_at) | B-tree | List campaigns |
| campaigns | (workspace_id, deleted_at) | Partial | Bin/purge scans |
| broadcasts | (workspace_id, created_at) | B-tree | Broadcast history |
| broadcast_sends | (broadcast_id) | B-tree | Delivery log |
| creatives | (workspace_id, created_at) | B-tree | Creative library |
| shared_templates | (community_profile_id) | B-tree | Creator's templates |
| shared_creatives | (community_profile_id) | B-tree | Creator's creatives |
| community_comments | (artifact_id, created_at) | B-tree | Artifact discussions |
| audit_log | (workspace_id, created_at) | B-tree | Audit trail |
| stripe_events | (workspace_id, created_at) | B-tree | Event history |
| notifications | (user_id, read_at) | B-tree | Unread count |
| job_runs | (job_name, completed_at) | B-tree | Job history |
| client_errors | (workspace_id, created_at) | B-tree | Error timeline |
| pending_email_changes | (user_id) | B-tree | Pending email by user |
| pending_email_changes | (confirmation_token) | B-tree | Confirm by token |
| reset_tokens | (user_id) | B-tree | Pending reset by user |
| reset_tokens | (token) | UNIQUE | Confirm by token |
| login_guard | (email, ip_address) | Composite PK | Brute-force protection |
| api_keys | (workspace_id) | B-tree | List workspace keys |
| api_keys | (key) | UNIQUE | Auth lookup |
| outbound_webhooks | (workspace_id) | B-tree | List webhooks |
| webhook_deliveries | (webhook_id) | B-tree | Delivery log |
| webhook_deliveries | (workspace_id, created_at) | B-tree | Workspace deliveries |
| brand_profiles | (workspace_id) | UNIQUE | Workspace brand |
| workspace_business | (workspace_id) | UNIQUE | Workspace business OS |
| workspace_entitlements | (workspace_id, entitlement) | UNIQUE | Entitlement lookup |
| platform_connections | (workspace_id, platform) | UNIQUE | Platform auth |
| referral_codes | (code) | UNIQUE | Redeem code |
| referrals | (referred_user_id) | B-tree | Find referrals |
| referrals | (referrer_user_id) | B-tree | Find my referrals |
| app_events | (workspace_id, event_name, created_at) | B-tree | Analytics rollup |
| report_shares | (token) | UNIQUE | Access by token |
| tracking_keys | (workspace_id) | B-tree | List tracking metrics |
| chapter_submissions | (enrollment_id, chapter_id) | B-tree | Enrollment chapters |

### ⚠️ Missing Indexes (Performance Gaps)

| Table | Missing Index | Impact | Priority |
|-------|---------------|--------|----------|
| leads | (assigned_to) | "My leads" inbox queries scan full table | HIGH |
| otp_verifications | (funnel_slug, expires_at) | Purge job scans all OTPs, not just expired | MEDIUM |
| funnel_events | (funnel_slug) | Analytics by funnel requires full workspace scan | MEDIUM |
| bookings | (lead_id) | Finding booking for a lead requires scan | LOW |
| lead_events | (lead_id) | Timeline queries are indexed (good) but secondary lookups missing | LOW |
| community_reactions | None needed | All reads are point lookups on composite key | N/A |
| community_artifact_uses | None needed | All reads are point lookups on composite key | N/A |

### High-Volume Tables Needing Retention Strategy

| Table | Estimated Rate | Retention Strategy | Status |
|-------|-----------------|-------------------|--------|
| funnel_events | ~500K/day/workspace | Daily rollup + aggressive prune | ✅ Implemented (funnel_event_daily) |
| app_events | ~50K/day/workspace | Aggregate by event_name + prune old | ⚠️ No rollup table yet |
| audit_log | ~10K/day/workspace | Keep 1 year, archive older | ⚠️ No archive strategy |
| lead_events | ~1K/day/workspace | Keep 2 years (tied to lead retention) | ⚠️ No retention query |

---

## Normalization Opportunities

### 1. `workspaces.members` (JSONB Array → Relational Table)

**Current Schema:**
```sql
workspaces.members = [{userId: "...", role: "owner", joinedAt: "...", email: "..."}, ...]
```

**Issues:**
- Email is stored twice (users.email and workspaces.members[].email)
- Role changes require rewriting entire array
- Per-member queries (e.g., "which workspaces does user X belong to?") require JSONB unnesting
- No foreign-key constraint on userId

**Proposed Normalization:**
```sql
CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX workspace_members_user_idx ON workspace_members(user_id);
```

**Migration Effort:** Medium (data migration + application layer changes)  
**Benefit:** Cleaner queries, FK constraints, easier role management

---

### 2. `cohorts.{sessions, announcements, member_workspace_ids}` (JSONB → Relational)

**Current Schema:**
```sql
cohorts.member_workspace_ids = ["workspace_id_1", "workspace_id_2", ...]
cohorts.sessions = [{id, title, date, recordingUrl}, ...]
cohorts.announcements = [{id, title, body, postedAt}, ...]
```

**Issues:**
- Complex queries require JSONB unnesting
- No direct way to query "which cohorts does workspace X belong to?"
- Session/announcement pagination not possible (all-or-nothing array fetch)
- No history/updates for sessions/announcements

**Proposed Normalization:**
```sql
CREATE TABLE cohort_members (
  cohort_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (cohort_id, workspace_id),
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE cohort_sessions (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);
CREATE INDEX cohort_sessions_cohort_date_idx ON cohort_sessions(cohort_id, date DESC);

CREATE TABLE cohort_announcements (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  posted_by TEXT,
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);
CREATE INDEX cohort_announcements_cohort_posted_idx ON cohort_announcements(cohort_id, posted_at DESC);
```

**Migration Effort:** High (complex atomic operation, possibly split across multiple migrations)  
**Benefit:** Enables per-member queries, session history, announcement pagination

---

### 3. `enrollments.enrollment` (JSONB → Separate Tables)

**Current Schema:**
```sql
enrollments.enrollment = {
  lessons: [{id, completed, submission, feedback}, ...],
  submissions: {...},
  progress: 0-100
}
```

**Issues:**
- No lesson-level queries (all-or-nothing fetch)
- Lesson progress tracking requires rewriting entire object
- Chapter-level coach gates (1786900000000) created separate `chapter_submissions` table but didn't normalize lessons

**Proposed Normalization:**
```sql
CREATE TABLE enrollment_lessons (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  submission_data JSONB,
  feedback TEXT,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
);
CREATE INDEX enrollment_lessons_enrollment_lesson_idx ON enrollment_lessons(enrollment_id, lesson_id);

-- Note: chapter_submissions table already exists (migration 1786900000000),
-- but could be unified under this schema
```

**Migration Effort:** Medium (1786900000000 already started this; complete the normalization)  
**Benefit:** Lesson-level queries, better progress tracking

---

### 4. `segments.rules` (JSONB Rule Tree → Queryable Structure)

**Current Schema:**
```sql
segments.rules = {
  op: 'and',
  conditions: [
    {field: 'status', operator: 'eq', value: 'qualified'},
    {field: 'score', operator: 'gte', value: 50}
  ]
}
```

**Issues:**
- No way to query "which segments use field X?"
- Rule changes require rewriting entire object
- No versioning of rule changes

**Proposed Normalization:**
```sql
CREATE TABLE segment_conditions (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value TEXT,
  position INTEGER,
  FOREIGN KEY (segment_id) REFERENCES segments(id)
);
CREATE INDEX segment_conditions_segment_idx ON segment_conditions(segment_id);

-- Keep segments.rules as JSONB for backward compatibility,
-- but sync condition_segments when updated
```

**Migration Effort:** Low (additive, can keep JSONB for reads)  
**Benefit:** Rule visibility, audit trail, validation

---

### 5. `campaigns.steps` (JSONB Array → Relational)

**Current Schema:**
```sql
campaigns.steps = [
  {type: 'email', subject: '...', body: '...'},
  {type: 'delay', duration: '1 day'},
  {type: 'sms', body: '...'}
]
```

**Issues:**
- No way to query "which campaigns have an email step?"
- Step reordering requires rewriting array
- No pause/edit per-step capability

**Proposed Normalization:**
```sql
CREATE TABLE campaign_steps (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
CREATE INDEX campaign_steps_campaign_idx ON campaign_steps(campaign_id, position);
```

**Migration Effort:** Medium (ordering logic must be preserved)  
**Benefit:** Per-step queries, easier step management

---

### 6. `qual_funnels.steps` (JSONB → Relational)

**Current Schema:**
```sql
qual_funnels.steps = [
  {type: 'qualify', title: '...', questions: [...]},
  {type: 'email', template: '...'},
  {type: 'book', calendarId: '...'}
]
```

**Issues:**
- Same as campaigns.steps above

**Proposed Normalization:**
```sql
CREATE TABLE funnel_steps (
  id TEXT PRIMARY KEY,
  funnel_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (funnel_id) REFERENCES qual_funnels(id)
);
CREATE INDEX funnel_steps_funnel_idx ON funnel_steps(funnel_id, position);
```

**Migration Effort:** Medium  
**Benefit:** Step-level analytics, easier builder maintenance

---

## Retention & Cleanup Strategy

### Current Retention Policies

| Table | Retention | Trigger | Status |
|-------|-----------|---------|--------|
| sessions | Expires at TTL | Automatic (EXPIRES_AT field) | ✅ App purges on login |
| reset_tokens | 1 hour | Automatic (EXPIRES_AT field) | ✅ App checks on verify |
| pending_2fa | 10 minutes | Automatic (EXPIRES_AT field) | ✅ App checks on verify |
| otp_verifications | 15 minutes | Automatic (EXPIRES_AT field) | ⚠️ No active purge job |
| login_guard | 1 hour (lockout window) | Automatic (LOCKED_UNTIL field) | ⚠️ No purge of old records |
| funnel_events | Aggregate to funnel_event_daily, then delete older than 90 days | Scheduled job | ⚠️ Job schedule unclear |
| app_events | No retention policy yet | Manual purge needed | ❌ MISSING |
| audit_log | Assumed 1 year | Manual purge needed | ❌ MISSING |
| client_errors | No retention policy | Manual purge needed | ❌ MISSING |

### Recommended Retention Cleanup

**High-Volume Tables:**

1. **funnel_events**: Implement 90-day retention with daily rollup
   ```sql
   -- Existing: funnel_event_daily aggregates daily counts
   DELETE FROM funnel_events WHERE created_at < NOW() - INTERVAL '90 days' AND deleted_at IS NULL;
   ```

2. **app_events**: Similar pattern
   ```sql
   -- Create app_event_daily rollup table (similar to funnel_event_daily)
   -- Prune raw events after 30 days
   ```

3. **audit_log**: 1-year retention, consider archival to cold storage
   ```sql
   -- Archive events older than 1 year to archive_audit_log, then delete
   ```

**Temporary Tables:**

1. **otp_verifications**: Add cleanup job
   ```sql
   DELETE FROM otp_verifications WHERE expires_at < NOW();
   ```

2. **login_guard**: Clean up old lockout records
   ```sql
   DELETE FROM login_guard WHERE locked_until < NOW() - INTERVAL '1 day';
   ```

3. **pending_email_changes**: Clean up expired confirmations
   ```sql
   DELETE FROM pending_email_changes WHERE expires_at < NOW();
   ```

---

## Performance Recommendations

### Immediate Actions (HIGH)

1. **Add missing index on `leads(assigned_to)`**
   - Enables "my leads" inbox queries without full table scan
   ```sql
   CREATE INDEX leads_assigned_to_idx ON leads(assigned_to) WHERE deleted_at IS NULL;
   ```

2. **Add functional index on `bookings(workspace_id, email)`**
   - Segment builds query by email in O(1)
   ```sql
   CREATE INDEX bookings_workspace_email_idx ON bookings(workspace_id, lower(email)) WHERE deleted_at IS NULL;
   ```

3. **Add index on `otp_verifications(funnel_slug, expires_at)`**
   - Purge job can target expired OTPs directly
   ```sql
   CREATE INDEX otp_verifications_funnel_expires_idx ON otp_verifications(funnel_slug, expires_at);
   ```

### Near-Term Actions (MEDIUM)

4. **Create `funnel_event_daily` cleanup job**
   - Prune raw funnel_events older than 90 days
   - Run nightly

5. **Normalize `workspaces.members` → `workspace_members` table**
   - Eliminates duplicate emails
   - Enables "which workspaces does user X belong to?" queries

6. **Add secondary index on `funnel_events(funnel_slug)`**
   - Analytics by funnel currently requires workspace scan

### Long-Term Actions (LOW)

7. **Normalize `cohorts.{sessions, announcements, members}`**
   - Enables pagination and per-cohort queries

8. **Normalize `enrollments.enrollment`**
   - Lesson-level queries and progress tracking

9. **Create rule/condition tables for segments**
   - Enables rule visibility and audit trail

10. **Normalize campaign and funnel steps**
    - Per-step queries and management

---

## Conclusions

The database has evolved organically from JSON file storage into a hybrid RDBMS. Key observations:

1. **Denormalization Pattern:** JSONB columns are used heavily for complex nested structures (members, sessions, steps, rules). This trades query flexibility for simplicity in application code.

2. **Soft-Delete Pattern:** Projects, segments, campaigns, and leads use `deleted_at` soft deletes with partial indexes. Clean and efficient.

3. **Multi-Tenant Design:** Workspace-scoped tables and rows ensure data isolation. Indexes on (workspace_id, created_at) are the standard pattern.

4. **High-Volume Tables:** Funnel_events and app_events need aggressive retention and rollup strategies to stay performant.

5. **Missing Indexes:** Three gaps identified (assigned_to, otp_verifications funnel_slug+expires_at, funnel_events funnel_slug) could impact production queries.

6. **Normalization Opportunities:** Members, cohort metadata, and enrollment progress would benefit from relational normalization, but the cost/benefit is low for read-mostly operations.

**Recommendation:** Prioritize the three missing indexes in the next release, then evaluate normalization based on query patterns from production monitoring.
