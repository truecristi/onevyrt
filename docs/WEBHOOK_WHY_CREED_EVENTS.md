# Why & Creed Business Events Webhook System

## Overview

The Business Events Webhook system captures high-impact moments in a user's business journey and transforms them into motivational "decision moments." These are the critical junctures where action toward their why becomes real.

**Purpose:** Bridge the gap between business metrics and personal motivation by connecting real business wins (payments, milestones, progression) to the user's stated why and creed.

## Event Types

| Event | Trigger | Decision Moment |
|-------|---------|-----------------|
| `payment_processed` | Stripe charge.succeeded | "Your why is being tested. Real money is moving because of your business." |
| `milestone_reached` | 100 leads, 1st sale, $10k revenue | "You've reached [milestone]. This is real progress. Now what?" |
| `level_up` | Chapter completion, stage advancement | "Your understanding has deepened. Ready for the next level?" |
| `daily_action` | User records action (call, post, etc.) | "One step taken toward your why. Consistency compounds." |
| `constraint_improved` | Bottleneck metric moves 5%+ | "You're making the constraint move. Double down." |
| `habit_reset` | User returns after 7+ day stall | "It's been quiet. Your why doesn't achieve itself. Are you still in?" |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Event Source (Stripe, Internal API, Scheduled Job)              │
│ POST /api/webhooks/why-creed-events                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Signature  │ ◄─── WEBHOOK_SECRET_WHY_CREED_EVENTS
                    │ Verification│      + Timestamp validation
                    └──────┬──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Fetch Why/Creed │  │ Generate        │  │ Log Event to    │
│ from DB         │  │ Decision Moment │  │ business_events │
│                 │  │ (Personalized)  │  │ (Deduplicated)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼────────┐
                    │ Create Notifi-   │
                    │ cation + Email   │
                    │ (High Urgency)   │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────┐
                    │ Queue Async Job │
                    │ (job_queue)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────┐
                    │ Cron Tick Processes:    │
                    │ - send_decision_moment  │
                    │ - retry_failed (3x max) │
                    │ - cleanup_stale (7d)    │
                    └─────────────────────────┘
```

## Integration Points

### 1. From Stripe Webhooks

Stripe `charge.succeeded` events trigger payment decision moments:

```typescript
// In your Stripe webhook handler (app/api/stripe/webhooks/route.ts):
import { fetch } from 'node-fetch';

if (event.type === 'charge.succeeded') {
  const charge = event.data.object;

  // POST to decision moments webhook
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');

  await fetch('/api/webhooks/why-creed-events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${signature}`,
      'X-Webhook-Timestamp': new Date().toISOString(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'payment_processed',
      workspaceId: charge.metadata.workspace_id,
      userId: charge.metadata.user_id,
      userEmail: charge.receipt_email,
      timestamp: new Date(charge.created * 1000).toISOString(),
      metadata: {
        amount: charge.amount,
        currency: charge.currency,
        stripeChargeId: charge.id,
      },
    }),
  });
}
```

### 2. From Internal API

Trigger milestone/level-up events from lesson submission, lead capture, or booking:

```typescript
// In your API route (e.g., /api/programme/chapters/submit):
async function triggerMilestoneEvent(
  workspaceId: string,
  userId: string,
  email: string
) {
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');

  await fetch('/api/webhooks/why-creed-events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${signature}`,
      'X-Webhook-Timestamp': new Date().toISOString(),
    },
    body: JSON.stringify({
      type: 'level_up',
      workspaceId,
      userId,
      userEmail: email,
      timestamp: new Date().toISOString(),
      metadata: {
        chapterId: 4,
        lessonId: 'm-bottleneck',
        lessonTitle: 'Find Your Bottleneck',
      },
    }),
  });
}
```

### 3. From Scheduled Jobs

Trigger milestone detection + habit reset in daily cron tick:

```typescript
// In lib/jobs.ts or similar:
async function detectMilestones(): Promise<JobResult> {
  const workspaces = await pgPool().query(`
    SELECT w.id, w.owner_id, u.email, e.enrollment
    FROM workspaces w
    JOIN users u ON u.id = w.owner_id
    JOIN enrollments e ON e.workspace_id = w.id
    WHERE w.deleted_at IS NULL
  `);

  for (const workspace of workspaces.rows) {
    const enrollment = workspace.enrollment;

    // Check if milestone reached (e.g., 100 leads)
    const leadCount = await getLeadCount(workspace.id);
    if (leadCount === 100) {
      await triggerWebhook('milestone_reached', {
        workspaceId: workspace.id,
        userId: workspace.owner_id,
        userEmail: workspace.email,
        metadata: {
          milestoneType: 'leads_milestone',
          milestoneValue: 100,
          currentValue: leadCount,
        },
      });
    }
  }
}
```

## Security

### HMAC-SHA256 Signature

Every webhook request is signed with HMAC-SHA256. The signature is computed as:

```
signature = SHA256(WEBHOOK_SECRET, timestamp + "." + JSON.stringify(body))
```

**Request Headers:**
```
Authorization: Bearer <sha256_hex>
X-Webhook-Timestamp: 2026-09-03T15:45:00Z
Content-Type: application/json
```

**Verification (client-side, before sending):**
```typescript
import { createHmac } from 'node:crypto';

