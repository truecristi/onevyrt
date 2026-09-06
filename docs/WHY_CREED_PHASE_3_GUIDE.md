# Why & Creed Phase 3: Reflection History, Motivation Emails & Analytics

## Overview

Phase 3 extends the Why & Creed feature with:

1. **Reflection History** — 90-day checkpoint tracking with sentiment analysis
2. **Motivation Emails** — Personalized reminders for stalled users based on their why/creed
3. **Email Preferences** — User opt-in/opt-out controls with fine-grained frequency settings
4. **Motivation Analytics** — Daily engagement metrics (views, edits, shares, sentiment)
5. **Admin Controls** — Coach visibility into user motivation levels and email activity

Each feature integrates seamlessly with Phase 1 (UI) and Phase 2 (Dashboard Integration), creating a complete motivation & re-engagement system for stalled learners.

---

## Phase 3 Architecture

### Database Schema Additions

Three new tables + extended columns on `workspace_why_creed`:

**1. reflection_history**
```sql
CREATE TABLE reflection_history (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  reflection_cycle INTEGER NOT NULL,          -- 0, 1, 2, 3...
  snapshot_why TEXT NOT NULL,                  -- Why value at reflection time
  snapshot_creed TEXT NOT NULL,                -- Creed value at reflection time
  reflection_notes TEXT,                       -- User notes (optional)
  sentiment VARCHAR(20) NOT NULL,              -- 'very_negative' to 'very_positive'
  progress_rating INTEGER,                     -- 1-10 self-assessment
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP                        -- Soft-delete
);
```

**2. email_preferences**
```sql
CREATE TABLE email_preferences (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id),
  reflection_reminders BOOLEAN DEFAULT true,   -- 90-day checkpoint emails
  motivation_digest BOOLEAN DEFAULT true,      -- Weekly motivation emails
  coaching_updates BOOLEAN DEFAULT true,       -- Coaching notifications
  programme_milestones BOOLEAN DEFAULT true,   -- Chapter completion emails
  digest_frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'biweekly', 'monthly'
  unsubscribe_all BOOLEAN DEFAULT false,       -- Master opt-out
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

**3. motivation_analytics**
```sql
CREATE TABLE motivation_analytics (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  metric_date DATE NOT NULL,                   -- Aggregated daily
  why_creed_views INTEGER DEFAULT 0,           -- Dashboard opens
  why_edits INTEGER DEFAULT 0,                 -- Edits to why field
  creed_edits INTEGER DEFAULT 0,               -- Edits to creed field
  shares_via_email INTEGER DEFAULT 0,          -- Shared via email
  reflection_entries INTEGER DEFAULT 0,        -- Reflections created
  avg_sentiment NUMERIC(2,1),                  -- 1.0-5.0
  engagement_score NUMERIC(4,2) DEFAULT 0,    -- 0-100 computed score
  created_at TIMESTAMP NOT NULL
);
```

**4. workspace_why_creed (Extended)**
```sql
-- New columns added to existing table:
ALTER TABLE workspace_why_creed ADD COLUMN (
  last_reflected_at TIMESTAMP,                 -- Most recent reflection checkpoint
  reflection_count INTEGER DEFAULT 0,          -- Cumulative reflections
  streak_days INTEGER DEFAULT 0                -- Consecutive weeks of reflection (0-52)
);
```

---

## Phase 3 Features

### 1. Reflection History & Checkpoints

**Purpose:** Track user progress over 90-day cycles, capturing sentiment and self-assessment at key intervals.

**Reflection Cycles:**
- Cycle 0: Initial (when why/creed first created)
- Cycle 1: ~Day 30 checkpoint
- Cycle 2: ~Day 60 checkpoint
- Cycle 3: ~Day 90 checkpoint
- Cycle 4+: Continued tracking (e.g., 6-month, 1-year)

**User Flow:**
1. User sets their why/creed (Phase 1)
2. Dashboard shows "Reflection Checkpoint" card at ~30-day intervals
3. User clicks "Record Reflection" → modal opens with:
   - Read-only current why/creed snapshot
   - Free-text notes field ("What's changed? Lessons learned?")
   - Sentiment picker (5-star: very negative → very positive)
   - Progress rating (1-10: "How's progress on your why/creed goals?")
4. On submit → creates reflection_history record + updates workspace_why_creed.last_reflected_at & streak_days

**API Endpoint:**
```
POST /api/command-center/reflection/create
Body:
{
  "reflection_notes": "We've tripled our lead volume...",
  "sentiment": "positive",
  "progress_rating": 8
}

