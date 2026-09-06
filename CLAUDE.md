# ONEVYRT: Growth Operating System

## Project Identity

**ONEVYRT** is a business growth coaching platform delivered as a structured online programme with AI-driven tools, measurable outcomes, and a sustainable revenue model through Stripe Connect payouts for qualified leads.

**Core Value Proposition:** Transform how a small business owner thinks about (and operates) their business through a four-stage programme:
1. **DEFINE** — Business + Customer + Psychology Blueprint
2. **IMPLEMENT** — Working Business System
3. **CONTROL** — Numbers & Control Dashboard  
4. **IMPROVE & SCALE** — Growth & Improvement Plan

Each stage produces a permanent artifact (dashboard/plan/report) and requires coach approval before progression. The entire journey culminates in a **Transformation Report** showing what changed and a **Next 90-Day Plan** for continued growth.

**Status: all four chapters are live.** Chapter 4 (IMPROVE & SCALE) shipped as a real canonical curriculum stage — gated by coach approval exactly like Chapters 1-3, via the same generic engine mechanism (see "Programme Structure" below).

---

## Technical Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind CSS)
- **Monorepo:** pnpm workspaces (apps/web, packages/)
- **Database:** PostgreSQL, plain `pg` (no ORM) — every table is hand-written SQL, versioned with `node-pg-migrate` (`apps/web/migrations/*.js`); most storage is one JSONB blob per row (e.g. `enrollments.enrollment`), read/modified/written whole under a cross-container Postgres advisory lock (`lib/db.ts`'s `withAdvisoryLock`). `apps/web/prisma/schema-updates/*.prisma` is documentation-only (Prisma's schema language used as a precise spec of a shipped table) — there is no `@prisma/client` dependency and nothing in the app ever runs `prisma generate`/`prisma migrate`.
- **State Machine:** @onevyrt/engine (pure TypeScript, immutable curriculum progression)
- **Payments:** Stripe Connect (payouts to qualified funnels), Stripe Billing (invoices)
- **SMS/Email:** Twilio (optional, configured via env) + Node SMTP
- **Hosting:** Vercel (Next.js) + Fly.io (database) + Tailscale (bastion)
- **CI/CD:** GitHub Actions, auto-deploys to onevyrt.masteryresearch.com on master push

---

## Architecture Overview

### API Routes (158 total)
Organized by feature area:
- `api/auth/*` — Session management, login, signup, password reset
- `api/account/*` — Profile, export (GDPR), deletion
- `api/projects/*` — Funnel/campaign CRUD, comments, revisions
- `api/programme/*` — Enrollment, cohort sessions, chapter submissions
- `api/coaching/*` — Submission review, approval gates, coach messages
- `api/community/*` — Template/creative publishing, moderation
- `api/cron/*` — Job tick, webhook dispatching
- `api/stripe/*` — Webhook receivers (charge, refund, payout)

### Database Schema
**Core tables:**
- `users` (id, email, password_hash, created_at)
- `workspaces` (id, name, owner_id, stripe_customer_id, deleted_at)
- `workspaces_users` (workspace_id, user_id, role: owner|manager|editor|viewer)
- `enrollments` (workspace_id, enrollment: Enrollment JSON, last_modified_at)
- `projects` (id, workspace_id, type: funnel|campaign, slug, data: JSON, deleted_at)
- `cohorts` (id, coach_user_id, coach_email, sessions: JSON[], member_workspace_ids: string[])
- `otp_verifications` (id, funnel_slug, channel: email|sms, destination, code_hash, verified_at, expires_at, deleted_at)
- `workspace_why_creed` (id, workspace_id, why: text, creed: text, created_at, updated_at, deleted_at) — soft-delete, unique per workspace

**Audit tables:**
- `job_runs` (job_key, last_run_at)
- `activity_log` (workspace_id, user_id, action, metadata: JSON, created_at)

### Key Patterns

**1. Soft-Delete + Hard-Purge**
- `deleted_at IS NULL` queries for live records
- Hard-delete job runs nightly after retention window (7–30 days depending on data type)
- Applies to: projects, leads, bookings, otp_verifications, sessions

**2. Session-Based Auth**
- Cookie set with `AUTH_SECRET` (32-byte hex)
- No OAuth; email/password only
- Session tied to `user.id`, checked on every request via `currentUser(req.headers.get("cookie"))`
- CSRF tokens not yet implemented (known gap)

**3. Workspace Isolation**
- Every workspace operation reads `listForUser(user.id)` first to confirm membership
- API routes check `ws.id` against workspace being operated on
- Queries use `WHERE ... AND workspace_id = $1` to prevent cross-workspace leakage

**4. Idempotent Notifications**
- Each notification has a `dedupeKey` (e.g., `cohort_session:${sessionId}:${userId}`)
- `createNotification()` returns `null` if dedupeKey already exists
- Job re-runs never double-notify; deterministic per notification

**5. Rate Limiting**
- Per-user + sliding window (e.g., 5 data-export requests per hour)
- Stored in memory (not durable); resets on container restart
- Applied to heavy endpoints: export, community moderation, OTP send

---

## Route Destinations (Canonical)

**Canonical routes** are defined in `lib/navigation/canonical-routes.ts` — the single source of truth for all application URLs. Every hardcoded route reference must import from this module to ensure consistency and enable easy refactoring.

### URL Structure

| Section | Canonical Route | Purpose | Notes |
|---------|-----------------|---------|-------|
| **Home & Entry** | `/command-center` | Signed-in home (guided dashboard) | `/` auto-redirects here for auth'd users; `/app` and `/studio` for the canvas |
| | `/studio` | Funnel/project editor canvas | Stable, durable URL for the builder |
| **Learning** | `/programme` | Course hub (all chapters + lessons) | Entry to DEFINE → IMPLEMENT → CONTROL → IMPROVE & SCALE → FINISH |
| | `/programme/chapter-[1-4]` | Chapter intro & submission | Gated by prior chapter approval |
| **Business OS** | `/business` | Reality, constraint, drivers, execution | Main business strategy hub |
| | `/business/reality` | Business reality map | Where you are now |
| | `/business/constraint` | Identify the single biggest constraint | Growth bottleneck |
| | `/business/drivers` | Driver tree | What influences your constraint |
| | `/business/execution` | Execution roadmap | Tactics to move the constraint |
| | `/business/review` | Weekly review ritual | Measure progress, adjust |
| | `/business/funnels` | Lead funnel builder | Sales funnel canvas |
| | `/business/leads` | Leads inbox + CRM | Capture, qualify, book calls |
| | `/business/segments` | Broadcast audiences | Re-engage past leads |
| | `/business/message` | One-liner copywriting | Your core positioning |
| **Coaching** | `/coaching` | Coach cohort hub | Coaches only; learner progress, approvals |
| **Campaign Studio** | `/campaign-studio` | AI brand, creatives, campaigns | Hub for content creation |
| | `/campaign-studio/brand` | Brand brain setup | Voice, audience, facts |
| | `/campaign-studio/write` | AI copywriting (emails, pages) | Copy generation |
| | `/campaign-studio/creative` | AI ad creative generator | Visual ad creation |
| | `/campaign-studio/campaigns` | Campaign manager | Launch & track campaigns |
| | `/campaign-studio/connections` | Ad platform integrations | Connect to Facebook, Google, etc. |
| **Community** | `/community` | Template swipe file & creatives | Share what works, learn from others |
| **Account** | `/account` | Profile, settings, export, deletion | Personal workspace management |
| | `/account/transformation-report` | Journey summary + 90-day plan | Shareable report on progress |
| **Admin** | `/admin` | Admin overview | Learners, cohorts, curriculum (admin only) |
| | `/admin/curriculum` | Curriculum editor | Manage course content |
| | `/admin/learners` | Learner management | Search, enroll, export data |
| **Public** | `/welcome` | Sign-up flow entry | New account onboarding |
| | `/start` | Journey roadmap setup | Step-by-step plan builder |
| | `/glossary` | Terminology reference | Business & marketing terms |
| | `/privacy`, `/terms` | Legal pages | Privacy policy, terms of service |