const timestamp = new Date().toISOString();
const payload = {
  type: 'payment_processed',
  workspaceId: 'ws_123',
  // ...
};

const signature = createHmac('sha256', WEBHOOK_SECRET)
  .update(`${timestamp}.${JSON.stringify(payload)}`)
  .digest('hex');
```

**Receiver-side validation:**
- Signature verified via `verifySignature()` in webhook handler
- Timestamp checked (must be within 5 minutes of server time)
- Request body parsed and events deduplicated

### Environment Variable

Store the secret securely in your environment:

```bash
# .env.local (never commit)
WEBHOOK_SECRET_WHY_CREED_EVENTS="your_32_byte_hex_secret_here"

# Generate a new secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deduplication

Events are deduplicated by `dedupe_key` to ensure idempotency. Re-sending the same event is safe.

```typescript
// For Stripe charge:
dedupeKey = `event:payment_processed:${workspaceId}:${stripeChargeId}`

// For milestone:
dedupeKey = `event:milestone_reached:${workspaceId}:${milestoneType}_${milestoneValue}`

// For level-up:
dedupeKey = `event:level_up:${workspaceId}:chapter_${chapterId}`
```

If the same event is sent twice, the second insert is ignored (ON CONFLICT DO NOTHING).

## Database Schema

### business_events

Stores all high-impact events for analytics and digest aggregation.

```sql
CREATE TABLE business_events (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  decision_moment jsonb,
  dedupe_key text UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX business_events_workspace_created ON business_events(workspace_id, created_at);
CREATE INDEX business_events_type_created ON business_events(event_type, created_at);
CREATE INDEX business_events_user_created ON business_events(user_id, created_at);
```

### job_queue

Lightweight async task queue for notification delivery.

```sql
CREATE TABLE job_queue (
  id text PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX job_queue_status_retry ON job_queue(status, next_retry_at);
CREATE INDEX job_queue_type_status ON job_queue(job_type, status);
CREATE INDEX job_queue_created ON job_queue(created_at);
```

## API Reference

### POST /api/webhooks/why-creed-events

**Request:**

```bash
curl -X POST https://onevyrt.masteryresearch.com/api/webhooks/why-creed-events \
  -H "Authorization: Bearer <signature>" \
  -H "X-Webhook-Timestamp: 2026-09-03T15:45:00Z" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_processed",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "660e8400-e29b-41d4-a716-446655440000",
    "userEmail": "founder@company.com",
    "timestamp": "2026-09-03T15:45:00Z",
    "metadata": {
      "amount": 9900,
      "currency": "usd",
      "stripeChargeId": "ch_1234567890"
    }
  }'
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "eventId": "a1b2c3d4e5f6g7h8",
  "message": "Event payment_processed queued for processing"
}
```

**Error Responses:**

```json
// 400 Bad Request — missing fields
{
  "error": "Missing required fields: type, workspaceId, userId, userEmail"
}

// 401 Unauthorized — invalid signature
{
  "error": "Invalid signature"
}

// 500 Internal Server Error
{
  "error": "Event processing failed: database connection error"
}
```

### GET /api/webhooks/why-creed-events

**Health check endpoint:**

```bash
curl "https://onevyrt.masteryresearch.com/api/webhooks/why-creed-events?secret=<WEBHOOK_SECRET>"
```

**Response:**