Response:
{
  "success": true,
  "reflection": {
    "id": "uuid",
    "cycle": 1,
    "created_at": "2026-03-15T10:30:00Z",
    "snapshot_why": "...",
    "snapshot_creed": "..."
  }
}
```

---

### 2. Motivation Emails (Stalled User Re-engagement)

**Purpose:** Send personalized, non-intrusive emails to remind stalled users of their why/creed, encouraging them to re-engage.

**Trigger Logic:**

Users are identified as "stalled" if:
- Profile age > 3 days (established users only)
- No activity > 7 days (last_activity_at < NOW() - 7 days), OR
- Stuck on same chapter > 14 days (chapter_updated_at < NOW() - 14 days)
- Why/creed both set (why != '' AND creed != '')
- Not opted out of emails

**Stall Detection Configuration** (in `/api/cron/why-creed-reminders`):
```typescript
const STALL_DETECTION = {
  NO_ACTIVITY_DAYS: 7,        // 7+ days of no activity
  SAME_CHAPTER_DAYS: 14,      // Stuck on chapter 14+ days
  MIN_PROFILE_AGE_DAYS: 3,    // Don't email users < 3 days old
  MAX_EMAILS_PER_MONTH: 4,    // Never send > 4 emails per month to same user
};
```

**Email Templates:**

#### Template 1: "Remember Your Why" (Default)
- **Trigger:** User stalled 7-30 days
- **Purpose:** Reconnect to deeper purpose
- **Content:**
  - Greeting with user's name
  - Opening: "We noticed you've been quiet..."
  - Highlighted card: User's actual why
  - Secondary text: Why this matters (north star, alignment)
  - Highlighted card: User's actual creed
  - Reflection box: "Take 5 minutes to sit with these..."
  - CTA: "Back to Your Dashboard"
  - Footer: Unsubscribe link

**Example HTML Output:**
```
Subject: "[Name], remember why you started"
From: noreply@onevyrt.com

[Gradient header: Blue to Purple]
Remember Your Why
It's time to reconnect with your purpose

Hi [Name],

We noticed you've been quiet lately. That's natural—building a business is
a marathon, not a sprint. But we want to remind you of something important:
the reason you started.