### Deprecated Routes (Auto-Redirect to Canonical)

| Old Route | Canonical Route | Status |
|-----------|-----------------|--------|
| `/app` | `/studio` | Redirects with 308 (permanent) |
| `/businesses` | `/coaching` | Redirects with 308 (permanent) |
| `/my-business` | `/business` | Redirects with 308 (permanent) |

All deprecated routes are handled in `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`; same hook, see https://nextjs.org/docs/messages/middleware-to-proxy) and `lib/route-redirects.ts`. When a user visits an old URL, they are permanently (308) redirected to the canonical version. This allows old bookmarks and links to keep working while the codebase uses a single consistent set of URLs. `proxy.ts` also runs the app's central CSRF enforcement on `/api/*` — see `docs/CSRF_ROUTE_AUDIT.md`.

### Usage

**In React components:**
```typescript
import { CANONICAL_ROUTES } from '@/lib/navigation/canonical-routes';

<a href={CANONICAL_ROUTES.business}>Business OS</a>
<a href={CANONICAL_ROUTES.businessFunnels}>Lead Funnel Builder</a>
```

**In dynamic routes:**
```typescript
// For routes with parameters, use the helper functions:
import { CANONICAL_ROUTES } from '@/lib/navigation/canonical-routes';

const chapterPath = CANONICAL_ROUTES.programmeChapter(4);  // "/programme/chapter-4"
const lessonPath = CANONICAL_ROUTES.programmeLesson("m-bottleneck");  // "/programme/lesson/m-bottleneck"
```

**Adding new routes:**
1. Define the route in `CANONICAL_ROUTES` (with a descriptive name)
2. Create/update the Next.js page file at the route
3. Replace all hardcoded references to the route with imports from `canonical-routes.ts`
4. Never commit new hardcoded routes — always use the canonical module

---

## Visual Design System

### Cohesive Color Palette

**ONEVYRT uses a unified color system** (`lib/colors/chapter-tokens.ts`) that spans programme chapters, navigation sections, coaching review, and dashboards. Each chapter has a distinct, professional color signaling psychological progression from uncertainty to freedom.

**Chapter Colors** (primary identifiers):
- **START** `#64748b` Slate — baseline, neutral starting point
- **DEFINE** (Ch 1) `#2563eb` Blue — clarity, strategy, definition
- **IMPLEMENT** (Ch 2) `#16a34a` Green — growth, action, building
- **CONTROL** (Ch 3) `#d97706` Amber — focus, measurement, discipline
- **IMPROVE & SCALE** (Ch 4) `#dc2626` Red — momentum, optimization, action
- **FINISH** (Ch 5) `#0891b2` Cyan — mastery, completion, forward motion

**Navigation Section Colors** (`NAV_COLORS`):
- Home: `#0891b2` Cyan — command center, control
- Programme: `#2563eb` Blue — learning, structured path
- My Business: `#16a34a` Green — operations, execution
- Coaching: `#d97706` Amber — mentorship, guidance
- Resources: `#8b5cf6` Violet — knowledge, community

**Status Colors** (consistent across coaching & dashboards):
- Awaiting review: `#2563eb` Blue
- Approved: `#16a34a` Green
- Changes requested: `#d97706` Amber
- Rejected: `#dc2626` Red

**Soft Variants** (tinted backgrounds, badges):
- Each chapter/status color has a corresponding "soft" variant for backgrounds (e.g., `#eff6ff` for DEFINE's light background)

**Dark Variants** (hover states, darker overlays):
- Each chapter/status color has a corresponding "dark" variant for focus states and contrast

**Accessibility:**
All colors pass WCAG AA contrast on white/light backgrounds (min 4.8:1). Soft variants are designed to work with dark text overlays. The palette is theme-aware (works in both light and dark modes via CSS custom properties).

**Usage:**
- Import from `lib/colors/chapter-tokens.ts`: `CHAPTER_COLORS`, `STATUS_COLORS`, `NAV_COLORS`
- Use helpers: `getChapterColor()`, `getChapterColorSoft()`, `getChapterColorDark()`
- Components: ProgrammeJourney (chapter journey), UnifiedNav (section nav), ChapterSubmissionReview (coaching), GrowthImprovementPlan (dashboard)

---

## Programme Structure (Updated)

### Curriculum Flow

```
START: Personal & Business Baseline
    ↓
CHAPTER 1 — DEFINE (Business + Customer + Psychology)
    Learn: Market positioning, customer avatar, value ladder
    Build: Business Psychology Blueprint
    Gate: Coach approval required
    ↓
CHAPTER 2 — IMPLEMENT (Turn strategy into working system)
    Learn: Sales funnel, operations, team structure
    Build: Working Business System (processes, tools, roles)
    Gate: Coach approval required
    ↓
CHAPTER 3 — CONTROL (Know the numbers and what's happening)
    Learn: Key metrics, dashboards, financial health
    Build: Numbers & Control Dashboard (revenue, margins, conversions)
    Gate: Coach approval required
    ↓
CHAPTER 4 — IMPROVE & SCALE (Improve what works, remove what doesn't)
    Identify the bottleneck → improve conversion → improve profit → systemise
    Learn: Constraint theory, funnel optimisation, automation
    Subchapters (canonical engine lesson ids in parens — see @onevyrt/engine
    curriculum-chapters.ts's "chapter-4" stage):
      4.1 Find the Bottleneck — single biggest constraint (m-bottleneck)
      4.2 Improve Conversion — leads → appointments → sales (m-improve-conversion)
      4.3 Improve Profit — pricing, margins, costs, customer value (m-improve-profit)
      4.4 Systemise & Automate — repetitive work → process/automation/delegation (m-systemise-automate)
      4.5 Build the Growth Plan — 90-day improvement roadmap (m-growth-plan)
    (An optional 4.6 "Team & Capacity", for businesses with staff, is scoped in
    docs/IMPLEMENTATION_ROADMAP.md but not part of this delivery — the 5
    subchapters above are the complete, shipped chapter.)
    Build: Growth & Improvement Plan (current position → bottleneck → actions → 90-day impact)
    Gate: Coach approval required — unlocks Finish, same mechanism as chapters 1-3
    ↓
FINISH: Transformation Report + 90-Day Plan
    Show: Where you started → what you defined → what you built → what you can measure → what you'll improve → next 90 days
    "What You Will Improve" + "Your Next 90 Days" are compiled from Chapter 4's
    approved Growth & Improvement Plan automatically (lib/reports/transformation-report.ts)
    Output: PDF + shareable link + email delivery
```

Chapter 4 is wired through the SAME generic mechanism the other chapters already use — no parallel state machine:
- **Engine:** `chapter-4` is a real stage in `CANONICAL_STAGES`/`CANONICAL_LESSON_LAYOUT`
  (`packages/engine/src/curriculum-chapters.ts`, `CURRICULUM_SCHEMA_VERSION` 4), with its
  5 modules authored in `curriculum-content.ts`. `chapterGates()` (chapter-gates.ts)
  therefore locks it until Chapter 3 is approved, and locks Finish until IT is approved —
  no special-casing anywhere else in the app.
- **Learner UI:** `/programme/chapter-4` (intro + chapter-submit gate) and
  `/programme/chapter-4/[subchapterId]` (4.1–4.5, reusing `LessonGuide` for the
  actual assignment/submit mechanics, plus `lib/chapter-4`'s richer subchapter
  teaching content: key points, learning objectives, action items).
- **Coach review:** the existing "Chapter approvals" tab in `ProgrammeCentre`
  (`/studio?panel=programme`) — no new coach UI needed.
- **Structured artifact:** `lib/chapter4-submissions.ts` + `/api/programme/chapter/4/*`
  hold the Growth & Improvement Plan's structured data (current position, bottleneck,
  actions, impact) for `components/programme/GrowthImprovementPlan.tsx` and
  `/programme/chapter-4/growth-plan`; the generic chapter-level submit/review
  (`/api/programme/chapters/chapter-4/submit|review`) is what actually advances
  `chapterGates()`, and best-effort syncs the structured record's status too.