```json
{
  "status": "ready",
  "endpoint": "/api/webhooks/why-creed-events",
  "method": "POST",
  "eventTypes": [
    "payment_processed",
    "milestone_reached",
    "level_up",
    "daily_action",
    "constraint_improved",
    "habit_reset"
  ],
  "authentication": {
    "scheme": "HMAC-SHA256",
    "header": "Authorization: Bearer <signature>",
    "payload": "timestamp.body",
    "timestamp_header": "X-Webhook-Timestamp"
  },
  "configured": true
}
```

## Job Processing

### Async Job Workflow

1. **Job Created** — webhook handler queues `send_decision_moment` job
2. **Pending** — job waits for next cron tick
3. **Processing** — during `api/cron/tick`, `processDecisionMomentJobs()` picks up up to 50 pending jobs
4. **Send Notification** — in-app notification created
5. **Send Email** — high-urgency emails delivered immediately (medium/low queued for batch)
6. **Completed** — job marked complete
7. **Cleanup** — completed jobs deleted after 7 days

### Retry Logic

- **Max Retries:** 3
- **Backoff:** Exponential (5 * retry_count minutes)
  - Retry 1: 5 minutes
  - Retry 2: 10 minutes
  - Retry 3: 15 minutes
- **After 3 failures:** Job marked `failed`, logged for monitoring

### Integration with Cron Tick

In `lib/jobs.ts`, add this to your job registry:

```typescript
// Add to the jobs map
const JOBS: Job[] = [
  // ... existing jobs ...
  {
    key: "process_decision_moments",
    intervalHours: 1,
    run: processDecisionMomentJobs,
  },
  {
    key: "cleanup_job_queue",
    intervalHours: 24,
    run: cleanupCompletedJobs,
  },
];
```

Then in `app/api/cron/tick/route.ts`, add these jobs to the tick:

```typescript
import { processDecisionMomentJobs, cleanupCompletedJobs } from "@/lib/webhooks/business-events";

async function tick() {
  // ... existing jobs ...

  // Process decision moment notifications (1x per hour)
  if (shouldRun("process_decision_moments", intervalHours: 1)) {
    await processDecisionMomentJobs();
  }

  // Cleanup old job queue entries (1x per day)
  if (shouldRun("cleanup_job_queue", intervalHours: 24)) {
    await cleanupCompletedJobs();
  }
}
```

## Personalization

### Dynamic Why & Creed Insertion

Every decision moment is personalized with the user's stated why and creed (if set):

```json
{
  "title": "Payment Confirmed",
  "body": "Real money is moving because of your business.",
  "why": "Help small business owners think differently",
  "creed": "One profitable customer is worth more than ten tire-kickers",
  "actionUrl": "...",
  "urgencyLevel": "high"
}
```

If why/creed aren't set, the decision moment still works — it just lacks personalization. Users are encouraged to fill these in at `/command-center` for maximum impact.

## Monitoring & Analytics

### Job Queue Stats

Check the health of the job queue:

```typescript
import { getJobQueueStats } from "@/lib/webhooks/business-events";

const stats = await getJobQueueStats();
console.log(stats);
// {
//   pending: 12,
//   processing: 2,
//   completed: 145,
//   failed: 1,
//   total: 160
// }
```

### Event Analytics

Query business_events for insights:

