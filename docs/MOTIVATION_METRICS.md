# Motivation Metrics & Engagement Tracking

Comprehensive engagement tracking system for why/creed features, reflections, and email interactions. Used to calculate cohort health scores and identify learners needing outreach.

## Overview

The motivation metrics system tracks engagement across:
- **Why & Creed**: Views and edits to personal purpose/commitment statements
- **Reflections**: 90-day reflection checkpoint completions
- **Email Engagement**: Send/open/click tracking for motivation emails
- **Health Scoring**: Composite engagement score (0-100) for individuals and cohorts

## Key Tables

### `motivation_engagement_events`
Audit trail of all engagement actions. Every interaction creates an event record.

**Fields:**
- `id` — Unique event identifier
- `workspace_id` — Workspace context
- `user_id` — User performing the action (optional for system events)
- `user_email` — Email for tracking across accounts
- `event_type` — Type of engagement (see Event Types below)
- `metadata` — JSON for event-specific data
- `created_at` — Timestamp of the event

**Event Types:**
- `why_creed_viewed` — User viewed their why/creed on dashboard
- `why_creed_edited` — User edited their why/creed statement
- `reflection_started` — User began a 90-day reflection
- `reflection_completed` — User completed a reflection
- `email_sent` — Motivation email dispatched
- `email_opened` — Email opened by recipient
- `email_clicked` — Email link clicked
- `reminder_dismissed` — User dismissed a reminder banner

### `engagement_metrics`
Materialized summary of engagement over a time period. Refreshed daily via job tick.

**Fields:**
- `workspace_id`, `user_id` — Context
- `period_start_date`, `period_end_date` — Measurement window
- `why_creed_view_count`, `why_creed_edit_count` — Why/Creed interactions
- `reflections_completed` — Number of reflections finished
- `emails_sent`, `emails_opened`, `emails_clicked` — Email metrics
- `email_open_rate`, `email_click_rate` — Calculated rates (0-1)
- `engagement_score` — Composite score (0-100)

### `cohort_engagement_summary`
Denormalized cohort-level health snapshot. One row per cohort per day.

**Fields:**
- `cohort_id` — The cohort
- `total_learners`, `active_learners_count` — Population counts
- `avg_engagement_score`, `median_engagement_score` — Aggregate scores
- `high_engagement_count`, `low_engagement_count` — Score distribution
- `why_creed_completion_rate`, `reflection_completion_rate`, `email_engagement_rate` — Completion rates
- `summary_date` — When this snapshot was created

## API Reference

### Logging Engagement

#### `logEngagementEvent(workspaceId, eventType, userId?, userEmail?, metadata?)`

Log a single engagement event.

```typescript
import { logEngagementEvent } from "@/lib/dashboard/motivation-metrics";

// User viewed why/creed
await logEngagementEvent(
  workspaceId,
  "why_creed_viewed",
  userId,
  userEmail,
  { section: "command-center", duration_ms: 2500 }
);

// Reflection completed
await logEngagementEvent(
  workspaceId,
  "reflection_completed",
  userId,
  userEmail,
  { reflection_type: "90-day", module_id: "m-growth-plan" }
);

// Email opened (from Twilio/SendGrid webhook)
await logEngagementEvent(
  workspaceId,
  "email_opened",
  undefined,
  recipientEmail,
  { template: "remember_why", message_id: "twilio_msg_123" }
);
```

#### `logBatchEngagementEvents(events)`

Log multiple events at once (e.g., when processing email webhooks).

```typescript
await logBatchEngagementEvents([
  {
    workspaceId: "ws1",
    eventType: "email_opened",
    userEmail: "user@example.com",
    metadata: { template: "ninety_days" },
  },
  {
    workspaceId: "ws2",
    eventType: "email_clicked",
    userEmail: "user2@example.com",
    metadata: { template: "creed_in_action", link: "/business/execution" },
  },
]);
```

### Querying Engagement

#### `getEngagementMetrics(workspaceId, startDate, endDate, userId?)`

Get engagement metrics for a workspace (or single user) over a date range.

```typescript
import { getEngagementMetrics } from "@/lib/dashboard/motivation-metrics";

// Get all learners' engagement for last 30 days
const metrics = await getEngagementMetrics(
  workspaceId,
  "2026-08-04",
  "2026-09-03"
);

// Result: Array of EngagementMetrics
metrics.forEach((m) => {
  console.log(`${m.userEmail}: score=${m.engagementScore}, views=${m.whyCreedViewCount}`);
});

// Get single learner
const [singleMetric] = await getEngagementMetrics(
  workspaceId,
  "2026-08-04",
  "2026-09-03",
  userId
);
```

#### `getCohortHealthScore(cohortId, startDate, endDate)`

Get aggregate health snapshot for a cohort.

```typescript
import { getCohortHealthScore } from "@/lib/dashboard/motivation-metrics";

const health = await getCohortHealthScore(
  cohortId,
  "2026-08-04",
  "2026-09-03"
);

console.log(`Cohort: ${health.totalLearners} learners`);
console.log(`Active: ${health.activeLearnersPercent}%`);
console.log(`Avg engagement: ${health.avgEngagementScore}/100`);
console.log(`High engagement: ${health.highEngagementCount}`);
console.log(`Low engagement: ${health.lowEngagementCount}`);
```