[Blue card with left border]
YOUR WHY
[User's actual why text]

This is your north star. When progress feels slow or obstacles pile up,
this is the energy that keeps you moving forward...

[Purple gradient card]
YOUR CREED
[User's actual creed text]

[Amber box]
Today's reflection: Take 5 minutes to sit with these two statements.
What's one small action you can take this week that brings you closer
to your why and honors your creed?

[Blue button] Back to Your Dashboard
[Link: ${dashboardUrl}]
```

#### Template 2: "90 Days Is a Milestone"
- **Trigger:** User stalled 90+ days
- **Purpose:** Time-based reflection on progress
- **Content:**
  - Opening: "It's been 90 days since you've actively worked..."
  - Alert box: Time urgency framing
  - Why/creed cards (read-only)
  - Reflection questions (3x):
    - "What's one thing that's improved in your business?"
    - "Are your recent actions aligned with your why and creed?"
    - "What's the ONE thing you need to do in the next 90 days?"
  - CTA: "Log Back In & Check Progress"

**Template 3: "Your Creed in Action"**
- **Trigger:** Optional, triggered by milestone completion (e.g., revenue growth detected)
- **Purpose:** Show tangible progress aligned with commitment
- **Content:**
  - Creed card (read-only)
  - Metrics grid (if available):
    - Current Revenue: `$${amount}`
    - Growth: `+${percent}%`
    - Conversion Rate: `${percent}%`
    - Active Leads: `${count}`
  - Achievement callout: "Your creed isn't just words..."
  - CTA: "See Your Full Dashboard"

**Email Sending Configuration:**

Located in `/api/cron/why-creed-reminders`:

```typescript
const EMAIL_RATE_LIMIT = {
  EMAILS_PER_MINUTE: 50,      // Avoid SMTP throttling
  BATCH_DELAY_MS: 1200,       // 60000 / 50 = 1.2s per email
};
```

**Cron Job Endpoint:**
```
POST /api/cron/why-creed-reminders
Authorization: Bearer ${CRON_SECRET}

Response:
{
  "success": true,
  "message": "Sent 142 motivation emails in 3245ms",
  "result": {
    "timestamp": "2026-03-15T08:00:00Z",
    "total_users_checked": 2847,
    "stalled_users_found": 156,
    "emails_sent": 142,
    "emails_failed": 3,
    "opted_out_skipped": 11,
    "deduped_skipped": 0,
    "errors": ["user@example.com: SMTP timeout"],
    "duration_ms": 3245
  }
}
```

**Job Scheduling:**
- Frequency: Daily (morning, e.g., 8 AM UTC)
- Duration: ~5-10 minutes (typical 150-300 sends at 50/min rate)
- Rate: 50 emails/minute (configurable)
- Deduplication: One email per template per workspace per day (via dedupeKey)

**Deduplication Key Format:**
```
why_creed_email:${workspaceId}:${templateType}:${date}

Example:
why_creed_email:550e8400-e29b-41d4-a716-446655440000:remember_why:2026-03-15
```

---

### 3. Email Preferences UI & API

**Purpose:** Give users granular control over email frequency and type.

**User Interface:**

Located in `/account?tab=email-preferences`:

```
┌─────────────────────────────────────────────┐
│ EMAIL PREFERENCES                           │
└─────────────────────────────────────────────┘

□ 90-Day Reflection Reminders
  "We'll remind you when it's time to record a reflection checkpoint"

□ Weekly Motivation Digest
  "Personal motivation emails based on your why & creed"
  Frequency: [Daily / Weekly (default) / Biweekly / Monthly]

□ Coaching Updates
  "Notifications from your coach (approvals, feedback)"

□ Programme Milestones
  "Chapter completions, progression announcements"

┌─────────────────────────────────────────────┐
│ [X] Unsubscribe from All Emails             │
│     (except critical account notifications) │
└─────────────────────────────────────────────┘

[Save Preferences] [Cancel]

Footer:
"One-click unsubscribe links in every email. Change anytime."
```

**API Endpoints:**

**GET /api/account/email-preferences**
```typescript
Response:
{
  "opted_out_all": false,
  "opted_out_from": [],
  "reflection_reminders": true,
  "motivation_digest": true,
  "coaching_updates": true,
  "programme_milestones": true,
  "digest_frequency": "weekly",
  "updated_at": "2026-03-10T14:22:00Z",
  "email": "user@example.com"
}
```

**PATCH /api/account/email-preferences**
```typescript
Request body:
{
  "reflection_reminders": true,
  "motivation_digest": false,
  "coaching_updates": true,
  "programme_milestones": true,
  "digest_frequency": "monthly",
  "unsubscribe_all": false
}

Response:
{
  "success": true,
  "message": "Email preferences updated",
  "updated": {
    "reflection_reminders": true,
    "motivation_digest": false,
    "digest_frequency": "monthly",
    "unsubscribe_all": false
  }
}
```

**POST /api/account/email-preferences/unsubscribe?token=${token}**

One-click unsubscribe from email footer link:
```
<!-- In every email footer: -->
<a href="${APP_URL}/api/account/email-preferences/unsubscribe?token=${signedToken}">
  Unsubscribe from all emails
</a>
```

Token format: Signed JWT containing:
```typescript
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1710415200,  // Issued at
  "exp": 1713093600   // Expires in 30 days
}
```

On success:
```
{
  "success": true,
  "message": "You have been unsubscribed from all emails",
  "redirectTo": "/account?tab=email-preferences&unsubscribed=true"
}
```

---

### 4. Motivation Analytics Dashboard

**Purpose:** Coaches see real-time engagement metrics. Learners see their own analytics.

**Metrics Tracked (Daily Aggregation):**

| Metric | Source | Purpose |
|--------|--------|---------|
| `why_creed_views` | Dashboard open event | Activity level |
| `why_edits` | Form submit event | Commitment refinement |
| `creed_edits` | Form submit event | Value evolution |
| `shares_via_email` | Email send event | Social/external sharing |
| `reflection_entries` | Reflection history creation | Checkpoint engagement |
| `avg_sentiment` | Reflection history sentiment field | Emotional health |
| `engagement_score` | Computed from above metrics (0-100) | Overall health |

**Engagement Score Calculation:**
```typescript
function calculateEngagementScore(metrics: DailyMetrics): number {
  // Weighted scoring (0-100)
  const views_weight = metrics.why_creed_views * 5;        // Max 5 points
  const edits_weight = Math.min(metrics.why_edits + metrics.creed_edits, 5) * 5; // Max 5
  const shares_weight = Math.min(metrics.shares_via_email, 2) * 10; // Max 10
  const reflection_weight = metrics.reflection_entries > 0 ? 25 : 0; // 25 for reflection
  const sentiment_weight = (metrics.avg_sentiment || 3) / 5 * 50; // Max 50

  return Math.round(
    (views_weight + edits_weight + shares_weight + reflection_weight + sentiment_weight) / 7
  );
}
```

**Admin Dashboard (Coach View):**

Location: `/coaching` tab "Motivation Analytics"

```
┌─────────────────────────────────────────────────────┐
│ LEARNER MOTIVATION OVERVIEW                         │
└─────────────────────────────────────────────────────┘

[Filter: Last 30 days / 90 days / Custom]

Top 10 Most Engaged
┌─────────────────────────────────────────────────────┐
│ Name          │ Score │ Last Active │ Status        │
├─────────────────────────────────────────────────────┤
│ Jane Doe      │ 87    │ Today       │ ✓ Thriving    │
│ John Smith    │ 61    │ 3d ago      │ ⚠ Stalled     │
│ Alice Brown   │ 45    │ 14d ago     │ 🔴 Inactive   │
└─────────────────────────────────────────────────────┘

Bottom 10 (At-Risk)
[List of low-engagement learners with last activity timestamp]

Email Activity
• Sent this month: 342
• Opened (estimated): ~156 (45.6%)
• Bounced: 3
• Unsubscribed: 2
```

**Learner Personal Analytics:**

Location: `/account?tab=motivation-analytics`

```
┌─────────────────────────────────────────────────────┐
│ YOUR MOTIVATION ENERGY                              │
└─────────────────────────────────────────────────────┘

Overall Engagement Score: 76 / 100

Last 30 Days Activity
├─ Why/Creed Views: 18
├─ Why Edits: 2
├─ Creed Edits: 1
├─ Reflections: 1 (30 days ago)
└─ Sentiment Trend: ↗ Positive

Chart: 30-day engagement trend (sparkline)

Reflection History
┌─────────────────────────────────────────────────────┐
│ Cycle 0: Initial (3 weeks ago)                      │
│ Sentiment: Very Positive | Rating: 9/10            │
│                                                     │
│ Cycle 1: 30-Day Checkpoint (pending)                │
│ ↳ Record reflection to continue [Button]           │
└─────────────────────────────────────────────────────┘
```

---

### 5. Admin Controls & Reporting

**Coaches (via /coaching panel):**

1. **Stall Detection & Intervention**
   - List of users > 7 days without activity
   - Manual email send option (immediate, not subject to cron schedule)
   - Export CSV of engagement metrics

2. **Email Activity Logs**
   - View which reminders were sent to which users
   - Filter by: template type, date range, status (sent/failed/bounced)
   - Retry failed sends

3. **Bulk Preference Updates**
   - Enable/disable motivation reminders for entire cohort
   - Adjust digest frequency (e.g., "switch all to weekly")

**Sample Admin Route:**
```
GET /api/admin/motivation/stalled-users
  ?days=7
  &cohort_id=optional
  &limit=100

Response:
{
  "total": 42,
  "stalled_users": [
    {
      "workspace_id": "...",
      "user_email": "...",
      "user_name": "...",
      "last_activity_at": "2026-03-08T00:00:00Z",
      "days_stalled": 7,
      "why": "...",
      "creed": "...",
      "has_emails_sent": 1,
      "opted_out": false
    },
    ...
  ]
}
```

---

## Email Templates

### Template Library

All templates live in `/lib/emails/why-creed-templates.ts` and export:

```typescript
export function rememberYourWhyTemplate(context: WhyCreedEmailContext): EmailTemplate;
export function ninetydaysSinceTemplate(context: WhyCreedEmailContext): EmailTemplate;
export function creedInActionTemplate(context: WhyCreedEmailContext): EmailTemplate;
export function customEmailTemplate(options: CustomEmailTemplateOptions): EmailTemplate;
```

Each returns:
```typescript
{
  subject: string;          // Email subject line
  htmlBody: string;         // Full HTML (inline styles)
  plainTextBody: string;    // Fallback plain text
  previewText: string;      // Email client preview (first ~50 chars)
}
```

### Template Best Practices

1. **Personalization:** Always use `${userName}`, `${why}`, `${creed}` to embed actual user data
2. **Escaping:** All user data goes through `escapeHtml()` to prevent injection
3. **Links:** Use absolute URLs (e.g., `https://onevyrt.masteryresearch.com/...`)
4. **Unsubscribe:** Include `${unsubscribeUrl}` in footer
5. **Colors:** Use chapter color palette (blue, green, amber, red, purple)
6. **Responsive:** Set `max-width: 600px` on container, test on mobile

### Creating Custom Templates

Use the `customEmailTemplate()` helper for one-off emails:

```typescript
import { customEmailTemplate } from '@/lib/emails/why-creed-templates';

const template = customEmailTemplate({
  subject: "Special Milestone: You've Completed Chapter 2!",
  heading: "Transformation in Progress",
  subheading: "You're officially halfway there",
  accentColor: "green",
  userName: user.name,
  mainContent: `
    <p>Your dedication is showing results. You've completed the IMPLEMENT chapter
    and built your Working Business System—that's significant progress.</p>
    <p>Next: Move into CONTROL to build your Numbers & Control Dashboard.</p>
  `,
  ctaLabel: "See Your Progress",
  ctaUrl: "https://onevyrt.masteryresearch.com/programme",
});
```

---

## Webhook Events

Phase 3 integrates with the existing notification system, dispatching events for:

| Event | Trigger | Payload |
|-------|---------|---------|
| `why_creed.reminder_sent` | Email sent to user | workspace_id, template_type, user_email |
| `why_creed.reflection_created` | User records reflection | workspace_id, reflection_cycle, sentiment |
| `why_creed.stalled_detected` | User identified as stalled | workspace_id, days_stalled, last_activity_at |
| `email.bounced` | Hard bounce from ISP | user_email, bounce_type |
| `email.opted_out` | User unsubscribed | workspace_id, unsubscribe_type |

**Example Webhook Payload (why_creed.reminder_sent):**
```json
{
  "event": "why_creed.reminder_sent",
  "timestamp": "2026-03-15T08:15:22Z",
  "data": {
    "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_email": "jane@example.com",
    "template_type": "remember_why",
    "dedupe_key": "why_creed_email:550e8400...:remember_why:2026-03-15",
    "message_id": "2026031508152200@onevyrt.com",
    "status": "sent"
  }
}
```

**Webhook Subscriptions:**

Configured via `/api/webhooks/subscribe`:
```typescript
{
  "event_types": ["why_creed.reminder_sent", "why_creed.reflection_created"],
  "url": "https://your-domain.com/webhooks/onevyrt",
  "secret": "whsec_xxxxxxxxxxxx" // For signature verification
}
```

---

## User Preferences & Privacy

### GDPR Compliance

**Data Collected:**
- Reflection history (snapshots, sentiment, notes)
- Email preferences & send history
- Engagement metrics (aggregated daily)
- Bounce events

**User Rights:**
- **Access:** View all reflections, email history, analytics via dashboard
- **Rectification:** Edit reflections (updates `updated_at`, preserves history)
- **Erasure:** Request deletion → soft-delete via `deleted_at`
- **Portability:** Export reflections + analytics as JSON/CSV

**Data Retention:**
- Reflection history: 7 years (regulatory requirement for financial planning data)
- Email history: 2 years (audit log)
- Analytics: 90 days (rolling window)
- Soft-deleted records: 30 days (configurable per org)

### Email List Management

**Subscription List Hygiene:**
- Hard bounces → auto opt-out (`opted_out_all = true`)
- Soft bounces → retry 3x over 3 days, then manual review
- Complaints (spam flag) → auto opt-out + alert coach
- ISP throttling → rate limit to 30 emails/min (temporary)

**Monthly Reporting:**
- Deliverability metrics (sent, opened, bounced, unsubscribed)
- Engagement by template type
- Cohort-level trends

---

## Troubleshooting

### Email Issues

**Problem: Emails not sending**

Check:
1. SMTP credentials in `.env`
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=noreply@onevyrt.com
   SMTP_PASS=****
   ```

2. CRON_SECRET configured and cron job running
   ```
   curl -X POST http://localhost:3000/api/cron/why-creed-reminders \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```

3. Query `/api/cron/why-creed-reminders?secret=${CRON_SECRET}` for health check
   ```json
   {
     "status": "ready",
     "smtp_configured": true,
     "stall_detection": {...},
     "email_rate_limit": {...}
   }
   ```

4. Check logs: `/var/log/onevyrt/cron.log`

**Problem: High bounce rate**

1. Verify email list integrity: `SELECT COUNT(*) FROM users WHERE email LIKE '%@%'`
2. Check for typos in domain: `SELECT DISTINCT(SUBSTR(email, POSITION('@' IN email) + 1)) FROM users ORDER BY COUNT(*) DESC`
3. Review ISP feedback loop data (Gmail Postmaster Tools, Outlook SNDS)

**Problem: Templates rendering incorrectly**

1. Test email in browser: Email clients strip some CSS
   - Use inline styles (no `<style>` tags)
   - Test in Email on Acid or Litmus
   - Fallback: always include plain text version

2. Verify personalization:
   - Check `escapeHtml()` is applied to all user data
   - Test with special characters: `"O'Brien's Café & Co."`

### Analytics Issues

**Problem: Engagement score always 0**

Check:
1. Metrics being recorded: `SELECT COUNT(*) FROM motivation_analytics WHERE engagement_score > 0`
2. Dashboard events firing: Check browser console for errors
3. Indices are present: `SELECT * FROM pg_indexes WHERE tablename = 'motivation_analytics'`

**Problem: Missing sentiment data**

1. Verify reflection form is working: `SELECT COUNT(*) FROM reflection_history WHERE sentiment IS NOT NULL`
2. Check form submission: Look for network errors in DevTools
3. User may have skipped sentiment field → default to 'neutral'

### Preference Issues

**Problem: User says they opted out but still receiving emails**

1. Check if `opted_out_all = true`:
   ```sql
   SELECT * FROM email_preferences WHERE workspace_id = $1;
   ```

2. Check individual preferences (may have opted out of only certain types):
   ```sql
   SELECT reflection_reminders, motivation_digest, coaching_updates
   FROM email_preferences WHERE workspace_id = $1;
   ```

3. Verify cron job is checking preferences before sending:
   ```typescript
   if (user.has_opted_out) {
     jobResult.opted_out_skipped++;
     continue;  // Skip this user
   }
   ```

**Problem: User can't change preferences**

1. Verify auth middleware is working: `/api/account/email-preferences` should require valid session
2. Check database write permissions: `INSERT INTO email_preferences (...) VALUES (...)`
3. Verify form is submitting to correct endpoint: `PATCH /api/account/email-preferences`

---

## Migration Guide

### Step 1: Database Migration

Run the Phase 3 migration to add tables and columns:

```bash
# In apps/web directory:
npm run migrate:up

# This runs: apps/web/migrations/1788500000000_why-creed-phase-3-tables.js
```

**What it creates:**
- `reflection_history` table
- `email_preferences` table
- `motivation_analytics` table
- New columns on `workspace_why_creed`: `last_reflected_at`, `reflection_count`, `streak_days`
- Indices for performance

**Verify migration:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%reflection%';

-- Check indices
SELECT indexname FROM pg_indexes WHERE tablename = 'reflection_history';

-- Check workspace_why_creed columns
SELECT column_name FROM information_schema.columns WHERE table_name = 'workspace_why_creed';
```

### Step 2: Environment Configuration

Add to `.env.local`:

```bash
# Email reminders
CRON_SECRET="your-long-random-secret-key-here"  # Generate: openssl rand -hex 32
SMTP_HOST="smtp.gmail.com"                       # Your mail provider
SMTP_PORT="587"
SMTP_USER="noreply@onevyrt.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@onevyrt.com"
NEXT_PUBLIC_APP_URL="https://onevyrt.masteryresearch.com"

# Analytics
MOTIVATION_ANALYTICS_ENABLED="true"

# Feature flags
REFLECTION_HISTORY_ENABLED="true"
EMAIL_PREFERENCES_ENABLED="true"
```

### Step 3: Deploy API Routes

Verify these routes are deployed:

```
✓ /api/cron/why-creed-reminders              [POST] Cron job
✓ /api/cron/why-creed-reminders              [GET]  Health check
✓ /api/account/email-preferences             [GET]  Fetch preferences
✓ /api/account/email-preferences             [PATCH] Update preferences
✓ /api/account/email-preferences/unsubscribe [POST] One-click unsubscribe
✓ /api/command-center/reflection/create      [POST] Save reflection (stub)
✓ /api/admin/motivation/stalled-users        [GET]  Coach view (stub)
```

### Step 4: Wire Up Cron Job

Set up external cron service to call endpoint daily:

**Option A: GitHub Actions (Free)**

Create `.github/workflows/why-creed-reminders.yml`:
```yaml
name: Why & Creed Daily Reminders

on:
  schedule:
    - cron: '0 8 * * *'  # Every day at 8 AM UTC

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reminder job
        run: |
          curl -X POST \
            https://onevyrt.masteryresearch.com/api/cron/why-creed-reminders \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

**Option B: cron.io (Paid, more reliable)**

1. Sign up at cron.io
2. Create job:
   - URL: `https://onevyrt.masteryresearch.com/api/cron/why-creed-reminders`
   - Method: POST
   - Headers: `Authorization: Bearer ${CRON_SECRET}`
   - Schedule: `0 8 * * *` (8 AM UTC daily)
   - Retry: 3 times if fails

### Step 5: Test End-to-End

```bash
# 1. Test database connection
npm run db:test

# 2. Test cron endpoint (health check)
curl -s "http://localhost:3000/api/cron/why-creed-reminders?secret=test" | jq

# 3. Test email preferences API
curl -s -X GET http://localhost:3000/api/account/email-preferences \
  -H "Cookie: session_id=test_session" | jq

# 4. Test reflection creation (stub)
curl -s -X POST http://localhost:3000/api/command-center/reflection/create \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=test_session" \
  -d '{
    "reflection_notes": "Test reflection",
    "sentiment": "positive",
    "progress_rating": 7
  }' | jq

# 5. Check logs
tail -f logs/cron.log
```

### Step 6: Backfill Analytics (Optional)

If existing users have why/creed set, create initial reflection history:

```sql
-- Create Cycle 0 (initial) entries for existing users
INSERT INTO reflection_history (
  workspace_id, reflection_cycle, snapshot_why, snapshot_creed,
  sentiment, created_at, updated_at
)
SELECT
  w.id,
  0,
  wc.why,
  wc.creed,
  'neutral',
  wc.created_at,
  wc.updated_at
FROM workspace_why_creed wc
JOIN workspaces w ON wc.workspace_id = w.id
WHERE wc.deleted_at IS NULL
AND wc.why IS NOT NULL
AND wc.creed IS NOT NULL
ON CONFLICT DO NOTHING;

-- Update workspace_why_creed with backfilled data
UPDATE workspace_why_creed SET reflection_count = 1
WHERE id IN (SELECT DISTINCT workspace_id FROM reflection_history);
```

---

## Deployment Notes

### Pre-Deployment Checklist

- [ ] Database migration tested locally
- [ ] SMTP credentials verified (test send to internal email)
- [ ] CRON_SECRET generated and added to GitHub secrets
- [ ] Cron service configured and scheduled
- [ ] Email templates reviewed by marketing
- [ ] Unsubscribe link tested end-to-end
- [ ] Privacy policy updated to mention email reminders
- [ ] Help center docs written for users
- [ ] Coach dashboards tested
- [ ] Load test: simulate 1000 concurrent email sends

### Staging Deployment (7 days before production)

1. Deploy code to staging
2. Run migrations on staging DB
3. Enable feature flags for QA team
4. Gather team + coaches on staging
5. Test email sends (use staging SMTP or mailhog locally)
6. Verify analytics dashboard accuracy
7. Get stakeholder sign-off

### Production Deployment

**Week Before:**
1. Announce to coaches: "Motivation reminder emails launching this week"
2. Add FAQs to help center
3. Prepare email to users explaining the feature

**Day Of:**
1. Deploy to production (check: no data loss, all routes responding)
2. Run database migrations
3. Enable feature flags
4. Monitor logs: `tail -f /var/log/onevyrt/cron.log | grep why-creed`

**First 24 Hours:**
1. Manually trigger cron job: `curl -X POST ... -H "Authorization: Bearer $SECRET"`
2. Check email history: `SELECT COUNT(*) FROM email_history WHERE created_at > NOW() - INTERVAL '1 day'`
3. Monitor bounce rates: Check SMTP logs for hard bounces
4. Set up alerts: Slack notification if cron job fails

**First Week:**
1. Daily review: email sent count, bounce rate, unsubscribe rate
2. Coach feedback: Are emails reaching users? Any issues?
3. Metrics review: Engagement changes post-launch

### Performance Considerations

**Email Sending Load:**
- Peak: 50 emails/minute = ~3000 emails/hour (manageable)
- SMTP limits: Check provider's concurrency limit (usually 10-50 concurrent)
- Database queries: Stalled user detection query ~2 seconds for 10k users

**Analytics Aggregation:**
- Daily batch job (recommend: run at 2 AM UTC after email sends)
- Updates `motivation_analytics` table with daily metrics
- Typical: 2-10k workspaces, minimal I/O

**Caching Strategy:**
- Cache email preferences in memory (refresh every hour)
- Cache stalled user list during cron execution (valid only during job)
- Don't cache who's-opted-out (must be fresh)

### Monitoring & Alerts

Set up alerts for:

```
1. Cron job failure
   - Alert: Email @ devops if cron job returns 5xx
   - Payload: jobResult.errors list
   - Runbook: Check SMTP config, database connectivity

2. High bounce rate (> 2%)
   - Alert: Slack #email-ops
   - Payload: Domain breakdown, bounce codes
   - Runbook: Check sender reputation, verify email list

3. Unsubscribe spike (> 5% in one day)
   - Alert: Slack #product
   - Payload: Trend graph, user feedback
   - Runbook: Review email content/frequency

4. Analytics lag (no data for 2+ days)
   - Alert: DataDog monitor
   - Payload: Last data timestamp
   - Runbook: Check aggregation job, database write permissions
```

---

## FAQ

**Q: Can I disable emails for a specific cohort?**

A: Yes. Coaches can bulk-update preferences:
```
POST /api/admin/preferences/bulk-update
{
  "cohort_id": "...",
  "unsubscribe_all": true
}
```

**Q: How often will users get emails?**

A: Depends on stall pattern:
- 7-14 days stalled: 1 email that week
- 30+ days stalled: 1 per week (max 4/month)
- 90+ days stalled: 1-2 (milestone + re-engagement)
- Deduplication prevents duplicates same day/type

**Q: What if a user's email bounces?**

A: Hard bounce → auto opt-out. Soft bounce → retry 3x, then manual review.

**Q: Can I customize the email templates?**

A: Yes! Modify HTML in `lib/emails/why-creed-templates.ts`. Change colors, copy, layout. Redeploy.

**Q: Do reflections count as activity for stall detection?**

A: Yes. Recording a reflection resets the stall clock (`last_activity_at = NOW()`).

**Q: How does sentiment data get used?**

A: It feeds motivation analytics dashboard and is exported in cohort reports. Coaches can identify who's struggling emotionally.

**Q: Is there a way to manually send a reminder email?**

A: Yes. Add to `/api/admin/motivation/send-reminder`:
```
POST /api/admin/motivation/send-reminder
{
  "workspace_id": "...",
  "template_type": "remember_why",
  "force": true  // Override deduplication
}
```

---

## References

- Phase 1 (UI): `docs/WHY_CREED_INTEGRATION.md`
- Phase 2 (Dashboard): `docs/WHY_CREED_DASHBOARD.md` (if exists)
- Email templates: `lib/emails/why-creed-templates.ts`
- Cron job: `app/api/cron/why-creed-reminders/route.ts`
- Preferences API: `app/api/account/email-preferences/route.ts`
- Database: `apps/web/migrations/1788500000000_why-creed-phase-3-tables.js`

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Maintained By:** ONEVYRT Product Team  
**Status:** Complete & Ready for Deployment