```sql
-- Events by type (last 7 days)
SELECT event_type, COUNT(*) as count
FROM business_events
WHERE created_at > now() - interval '7 days'
  AND deleted_at IS NULL
GROUP BY event_type
ORDER BY count DESC;

-- Users with most events (potential high-engagement)
SELECT user_id, COUNT(*) as event_count
FROM business_events
WHERE created_at > now() - interval '7 days'
  AND deleted_at IS NULL
GROUP BY user_id
ORDER BY event_count DESC
LIMIT 20;

-- Failed jobs needing attention
SELECT id, payload, error_message, retry_count
FROM job_queue
WHERE status = 'failed'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

## Weekly Digest Integration

The `business_events` table feeds the weekly coach digest. Aggregate events to show coaches which learners are taking action:

```typescript
// In lib/coach/digest-run.ts:
async function getWeeklyMetrics(workspaceId: string) {
  const events = await pgPool().query(`
    SELECT event_type, COUNT(*) as count
    FROM business_events
    WHERE workspace_id = $1
      AND created_at > now() - interval '7 days'
      AND deleted_at IS NULL
    GROUP BY event_type
  `, [workspaceId]);

  return {
    paymentsProcessed: events.find(e => e.event_type === 'payment_processed')?.count || 0,
    milestonesReached: events.find(e => e.event_type === 'milestone_reached')?.count || 0,
    chaptersCompleted: events.find(e => e.event_type === 'level_up')?.count || 0,
  };
}
```

## Troubleshooting

### Webhook not being received

1. **Check `WEBHOOK_SECRET_WHY_CREED_EVENTS`** — must be set in environment
2. **Verify signature** — compute locally and compare with sent signature
3. **Check timestamp** — must be within 5 minutes of server time
4. **Health check:** GET `/api/webhooks/why-creed-events?secret=...`

### Events not triggering notifications

1. **Check `business_events` table** — did the event get logged?
   ```sql
   SELECT * FROM business_events WHERE workspace_id = '...' ORDER BY created_at DESC LIMIT 5;
   ```
2. **Check `job_queue` table** — did the async job get queued?
   ```sql
   SELECT * FROM job_queue WHERE status != 'completed' ORDER BY created_at DESC LIMIT 10;
   ```
3. **Check cron tick logs** — is `processDecisionMomentJobs` running?
4. **Check user's why/creed** — are they set? (optional, but improves impact)

### Failed jobs accumulating

1. **Check failure reason:**
   ```sql
   SELECT id, error_message, retry_count
   FROM job_queue
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
2. **Manual retry** (if transient error):
   ```sql
   UPDATE job_queue
   SET status = 'pending', retry_count = 0, next_retry_at = NULL
   WHERE id = 'job_id';
   ```
3. **Check mailer** — if emails fail, look in SMTP logs

## Examples

### Example 1: Payment Received

```json
{
  "type": "payment_processed",
  "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "userEmail": "founder@acmecorp.com",
  "timestamp": "2026-09-03T15:45:00Z",
  "metadata": {
    "amount": 12500,
    "currency": "usd",
    "stripeChargeId": "ch_1Q8z0cKpY9BN2F2w"
  }
}
```

**Decision Moment Generated:**
```
Title: Your Why is Being Tested
Body: Payment confirmed: $125.00. Real money is moving because of your business. What's next?
Why: Help small business owners think differently
Creed: One profitable customer is worth more than ten tire-kickers
Action: "Record this win" → /business/review
Urgency: HIGH (email sent immediately)
```

### Example 2: Milestone Reached

```json
{
  "type": "milestone_reached",
  "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "userEmail": "founder@acmecorp.com",
  "timestamp": "2026-09-03T16:00:00Z",
  "metadata": {
    "milestoneType": "leads_milestone",
    "milestoneValue": 100,
    "currentValue": 100
  }
}
```

**Decision Moment Generated:**
```
Title: Milestone Achieved: 100
Body: You've reached 100 leads. This is real progress. Now what?
Why: Help small business owners think differently
Creed: One profitable customer is worth more than ten tire-kickers
Action: "Plan your next 7 days" → /business/execution
Urgency: HIGH (email sent immediately)
```

### Example 3: Chapter Completed

```json
{
  "type": "level_up",
  "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "userEmail": "founder@acmecorp.com",
  "timestamp": "2026-09-03T16:30:00Z",
  "metadata": {
    "chapterId": 2,
    "lessonId": "m-implement-sales-funnel",
    "lessonTitle": "Build Your Sales Funnel"
  }
}
```

**Decision Moment Generated:**
```
Title: You Completed Chapter 2
Body: "Build Your Sales Funnel" is complete. Your understanding has deepened. Ready for the next level?
Why: Help small business owners think differently
Action: "See what's next" → /programme/chapter-3
Urgency: MEDIUM (queued for next batch)
```

## Performance Considerations

- **Job Processing:** ~50 jobs per cron tick (1x/hour) → 1,200 notifications per day
- **Email Rate Limiting:** Built-in via job queue + backoff
- **Database Indexes:** On workspace_id, event_type, user_id for fast aggregation
- **Retention:** 90-day retention on business_events for analytics
- **Cleanup:** Auto-delete completed jobs after 7 days

## Future Enhancements

- [ ] SMS alerts for highest-urgency events (payments, milestones)
- [ ] Slack integration (notify coach when learner wins)
- [ ] Lookahead: trigger "preparation moment" for upcoming milestones
- [ ] Event templates: allow coaches/admins to customize decision moment copy
- [ ] A/B testing: test different action buttons, urgency levels
- [ ] Real-time WebSocket push (in-app banner instead of just notification)