#### `getCohortEngagementReport(cohortId, limit?)`

Get per-learner engagement summary for all cohort members.

```typescript
const report = await getCohortEngagementReport(cohortId);

// Returns array of EngagementMetrics, one per learner
report
  .sort((a, b) => a.engagementScore - b.engagementScore)
  .forEach((m) => {
    console.log(`${m.userEmail}: ${m.engagementScore}/100`);
  });
```

#### `getLowEngagementLearners(cohortId, scoreThreshold?, days?)`

Identify learners needing outreach (low engagement).

```typescript
import { getLowEngagementLearners } from "@/lib/dashboard/motivation-metrics";

// Find learners with engagement < 40 in last 14 days
const atRisk = await getLowEngagementLearners(cohortId, 40, 14);

atRisk.forEach((m) => {
  console.log(
    `${m.userEmail}: score=${m.engagementScore} — send outreach email`
  );
});
```

## Engagement Score Formula

Composite score (0-100) calculated as:

- **Why/Creed Views** (30 points max): 5 points per view, capped at 30
- **Why/Creed Edits** (20 points): Full 20 if any edits, else 0
- **Reflections** (25 points): Each reflection = 25 points (capped at 25)
- **Email Opens** (15 points): Open rate × 15
- **Email Clicks** (10 points): Click rate × 10

**Score Interpretation:**
- `75-100` — Highly engaged (active, consistent interaction)
- `40-74` — Moderately engaged (some activity, room for growth)
- `0-39` — Low engagement (minimal or no recent activity)

## Integration Patterns

### 1. Dashboard Page Load (Log View)

In `components/dashboard/WhyAndCreedSection.tsx` or similar:

```typescript
import { logEngagementEvent } from "@/lib/dashboard/motivation-metrics";

useEffect(() => {
  // Log that user viewed the why/creed section
  logEngagementEvent(
    workspaceId,
    "why_creed_viewed",
    userId,
    userEmail
  ).catch(console.error);
}, [workspaceId, userId, userEmail]);
```

### 2. Form Submit (Log Edit)

In why/creed edit form:

```typescript
async function handleSave() {
  // Save the form...
  await saveWhyAndCreed(workspaceId, why, creed);

  // Log the engagement event
  await logEngagementEvent(workspaceId, "why_creed_edited", userId, userEmail, {
    why_length: why.length,
    creed_length: creed.length,
  });
}
```

### 3. Email Webhook (Log Open/Click)

In `app/api/webhooks/email/route.ts` or similar:

```typescript
import { logBatchEngagementEvents } from "@/lib/dashboard/motivation-metrics";

export async function POST(req: Request) {
  const events = await req.json();

  const engagementEvents = events.map((e: any) => ({
    workspaceId: e.workspace_id,
    eventType: e.type === "open" ? "email_opened" : "email_clicked",
    userEmail: e.recipient,
    metadata: { template: e.template_id, message_id: e.message_id },
  }));

  await logBatchEngagementEvents(engagementEvents);
  return new Response("OK");
}
```

### 4. Coaching Dashboard (Display Health)

In `/coaching` page component:

```typescript
import {
  getCohortHealthScore,
  getCohortEngagementReport,
} from "@/lib/dashboard/motivation-metrics";

const health = await getCohortHealthScore(cohortId, startDate, endDate);
const report = await getCohortEngagementReport(cohortId);

// Display in UI:
// - Overall health gauge (avg engagement score)
// - Active learner % 
// - Low-engagement list (sorted by score)
// - Email engagement rate
// - Why/Creed completion rate
```

### 5. Daily Job Tick (Refresh Metrics)

In `lib/jobs.ts` or similar scheduled task:

```typescript
import { getEngagementMetrics } from "@/lib/dashboard/motivation-metrics";

async function dailyMetricsRefresh() {
  const workspaces = await getAllWorkspaces();

  for (const ws of workspaces) {
    const yesterday = getYesterdayDateString();
    const metrics = await getEngagementMetrics(
      ws.id,
      yesterday,
      yesterday
    );

    // Cache in engagement_metrics table for fast queries
    for (const m of metrics) {
      await insertEngagementMetricsSnapshot(m);
    }
  }
}
```

## Performance Notes

- **Events table**: Can grow rapidly (100s-1000s per day per workspace). Implement retention policy (e.g., keep 90 days).
- **Metrics table**: Much smaller, indexed on workspace/period for fast queries.
- **Cohort summary**: One row per cohort per day — very fast queries for dashboards.
- **Batch logging**: Use `logBatchEngagementEvents()` for email webhooks to reduce DB round-trips.

## Future Enhancements

- Real-time dashboard updates via WebSocket
- Learner engagement trends (week-over-week comparison)
- Predictive churn scoring (ML-based low-engagement prediction)
- Automated coach alerts ("3+ learners below 30 this week")
- Engagement export for external BI/analytics