- **Migration:** `apps/web/migrations/1788372500000_curriculum-chapter-4-arc.js`
  (v4) — purely additive; existing learner progress on modules 1-20 is untouched.

### Permanent Artifacts

| Chapter | Artifact | Purpose |
|---------|----------|---------|
| Start | Personal & Business Baseline | Benchmark current state |
| 1 | Business Psychology Blueprint | Strategy north star |
| 2 | Working Business System | Operations playbook |
| 3 | Numbers & Control Dashboard | Real-time business metrics |
| 4 | Growth & Improvement Plan | Next 90-day priorities |
| Finish | Transformation Report + 90-Day Plan | Journey summary + forward plan |

---

## Critical Files Map

### Core Libraries
- `lib/auth.ts` — Session verification, `currentUser()`
- `lib/workspaces.ts` — Workspace CRUD, `listForUser()`
- `lib/enrollments.ts` — Enrollment state machine wrapper
- `lib/cohorts.ts` — Cohort management, session reminders
- `lib/jobs.ts` — Scheduled job registry, daily tick
- `lib/notifications.ts` — Notification creation + deduplication
- `lib/rate-limit.ts` — Sliding window rate limiter
- `lib/store.ts` — Project/funnel storage, soft-delete

### Acquisition OS
- `lib/acquisition/leads.ts` — Lead capture, soft-delete
- `lib/acquisition/otp.ts` — One-time code verification (email/SMS), 7-day retention
- `lib/acquisition/funnel-events.ts` — Event logging, daily rollup

### Community & Coaching
- `lib/community/authors.ts` — Author profile (templates + creatives published)
- `lib/community/moderation.ts` — Approve/reject shared items
- `lib/coach/digest-run.ts` — Weekly "who's quiet" digest to coaches
- `lib/coach/messages.ts` — Coach-to-learner messages

### Chapter 4 — IMPROVE & SCALE
- `lib/chapter-4/` — Subchapter teaching content (4.1–4.5), keyed by engine moduleId
- `lib/chapter4-submissions.ts` — Structured Growth & Improvement Plan storage (`chapter_4_submissions`)
- `lib/growth-plan-utils.ts` — Formats a `Chapter4Submission` into the `GrowthPlan` view-model
- `lib/reports/transformation-report.ts` — Compiles the Finish-stage Transformation Report, including "What You Will Improve" from Chapter 4
- `app/programme/chapter-4/page.tsx` + `[subchapterId]/page.tsx` — Chapter intro + subchapter learning pages
- `app/programme/chapter-4/growth-plan/page.tsx` — The permanent Growth & Improvement Plan artifact view

### API Routes
- `app/api/account/export/route.ts` — GDPR data export (all workspaces + user scope)
- `app/api/cron/tick/route.ts` — Job orchestration (called by external cron)
- `app/api/stripe/webhooks/route.ts` — Stripe event handlers

### Dashboard — Why & Creed (Motivational North Star)
**Purpose:** Every user sees their personal "Why" (purpose) and "Creed" (business commitment) on every dashboard login. Creates emotional energy and keeps users connected to their deeper purpose.

**Components & Files:**
- `components/dashboard/WhyAndCreedSection.tsx` (340 lines) — Three-state component
  - **Empty:** "Why Are You Here?" prompt with CTA button
  - **Filled:** Gradient card (blue→purple→pink) with animated background + pulsing energy indicators
  - **Edit:** Clean form with two textareas, save/cancel buttons, live preview
- `lib/dashboard/why-creed.ts` — Core functions
  - `getWhyAndCreed(workspaceId)` — Fetch user's why/creed (null if none)
  - `saveWhyAndCreed(workspaceId, why, creed)` — Save/update with advisory lock for concurrency
  - `deleteWhyAndCreed(workspaceId)` — Soft delete (sets deleted_at timestamp)
- `app/api/workspace/[id]/why-creed/route.ts` — Workspace-scoped API (GET/POST)
- `app/api/command-center/why-creed/route.ts` — Wrapper route (auto-resolves user's workspace)
- `app/command-center/page.tsx` — Integrated at top of dashboard (high visibility)
- `apps/web/migrations/1788419200000_add-why-creed-table.js` — Creates `workspace_why_creed` table

**Integration Pattern:**
```tsx
// Import component
import { WhyAndCreedSection } from "@/components/dashboard/WhyAndCreedSection";

// Fetch why/creed data
useEffect(() => {
  fetch("/api/command-center/why-creed", { credentials: "include" })
    .then(r => r.json())
    .then(d => setWhyCreedData(d));
}, []);

// Render at top of dashboard
<WhyAndCreedSection
  workspaceId={workspaceId}
  data={whyCreedData}
  onUpdate={setWhyCreedData}
/>
```

**Design Details:**
- Gradient: blue (#2563eb) → purple (#a855f7) → pink (#ec4899)
- Typography: 2xl-3xl bold for why, lg-xl semibold for creed (mobile responsive)
- Animations: Pulsing energy dots, subtle hover scale (max-scale: 102%)
- Dark mode: Full support with WCAG AA contrast compliance
- Accessibility: ARIA labels, keyboard navigation, focus indicators
- Mobile: Responsive at 375px, 768px, 1024px+ breakpoints

**Features:**
- ✅ Soft-delete (preserves user data, recoverable)
- ✅ Advisory lock concurrency (prevents race conditions)
- ✅ Workspace isolation (verified via listForUser)
- ✅ Auto-save on form submit
- ✅ Edit button appears on hover
- ✅ Large, prominent display (not easy to ignore)
- ✅ Empty state CTA to get started
- ✅ Motivational copy: "Feeling the energy? Let's build."

**Database:**
```sql
CREATE TABLE workspace_why_creed (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  why text NOT NULL DEFAULT '',
  creed text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  UNIQUE(workspace_id)
);
```

**Documentation:**
- `docs/WHY_CREED_INTEGRATION.md` — Comprehensive integration guide (500+ lines)
  - User experience flows
  - Component API reference
  - Customization options (colors, animations, fonts)
  - Troubleshooting & performance notes
  - Accessibility compliance details

---

## Icon System (Wave 1 Complete)

Comprehensive icon system built with Heroicons (24px solid) providing visual richness, semantic meaning, and UI clarity across ONEVYRT. All icon components are TypeScript-typed, accessible, and organized into four semantic categories.

### Architecture
- **Icons:** `components/icons/` — ChapterIcon, StatusIcon, ActionIcon, IconButton, IconSizer
- **Registry:** `lib/icons/icon-registry.ts` — Complete icon catalog, colors, semantic meanings
- **Styles:** `app/design-system.css` — Icon sizing scales, chapter colors, status indicators
- **Docs:** `docs/ICON-SYSTEM.md` — Complete reference, usage patterns, integration examples

### Icon Categories

**Chapter Icons** — Programme stage visual identifiers:
- `define` (cyan, clarity) → Business Psychology Blueprint
- `implement` (purple, confidence) → Working Business System
- `control` (pink, control) → Numbers & Control Dashboard
- `improve` (amber, momentum) → Growth & Improvement Plan
- `finish` (emerald, freedom) → Transformation Report

Each chapter's icon color matches its psychological state and applies to chapter cards, journey maps, and coaching dashboards.

**Status Icons** — Progress and state indicators:
- `locked` (grey) — Prerequisites not met
- `available` (primary) — Ready to start
- `inProgress` (amber) — Currently working
- `completed` (emerald) — Finished
- `awaitingReview` (amber) — Submitted, awaiting coach
- `approved` (emerald) — Coach approved
- `rejected` (red) — Needs revision
- `skipped` (grey) — Not applicable

**Action Icons** — UI control operations:
- `add`, `edit`, `delete`, `download`, `share`, `print`, `save`, `close`, `back`, `forward`, `search`, `filter`, `more`

Each action has semantic coloring (e.g., delete is red, save is green).

### Usage & Integration

**Import & render:**
```typescript
import { ChapterIcon, StatusIcon, ActionButton } from "@/components/icons";

// Chapter icon with background
<ChapterIcon chapter="define" size="lg" withBackground />

// Status indicator
<StatusIcon status="completed" size="sm" />

// Action button
<ActionButton action="edit" onClick={handleEdit} />
```

**Icon sizing:** xs (16px) → sm (20px) → md (24px) → lg (32px), controlled via `size` prop or `IconSizer` utility.

**Colors:** All icons use CSS custom properties (`--ds-chapter-1`, `--ds-success`, etc.) for dark mode support.

### Key Files
- `components/icons/ChapterIcon.tsx` — Chapter stage icons + ChapterLabel, ChapterBadge components
- `components/icons/StatusIcon.tsx` — Progress indicators + StatusBadge component
- `components/icons/ActionIcon.tsx` — UI control icons + ActionButton component
- `components/icons/IconButton.tsx` — Reusable icon button wrapper for custom icons
- `components/icons/IconSizer.tsx` — Sizing utility for consistent icon scaling
- `components/icons/IconSystemShowcase.tsx` — Visual reference & testing component (not for production)
- `lib/icons/icon-registry.ts` — Icon catalog, color mappings, state/status helpers
- `docs/ICON-SYSTEM.md` — Complete reference manual with examples

---

## Phase 2.5 — Dashboard Evolution & Engagement

### Overview
Phase 2.5 bridges Chapter 4 completion and the 90-day checkpoint lifecycle. It introduces persistent dashboard outputs, learner lifecycle engagement, and the foundation for automated course renewals.

**Goals:**
- Surface 90-day checkpoint scheduling → learner action → coach assignment → results tracking
- Persist learner outcomes across programme completion
- Build email & SMS engagement flows (pre-built templates)
- Enable admin bulk operations (enroll, assign cohorts, send announcements)

**Status:** Design phase complete; implementation underway Q4 2026.

### Dashboard Hierarchy (Four-Tier Architecture)

```
TIER 1: Command Center (Entry Point)
  └─ Why & Creed (motivational north star)
  └─ Transformation Report snapshot
  └─ Next Checkpoint countdown timer
  └─ Favourite recent projects (funnel, campaign, business OS)

TIER 2: Module Dashboards (Feature-Scoped)
  ├─ Programme Centre (chapter progress + coaching pending)
  ├─ My Business (reality + constraint + execution roadmap)
  ├─ Studio (funnel canvas + campaign manager)
  └─ Community (swipe file + shared creatives)

TIER 3: Artifact Dashboards (Output-Focused)
  ├─ Numbers & Control Dashboard (Ch 3 metrics)
  ├─ Growth & Improvement Plan (Ch 4 roadmap)
  ├─ Transformation Report (journey summary)
  └─ 90-Day Checkpoint (repeating stage post-FINISH)

TIER 4: Admin Dashboard (Coach/System)
  ├─ Learner Roster (enrollment, cohort assignment, bulk actions)
  ├─ Coaching Workbench (pending reviews, approvals, comments)
  ├─ Curriculum Editor (module content, stage gates)
  ├─ Analytics Hub (cohort metrics, engagement, revenue)
  └─ Announcement Broadcast (email/SMS templates, scheduling)
```

### Dashboard State Management

**Per-workspace singleton state:**
```typescript
interface DashboardState {
  commandCenter: {
    pinnedProjects: string[];      // Funnel/campaign IDs, max 5
    recentlyViewed: TimelineItem[];  // Last 10 items across all modules
    whyAndCreed: WhyCreedData | null;
    nextCheckpointDate?: Date;     // Calculated from Ch4 approval + 90 days
  };
  notifications: {
    unreadCount: number;
    lastSeenAt: timestamp;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    emailFrequency: 'daily' | 'weekly' | 'none';
    analyticsConsent: boolean;
  };
  lastModified: timestamp;
}
```

**Fetch pattern:**
- Cached in `localStorage` per workspace (5 min TTL)
- Server-of-truth in PostgreSQL (`workspace_dashboard_state` table)
- Soft-sync on every page load (non-blocking)

### Dashboard Components & Files

**Command Center (`/command-center`):**
- `app/command-center/page.tsx` — Layout (four-section grid)
- `components/dashboard/CommandCenterGrid.tsx` — Responsive grid + pinning logic
- `components/dashboard/WhyAndCreedSection.tsx` — Motivational north star (existing)
- `components/dashboard/TransformationReportSnapshot.tsx` — Latest report preview + link
- `components/dashboard/NextCheckpointCard.tsx` — Countdown + CTA ("Schedule checkpoint")
- `components/dashboard/FavouriteProjectsPanel.tsx` — Pinned funnel/campaign/business cards

**Recent Items Timeline:**
- `components/dashboard/RecentItemsTimeline.tsx` — Chronological list with icons
- `lib/dashboard/recent-items.ts` — Fetches last N items across projects/lessons/submissions
- `app/api/command-center/recent-items/route.ts` — GET endpoint, cached response

**Dashboard Analytics (`/command-center/analytics`):**
- `components/dashboard/DashboardAnalytics.tsx` — Overview charts (chapters, time-to-approval)
- `lib/dashboard/analytics.ts` — Query builders for metrics (avg chapter time, completion rate)
- `app/api/command-center/analytics/route.ts` — Workspace-scoped analytics (read-only)

---

## Phase 3 — Learner Lifecycle & Automation

### Overview
Phase 3 operationalizes the 90-day checkpoint, builds email/SMS engagement workflows, and enables coaches to scale through admin bulk operations.

**Goals:**
- Automate 90-day checkpoint enrollment → learner email → coach assignment
- Pre-built email/SMS templates for every lifecycle stage
- Admin: bulk enroll, assign to cohorts, send announcements
- Analytics: engagement tracking, cohort performance, revenue attribution

**Status:** Specification phase; engineering kickoff Q1 2027.

### Email Flow Diagram

```
USER JOURNEY → EMAIL TRIGGERS

[START] User Enrolls
  ↓
  → Email: Welcome, "Let's define your business"
  → SMS: [Optional] Quick checklist link
  → Delay: 2 days
  
[CH 1 SUBMITTED] Chapter 1 Submitted
  ↓
  → Coach: Notification "Review pending: [Name]"
  → Learner: "Your coach is reviewing... check back soon"
  ↓ [Coach Approves]
  → Email: "Approved! Ready for Chapter 2?"
  → CTA: "Go to Chapter 2"
  ↓ [Coach Requests Changes]
  → Email: "Changes requested: [Coach note excerpt]"
  → CTA: "View feedback"

[CH 4 COMPLETED & APPROVED] Transformation Report Ready
  ↓
  → Email: "Congratulations! Your 90-day plan is ready"
  → CTA: "View report" + "Share link"
  ↓ [Learner Views Report] [Auto-trigger]
  → Delay: 7 days
  → Email: "Ready for your next 90 days? Let's schedule a checkpoint call"
  → CTA: "Schedule checkpoint"

[CHECKPOINT SCHEDULED]
  ↓
  → Email: Reminder (3 days before)
  → Email: Follow-up call link (day before)
  ↓ [Checkpoint Completed]
  → Email: "Checkpoint recorded. Your next action plan:"
  → CTA: "View updated plan"
  → Coach: Notification "Checkpoint complete, review improvements"

[COHORT SESSION SCHEDULED] Coach schedules group call
  ↓
  → Email: "Group session coming: [Date, Topic]"
  → SMS: [Optional] Calendar invite
  → Reminder: 24h before, 1h before

[QUARTERLY BROADCAST] Coach sends announcement
  ↓
  → Email: Templated message (coach-customizable)
  → SMS: [Optional] Short version
  → Track: Opens, clicks, unsubscribes
```

**Email Template Types:**
- Welcome & Onboarding (2 templates)
- Chapter Submission (Approved, Changes Requested, Rejected) — 3 templates
- Checkpoint Lifecycle (Scheduled, Reminder, Completion) — 3 templates
- Cohort & Group Events (Session scheduled, reminder) — 2 templates
- Engagement & Broadcast (Weekly tips, announcement) — 2 templates
- Administrative (Account changes, export ready, deletion confirmation) — 3 templates

### 90-Day Checkpoint Flow

```
[FINISH STAGE - Ch 4 Approved]
  transformation_report sent + Transformation Report shareable link live
  
  ↓ [Auto-trigger on report send]
  System creates initial "90-Day Checkpoint" record:
    checkpoint_number: 1
    status: "scheduled"
    scheduled_for: NOW + 90 days  (e.g., 2026-12-03T14:00:00Z)
    learner_workspace_id: [uuid]
    coach_user_id: [from cohort assignment]
    
  ↓ [Learner receives email]
  "Ready for your next 90 days?"
  CTA: "Schedule my checkpoint call"
  (Learner can reschedule by up to ±14 days)
  
  ↓ [Checkpoint date arrives ±3 days]
  System sends reminder emails
  Coach receives: "Upcoming checkpoint: [Learner name]"
  
  ↓ [Checkpoint date -1 day]
  Learner receives: Meeting link + prep worksheet
  Coach receives: Learner's latest metrics summary
  
  ↓ [Coach completes checkpoint]
  POST /api/checkpoints/[checkpointId]/complete
    checkpoint_updates: {
      key_improvements: [array of improvements since last checkpoint],
      next_priorities: [array of next 90-day focus areas],
      bottleneck_shift: string (optional "constraint has shifted to..."),
      revenue_impact: string (optional "projected $X increase"),
      mood_score: 1-5 (learner sentiment)
    }
    notes: string (private coach notes)
    
  ↓ [Auto-create next checkpoint]
  System creates checkpoint_2 (90 days from now)
  Learner email: "Your checkpoint is recorded. New 90-day plan below:"
  CTA: "View updated plan" + "Schedule next checkpoint"
  
  ↓ [Repeat every 90 days]
  Checkpoint history visible in learner dashboard
  Coach dashboard: Checkpoint metrics over time (trend)
  Admin analytics: Cohort checkpoint completion rate
```

**Database Schema:**
```sql
CREATE TABLE checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  coach_user_id uuid NOT NULL REFERENCES users(id),
  checkpoint_number int NOT NULL,  -- 1, 2, 3, ...
  status varchar NOT NULL DEFAULT 'scheduled',  -- scheduled|completed|skipped|rescheduled
  scheduled_for timestamp NOT NULL,
  completed_at timestamp,
  
  -- Checkpoint data
  checkpoint_data jsonb,  -- { key_improvements, next_priorities, bottleneck_shift, revenue_impact, mood_score, notes }
  
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  
  UNIQUE(workspace_id, checkpoint_number)
);
```

### Admin Controls & Bulk Operations

**Learner Roster (`/admin/learners`):**
- View: Name, email, cohort, chapter progress, checkpoint history
- Actions:
  - **Enroll:** Bulk add worksheets (CSV upload)
    ```csv
    email,cohort_id,chapter_start
    alice@example.com,cohort-1,DEFINE
    bob@example.com,cohort-2,START
    ```
  - **Assign Cohort:** Select learners → dropdown cohort → bulk assign
  - **Send Announcement:** Select learners → template or custom message → email/SMS
  - **Export Data:** GDPR-style learner export (all workspaces user has access to)
  - **Reschedule Checkpoint:** Bulk reschedule cohort's next checkpoint date
  - **Generate Report:** Trigger transformation report rebuild for learner

**API Routes (Admin-Only):**
- `POST /api/admin/learners/bulk-enroll` — CSV parse + create workspaces + enroll
- `POST /api/admin/learners/bulk-assign-cohort` — Update cohort membership
- `POST /api/admin/learners/bulk-send-message` — Queue email/SMS (with template ID)
- `POST /api/admin/checkpoints/bulk-reschedule` — Move checkpoint dates by cohort
- `POST /api/admin/reports/bulk-generate` — Async transform report generation

**Validation & Safety:**
- All operations logged in `activity_log` (action: "admin_bulk_*", user_id, metadata)
- Soft-delete: no permanent deletes via admin UI (only hard-delete job running nightly)
- Rate-limited: 1 bulk operation per 10 seconds per admin user
- Confirmation modal: shows count + sample rows before executing

---

## Webhook Event Types

### Stripe Webhooks (via `/api/stripe/webhooks`)

```typescript
// Webhook Events Handled
type StripeWebhookEvent = 
  | 'charge.succeeded'        // Learner paid, create invoice + send receipt
  | 'charge.failed'           // Payment failed, retry + notify
  | 'payout.paid'             // Qualified lead payout received, log revenue
  | 'customer.updated'        // Billing address changed
  | 'customer.subscription.updated'  // Subscription tier changed
```

### Application Webhooks (Custom)

**Learner Lifecycle:**
- `learner.enrolled` — New workspace created, onboarding starts
- `learner.chapter.submitted` — Lesson/chapter submitted, coach review triggered
- `learner.chapter.approved` — Chapter approved, next stage unlocked
- `learner.finish.triggered` — Transformation report created, share link generated
- `learner.checkpoint.scheduled` — Checkpoint scheduled, reminder queued

**Coaching:**
- `coach.assigned` — Learner assigned to coach cohort
- `coach.submission.pending` — Review waiting for coach action
- `coach.cohort.session.scheduled` — Group call scheduled, attendees notified

**Admin & System:**
- `admin.cohort.created` — New cohort configured
- `admin.template.published` — Community template approved for gallery
- `cron.job.completed` — Daily job tick finished, status reported

**Webhook Delivery Pattern:**
```typescript
// Each webhook payload signed with HMAC-SHA256 + timestamp
interface WebhookPayload {
  id: string;               // Unique event ID
  type: 'learner.enrolled' | 'learner.chapter.submitted' | ...;
  created_at: timestamp;
  data: Record<string, any>;  // Event-specific data
  signature: string;        // HMAC-SHA256(JSON body, secret)
  timestamp: timestamp;     // For replay-attack prevention (max 5 min old)
}
```

**Retry Logic:**
- Exponential backoff: 1s, 10s, 100s, 1000s (4 attempts total)
- Dead-letter queue: Events not delivered after 4 retries logged in `webhook_failures`
- Manual retry: Admin can re-trigger failed webhook from `/admin/webhooks`

---

## Analytics Metrics & Tracking

### Learner Engagement Metrics

**Programme Progress:**
- `avg_time_per_chapter` — Days from start to approval (by chapter)
- `submission_count` — Total lessons + chapters submitted (per workspace)
- `approval_rate` — % of submissions approved on first pass
- `chapter_completion_rate` — % reaching each chapter (DEFINE → IMPLEMENT → CONTROL → IMPROVE → FINISH)
- `time_to_finish` — Total days from enrollment to transformation report

**Checkpoint & Revenue:**
- `checkpoint_completion_rate` — % of scheduled checkpoints completed (by cohort)
- `revenue_per_learner` — Total Stripe charges + payout attribution (by acquisition funnel)
- `cohort_performance` — Cohort-level avg chapter time, approval rate, checkpoint completion
- `churn_risk` — Learners inactive >30 days (email trigger for coach)

**Dashboard Usage:**
- `command_center_visits` — Daily active users, page visits (by date, cohort)
- `feature_adoption` — % of learners using studio, business OS, campaign studio (by chapter)
- `why_creed_completion_rate` — % who filled in personal why/creed
- `shared_template_views` — Community swipe file engagement (views, downloads, ratings)

### Cohort Analytics

**Batch Metrics:**
- Cohort size, avg chapter completion time, approval rate, revenue total
- Churn rate (learners who stopped submitting >60 days)
- Coach-to-learner ratio, engagement trend (daily active %)
- Checkpoint scheduling adherence (% on-time, % rescheduled)

### System Health

**API Monitoring:**
- Response times (p50, p95, p99) by endpoint
- Error rates (5xx, 4xx) by endpoint
- Rate-limit triggers (if >10% of requests throttled, alert)
- Database query times (slow query log >2s)

**Job Monitoring:**
- Cron job success/failure (tick, email send, report generation)
- Webhook delivery success rate (% delivered on first attempt)
- Async job queue depth (if growing, alert)

### Admin Dashboard (`/admin/analytics`)

```
DASHBOARD LAYOUT:
┌─ Learner Metrics
│  ├─ Total enrolled (this quarter)
│  ├─ Avg time to finish
│  ├─ Chapter completion rates (visual: 4-bar chart)
│  └─ Churn risk (n learners inactive >30d, email draft ready)
│
├─ Cohort Performance
│  ├─ Cohort selector dropdown
│  ├─ Learners per cohort, avg approval rate, revenue total
│  └─ Checkpoint completion trend (line chart, last 12 months)
│
├─ Revenue & Attribution
│  ├─ Total revenue (Stripe + pending payouts)
│  ├─ Revenue by funnel (acquisition source)
│  ├─ Revenue per learner (avg)
│  └─ Payout status (scheduled, pending, failed)
│
└─ System Health
   ├─ API health (response time, error rate)
   ├─ Job queue (last tick, next scheduled)
   └─ Alerts (data freshness, failed webhooks, etc.)
```

---

## Deployment Checklist (Phase 3 Readiness)

### Pre-Launch (2 Weeks Before)

- [ ] **Database Migrations**
  - [ ] Run migration script: `apps/web/migrations/*_checkpoint-table.js`
  - [ ] Verify `checkpoints` table created with correct indexes
  - [ ] Verify `workspace_dashboard_state` table created
  - [ ] Back up production database (full snapshot)
  
- [ ] **Environment Configuration**
  - [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (email service)
  - [ ] Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (SMS, if enabled)
  - [ ] Set `ADMIN_USER_IDS` (comma-separated UUIDs with admin role)
  - [ ] Set `CHECKPOINT_EMAIL_SENDER` (e.g., "checkpoint@onevyrt.com")
  - [ ] Set `ANALYTICS_RETENTION_DAYS` (default 90)
  - [ ] Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
  
- [ ] **Email Templates**
  - [ ] Create email templates in template service (SendGrid, Mailgun, etc.)
  - [ ] Test: Welcome, Chapter approved, Checkpoint reminder, Announcement
  - [ ] Verify unsubscribe links work
  - [ ] Verify all links are absolute URLs (no relative paths)
  
- [ ] **Feature Flags**
  - [ ] Enable `FEATURE_DASHBOARD_V2` (command-center)
  - [ ] Enable `FEATURE_CHECKPOINTS` (90-day cycle)
  - [ ] Enable `FEATURE_ADMIN_BULK_ENROLL` (admin controls)
  - [ ] Enable `FEATURE_EMAIL_WORKFLOWS` (automated emails)
  - [ ] Keep disabled for 24h after launch, monitor metrics

- [ ] **Testing**
  - [ ] E2E: Enrollment → Chapter submission → Approval → Checkpoint scheduled
  - [ ] E2E: Admin bulk enroll (CSV) + bulk assign cohort
  - [ ] Email delivery test (send test email to team members)
  - [ ] Stripe test webhook delivery (charge.succeeded)
  - [ ] Database advisory lock test (concurrent checkpoint update)

### Launch Day

- [ ] **Pre-Launch Checks (1 Hour Before)**
  - [ ] Verify all feature flags enabled in production config
  - [ ] Run smoke tests: login, enroll, submit chapter, view dashboard
  - [ ] Verify email service is reachable (SMTP test)
  - [ ] Verify database connection pool healthy (no stuck connections)
  - [ ] Clear CDN cache for `/admin`, `/command-center` routes
  
- [ ] **Canary Deployment (First 5% of Traffic)**
  - [ ] Deploy to 1 Vercel instance (0% traffic)
  - [ ] Run final smoke tests on canary
  - [ ] Wait 15 minutes, check logs for errors
  - [ ] Shift 5% traffic to canary
  - [ ] Monitor: API latency, error rate, database load
  
- [ ] **Full Rollout (Next 30 Minutes)**
  - [ ] Shift traffic incrementally: 25% → 50% → 100%
  - [ ] Wait 5 min between each shift
  - [ ] Monitor Datadog/Vercel dashboard for anomalies
  - [ ] If error rate >1%, rollback (deploy previous version)

### Post-Launch (First 24 Hours)

- [ ] **Monitoring**
  - [ ] Set up Datadog alerts:
    - [ ] API p95 latency >3s
    - [ ] Error rate >0.5%
    - [ ] Database query time >2s
    - [ ] Job queue depth >100
    - [ ] Email delivery failure rate >5%
  
  - [ ] Set up PagerDuty escalation for critical alerts
  - [ ] Assign oncall engineer for first 48h
  
- [ ] **Learner Communication**
  - [ ] Send in-app announcement: "New dashboard & 90-day checkpoints rolling out"
  - [ ] Coach communication: "Here's how to use the new checkpoint flow"
  - [ ] Post in community Slack: "Feature launch feedback welcome"
  
- [ ] **Analytics Kickoff**
  - [ ] Baseline current metrics (Datadog export)
  - [ ] Create dashboard: Real-time feature adoption % + email delivery rate
  - [ ] Set up daily digest: Checkpoint scheduling rate, any bottlenecks
  
- [ ] **Issue Triage**
  - [ ] Monitor support channel for bugs
  - [ ] Create tickets for high-priority issues
  - [ ] Priority 1: Data loss or payment failures (rollback immediately)
  - [ ] Priority 2: Email not delivering (investigate + hotfix)
  - [ ] Priority 3: UI bugs or slow performance (backlog for post-launch)

### Rollback Procedure (If Critical Issues Found)

```bash
# 1. Immediate: revert to previous version
git revert <commit-hash>
git push origin main

# 2. Vercel auto-deploys on push (5 min)
# Monitor: https://vercel.com/dashboard

# 3. Verify rollback:
curl https://onevyrt.masteryresearch.com/api/health

# 4. Notify team
# Slack: #engineering → "Rolled back to commit [hash] due to [issue]"

# 5. Post-mortem (next day)
# Document: What failed, why, how to prevent next time
```

---

## Dashboard Section (Expanded)

### Command Center — Entry Point for All Users

**Purpose:** First screen after login; unified launchpad for all programme, business, and community work.

**Components (Expanded from Phase 2.5):**

1. **Why & Creed Motivational North Star** (existing, see above)
   - Gradient card (blue→purple→pink)
   - Edit button on hover
   - Soft-delete safe

2. **Transformation Report Snapshot** (new)
   - Card showing "Transformation Report ready" or "Awaiting chapter X approval"
   - If ready: large CTA "View your report" + share icon
   - If not ready: progress bar (chapters 1-4 completion %)
   - Link to full report at `/account/transformation-report`

3. **Next Checkpoint Countdown** (new)
   - Large, prominent countdown timer
   - "Your next 90-day checkpoint is in [X days]"
   - CTA: "Schedule call" (if within 14 days)
   - Recurring automatically every 90 days post-FINISH

4. **Recent Items Timeline** (new)
   - Chronological list: "You submitted Chapter 2 on [date]"
   - "Coach approved your lesson on [date]"
   - "Checkpoint scheduled for [date]"
   - Shows last 10 items across all modules (lessons, chapters, checkpoints)
   - Link to each item for quick access

5. **Favourite Projects Panel** (new)
   - Pin up to 5 funnels/campaigns/business modules
   - Drag-to-reorder
   - Quick-access cards: "Open Studio", "View Funnel", "Edit Campaign"
   - Last-viewed timestamp on each

6. **Notifications Badge** (new)
   - Unread count (red dot)
   - Quick preview: "3 pending coach messages"
   - Dropdown: List of recent notifications
   - Link to full notification center (future)

7. **Quick Actions Toolbar** (new)
   - Sticky header bar with frequently-used actions:
     - [+ New Funnel] [+ New Campaign] [Message Coach] [View Programme] [Schedule Checkpoint]

### Command Center Layout

```
┌──────────────────────────────────────────────────────────┐
│  ONEVYRT / Command Center  [Theme toggle] [Account]      │
├──────────────────────────────────────────────────────────┤
│ QUICK ACTIONS: [+ Funnel] [+ Campaign] [Message Coach]  │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Why & Creed (motivational north star)              │  │
│  │ [Gradient card] "Your purpose drives your business"│  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │ Transformation       │  │ Next Checkpoint         │  │
│  │ Report Ready ✓       │  │ in 45 days              │  │
│  │ [View] [Share] [PDF] │  │ [Schedule Call]         │  │
│  └──────────────────────┘  └──────────────────────────┘  │
│                                                            │
│  ┌───────────────────────────────────────────────────┐   │
│  │ Recent Activity Timeline                          │   │
│  │ ─ You submitted Chapter 2 on Sep 1                │   │
│  │ ─ Coach approved on Aug 28                        │   │
│  │ ─ Checkpoint scheduled for Dec 3                 │   │
│  └───────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Favourite Projects ────────────────────────────┐     │
│  │ [Funnel: Main Sales] [Campaign: Holiday Email]  │     │
│  │ [Business: Roadmap]                             │     │
│  └─────────────────────────────────────────────────┘     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Dashboard Persistence & Performance

**State Sync Strategy:**
- Workspace dashboard state cached in `localStorage` (5 min TTL)
- Server state in PostgreSQL table: `workspace_dashboard_state`
- Every page navigation: soft-sync state (non-blocking)
- Save operations (e.g., pin project): immediate → server → local cache

**Performance Targets:**
- Command center page load: <1.5s (LCP)
- Timeline rendering: <200ms for 50 items
- Pinning/reordering: instant (optimistic update)
- Checkpoint countdown: client-side countdown (no server polling)

**Accessibility:**
- All cards keyboard-navigable (Tab → Enter to open)
- Focus indicators on all interactive elements
- ARIA labels: "Checkpoint countdown timer showing 45 days"
- Color not sole indicator of status (icon + text pairs)

---



### Security (Wave 2/6 planned)
- ❌ CSRF token protection not implemented
- ❌ Rate limiting not hardened per IP+user
- ❌ Scope isolation audit needed (query-level checks)

### Data & Compliance (Wave 4 planned)
- ❌ Community author-scoped queries missing (outbound comments/reactions on others' items)
- ❌ Audit logging incomplete (who changed workspace settings?)
- ❌ PII encryption at rest not standardized
- ❌ Data retention policies not fully documented

### Testing (Wave 5 planned)
- ❌ E2E test coverage for auth flow, funnel checkout, cohort notifications, account deletion
- ❌ Unit tests for lib/jobs.ts, lib/cohorts.ts, lib/coach/digest-run.ts, lib/acquisition/*
- ❌ TypeScript noImplicitAny audit needed

### Product (Wave 3 planned)
- ❌ Programme UX not optimised (mind-map curriculum view needed)
- ❌ My Business dashboard missing persistent outputs + scenario builder
- ✅ Coaching submission review UX built (`ProgrammeCentre`'s "Coach review" tab — lesson + chapter approvals, Chapter 4 included)
- ❌ Community moderation dashboard not built
- ✅ Transformation Report generated + delivered (`/account/transformation-report`, shareable link, email) — now includes Chapter 4's "What You Will Improve" automatically
- ❌ Growth & Improvement Plan sharing is placeholder-only (`/programme/chapter-4/growth-plan`'s Share button is disabled, "coming soon" — the Transformation Report's own share link is the one real share path today)
- ❌ Rate limiting still missing on most `/api/programme/lessons/*` and cohort mutation routes (chapter-level submit/review now has it; lesson-level and a few others don't)

---

## Next Logical Task

**Chapter 4 (IMPROVE & SCALE) is complete and integrated** — see "Programme Structure" above. Remaining Chapter 4 follow-ups (not blockers): rate limiting on the lesson-level submit/review routes, and a real share/PDF path for the Growth & Improvement Plan artifact itself (today only the Transformation Report has a working share link).

**Current north star:** `docs/PLATFORM_SPECIFICATION.md` — a full 18-section,
7-phase specification (canonical programme, 7 Forces diagnostic, business
foundation workspace, Beautiful State, Thinking Time, offer builder,
10×10×10 calculator, five profit drivers, customer/Raving Fans system, the
full financial operating system, Money Machine, execution & accountability,
experiments, reports, coach/admin, notifications, technical-foundation
hardening). This supersedes the old 6-wave/33-recommendation plan below it
was recorded 2026-09-03 and is realistically 6–12+ months of work — treat it
as the reference, not a to-do list to execute unprompted.

**`docs/IMPLEMENTATION_ROADMAP.md` tracks real, verified status against that
spec** (what actually passes `tsc`/build/lint/migrations today, what's still
open) and should be read before trusting any "deployed"/"complete" claim
elsewhere in this repo's docs — several such claims (e.g. a prior "901/901
tests passing") did not survive verification: the test runner had been
silently skipping ~94% of the suite (fixed 2026-09-03) and lint had been
crashing outright rather than gating (also fixed). Update
IMPLEMENTATION_ROADMAP.md's "Verified Current State" section only from a
command you actually ran, not from intent.

**Before starting new work against the specification, confirm sequencing
with the user** — see IMPLEMENTATION_ROADMAP.md's "Next decision" section.

---

## Performance Optimization Strategy

### Bundle Size Analysis & Optimization

**Largest Components (candidates for lazy loading):**
- `ProgramCentre.tsx` — 1657 lines (coach/learner interface)
- `ProgrammeCentre.tsx` — 908 lines (chapter approval interface)
- `FunnelCanvasBuilder.tsx` — 721 lines (canvas editor)
- `FunnelTemplateGallery.tsx` — 678 lines (template browser)
- `DropoffAnalysis.tsx` — 674 lines (analytics visualization)
- `FunnelCalculator.tsx` — 625 lines (interactive calculator)
- `QualificationWizard.tsx` — 647 lines (multi-step form)

**Target Savings: 150–250 KB** through code splitting and lazy loading.

### Implemented Optimizations (Wave 1)

#### 1. Route-Based Code Splitting
- **File:** `components/lazy-studio.tsx`
- **Pattern:** Dynamic imports with loading fallback for route-specific components
- **Benefit:** Large components only load when their route is accessed
- **Implementation:**
  ```typescript
  import { LazyProgramCentre } from '@/components/lazy-studio';
  
  export default function StudioPage() {
    return <LazyProgramCentre />;
  }
  ```

#### 2. Webpack Configuration Optimization
- **File:** `next.config.ts`
- **Changes:**
  - Aggressive tree-shaking: `usedExports: true`, `sideEffects: false`
  - Vendor code splitting: React/Next.js into separate chunk
  - Heavy dependencies split: jsPDF, @xyflow into `libs-heavy` chunk
  - Commons chunk for shared code across routes
  - Optimized package imports for auto tree-shaking of @heroicons/react, jspdf, @xyflow/react

#### 3. Image Optimization
- **File:** `next.config.ts`
- **Settings:**
  - Modern formats: WebP and AVIF preferred (40-50% smaller than JPEG)
  - Device-aware sizing: 16–3840px responsive breakpoints
  - Aggressive caching: 1 year TTL for versioned assets
  - `minimumCacheTTL: 31536000` for long-term caching

#### 4. Performance Monitoring Utilities
- **File:** `lib/performance.ts`
- **Features:**
  - Web Vitals tracking (LCP, FID, CLS, FCP, TTFB)
  - Intersection Observer helpers for lazy loading
  - Image optimization configuration
  - Responsive srcset generator
  - On-demand heavy library loading (PDF, charts)
  - Bundle analyzer config

### Next Steps (Wave 2)

#### A. Tailwind CSS Purging
- [ ] Ensure unused Tailwind classes are removed in production
- [ ] Custom config: only include used utilities
- [ ] Consider: extracting critical styles above-the-fold

#### B. Font Optimization
- [ ] Subset fonts to specific Unicode ranges
- [ ] Use `font-display: swap` for faster text rendering
- [ ] Consider: preload critical fonts (`<link rel="preload">`)

#### C. Database Query Optimization
- [ ] Profile slow queries in production logs
- [ ] Add database indexes for frequently filtered columns
- [ ] Consider: implement query caching for enrollment reads

#### D. Advanced Code Splitting
- [ ] Route-based prefetching for navigation
- [ ] Implement service worker caching strategy
- [ ] Consider: differential loading (ES modules vs legacy bundles)

#### E. API & Data Optimization
- [ ] Implement response pagination for large data sets
- [ ] Add compression middleware (gzip/brotli)
- [ ] Consider: GraphQL or tRPC for efficient data fetching

### Monitoring & Measurement

**Web Vitals Targets (Google Core Web Vitals):**
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

**Bundle Size Targets:**
- Initial JS: < 100 KB (gzipped)
- Per-route chunks: < 50 KB (gzipped)
- Third-party: < 50 KB (gzipped)

### Usage Guidelines

#### Lazy Loading a Component
```typescript
// Option 1: Using lazy-studio exports (recommended)
import { LazyProgramCentre } from '@/components/lazy-studio';
export default () => <LazyProgramCentre />;

// Option 2: Direct dynamic import
import dynamic from 'next/dynamic';
const MyComponent = dynamic(() => import('./MyComponent'), {
  loading: () => <div>Loading...</div>,
  ssr: false, // For interactive-only components
});

// Option 3: Responsive image loading
import Image from 'next/image';
<Image 
  src="/path/to/image.jpg" 
  alt="Description"
  priority={false} // Lazy load by default
  sizes="(max-width: 768px) 100vw, 50vw"
  quality={75}
/>
```

#### Measuring Performance
```bash
# Build with bundle analysis
ANALYZE=true pnpm build

# Run Lighthouse audit
npm install -g lighthouse
lighthouse https://onevyrt.masteryresearch.com --view
```

### Files Modified
- `next.config.ts` — Webpack config, image optimization
- `lib/performance.ts` — Performance utilities (new)
- `components/lazy-studio.tsx` — Lazy component exports (new)
- `apps/web/package.json` — May need to add web-vitals dependency

### Performance Budgets
- Keep initial bundle < 100 KB (gzipped)
- Lazy chunk sizes < 50 KB each (gzipped)
- Route transition latency < 200ms
- API response times < 500ms (p95)
