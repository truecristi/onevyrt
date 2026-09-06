# Webhook Integration Checklist

Complete these steps to activate the Business Events Webhook system in ONEVYRT.

## 1. Environment Setup

- [ ] Add `WEBHOOK_SECRET_WHY_CREED_EVENTS` to `.env.local`:
  ```bash
  # Generate a new secret
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Add to .env.local
  WEBHOOK_SECRET_WHY_CREED_EVENTS="your_generated_secret_here"
  ```

- [ ] Add to production environment (Vercel/deployment):
  ```bash
  vercel env add WEBHOOK_SECRET_WHY_CREED_EVENTS
  # Paste the same secret
  ```

## 2. Database Migrations

- [ ] Run migration to create `business_events` and `job_queue` tables:
  ```bash
  cd apps/web
  npx node-pg-migrate up
  ```

- [ ] Verify tables created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('business_events', 'job_queue');
  ```

## 3. Integrate with Cron Tick

- [ ] Open `apps/web/lib/jobs.ts`

- [ ] Import the business events processor:
  ```typescript
  import { 
    processDecisionMomentJobs, 
    cleanupCompletedJobs 
  } from "./webhooks/business-events";
  ```

- [ ] Add to the job registry (update existing `const jobs: Job[]`):
  ```typescript
  const jobs: Job[] = [
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

- [ ] Update `dueJobKeys()` call to include new job keys:
  ```typescript
  export async function dueJobKeys(keys: string[], ...): Promise<Set<string>> {
    // keys must include "process_decision_moments" and "cleanup_job_queue"
  }
  ```

## 4. Test Webhook Receiver

- [ ] Verify endpoint is live:
  ```bash
  curl "http://localhost:3000/api/webhooks/why-creed-events?secret=test"
  ```
  Should return 200 with status info.

- [ ] Test signature verification:
  ```bash
  # Create test event
  EVENT='{"type":"payment_processed","workspaceId":"test","userId":"test","userEmail":"test@example.com","timestamp":"2026-09-03T15:45:00Z","metadata":{"amount":1000}}'
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Compute signature
  SIGNATURE=$(node -e "const crypto=require('crypto'); console.log(crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(\`$TIMESTAMP.\${JSON.stringify(JSON.parse('$EVENT'))}\`).digest('hex'))")
  
  # Send webhook
  curl -X POST http://localhost:3000/api/webhooks/why-creed-events \
    -H "Authorization: Bearer $SIGNATURE" \
    -H "X-Webhook-Timestamp: $TIMESTAMP" \
    -H "Content-Type: application/json" \
    -d "$EVENT"
  ```

## 5. Integrate with Stripe Webhooks (Optional)

- [ ] Open `apps/web/app/api/stripe/webhooks/route.ts`

- [ ] Add handler for `charge.succeeded`:
  ```typescript
  if (event.type === 'charge.succeeded') {
    const charge = event.data.object;
    
    // Extract metadata
    const workspaceId = charge.metadata?.workspace_id;
    const userId = charge.metadata?.user_id;
    
    if (workspaceId && userId) {
      // Fetch user email
      const user = await pgPool().query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );
      
      if (user.rows[0]) {
        // Trigger webhook
        await triggerBusinessEvent({
          type: 'payment_processed',
          workspaceId,
          userId,
          userEmail: user.rows[0].email,
          timestamp: new Date(charge.created * 1000).toISOString(),
          metadata: {
            amount: charge.amount,
            currency: charge.currency,
            stripeChargeId: charge.id,
          },
        });
      }
    }
  }
  ```

- [ ] Create helper function `triggerBusinessEvent()`:
  ```typescript
  async function triggerBusinessEvent(event: BusinessEvent): Promise<void> {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify(event);
    
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/why-creed-events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${signature}`,
          'X-Webhook-Timestamp': timestamp,
          'Content-Type': 'application/json',
        },
        body,
      }
    );
    
    if (!response.ok) {
      console.error('[STRIPE] Webhook trigger failed:', await response.text());
    }
  }
  ```

## 6. Integrate with Chapter Submission (Optional)

- [ ] Open `apps/web/app/api/programme/chapters/[chapterId]/submit/route.ts`

- [ ] After chapter approval, trigger `level_up` event:
  ```typescript
  // After enrollment update succeeds...
  
  const workspace = await getWorkspace(workspaceId);
  const user = await getCurrentUser();
  
  await triggerBusinessEvent({
    type: 'level_up',
    workspaceId,
    userId: user.id,
    userEmail: user.email,
    timestamp: new Date().toISOString(),
    metadata: {
      chapterId: parseInt(chapterId),
      lessonId: 'chapter-complete',
      lessonTitle: `Chapter ${chapterId} Completed`,
    },
  });
  ```

## 7. Milestone Detection Job (Optional)

- [ ] Create `apps/web/lib/webhooks/milestone-detector.ts`:
  ```typescript
  export async function detectMilestones(): Promise<{ created: number }> {
    const pool = pgPool();
    
    // Query workspaces with lead count changes
    const results = await pool.query(`
      SELECT w.id, w.owner_id, u.email
      FROM workspaces w
      JOIN users u ON u.id = w.owner_id
      WHERE w.deleted_at IS NULL
    `);
    
    let triggered = 0;
    
    for (const workspace of results.rows) {
      // Get lead count
      const leadCount = await getLeadCount(workspace.id);
      
      // Check for milestones
      const milestones = [100, 250, 500, 1000];
      for (const milestone of milestones) {
        if (leadCount === milestone) {
          await triggerBusinessEvent({
            type: 'milestone_reached',
            workspaceId: workspace.id,
            userId: workspace.owner_id,
            userEmail: workspace.email,
            timestamp: new Date().toISOString(),
            metadata: {
              milestoneType: 'leads_milestone',
              milestoneValue: milestone,
              currentValue: leadCount,
            },
          });
          triggered++;
        }
      }
    }
    
    return { created: triggered };
  }
  ```

- [ ] Add to job registry in `lib/jobs.ts`:
  ```typescript
  import { detectMilestones } from "./webhooks/milestone-detector";
  
  const jobs: Job[] = [
    // ... existing jobs ...
    {
      key: "detect_milestones",
      intervalHours: 24,
      run: detectMilestones,
    },
  ];
  ```

## 8. Monitoring & Logging

- [ ] Check webhook logs:
  ```bash
  # In production (Vercel)
  vercel logs api/webhooks/why-creed-events
  
  # Or check your log aggregator (Datadog, Sentry, etc.)
  ```

- [ ] Monitor job queue:
  ```bash
  # Query job queue stats
  SELECT 
    status, 
    COUNT(*) as count
  FROM job_queue
  WHERE deleted_at IS NULL
  GROUP BY status;
  ```

- [ ] Monitor event logs:
  ```bash
  # Recent business events
  SELECT 
    event_type, 
    COUNT(*) as count,
    MAX(created_at) as latest
  FROM business_events
  WHERE created_at > now() - interval '24 hours'
    AND deleted_at IS NULL
  GROUP BY event_type;
  ```

## 9. Testing Checklist

### Local Testing
- [ ] Run `pnpm dev`
- [ ] POST to `http://localhost:3000/api/webhooks/why-creed-events`
- [ ] Verify signature validation
- [ ] Check `business_events` table for logged event
- [ ] Check `job_queue` table for queued notification
- [ ] Verify cron tick processes the job
- [ ] Check in-app notification created
- [ ] Check email sent (check SMTP logs)

### Production Testing
- [ ] Deploy to staging environment
- [ ] Test with real Stripe webhook
- [ ] Verify `WEBHOOK_SECRET_WHY_CREED_EVENTS` is set
- [ ] Monitor logs for errors
- [ ] Check business_events table populated
- [ ] Verify notifications delivered to test user

## 10. Verification

- [ ] Health check passes:
  ```bash
  curl "https://onevyrt.masteryresearch.com/api/webhooks/why-creed-events?secret=..."
  # Returns: { "status": "ready", "configured": true, ... }
  ```

- [ ] Webhook can be triggered (test event):
  ```bash
  # POST test event
  # Response: { "success": true, "eventId": "...", "message": "..." }
  ```

- [ ] Cron tick processes jobs:
  ```bash
  # Trigger cron tick manually
  curl "https://onevyrt.masteryresearch.com/api/cron/tick?secret=..."
  # Check logs for "process_decision_moments" job
  ```

- [ ] Notifications appear in database:
  ```sql
  SELECT * FROM notifications
  WHERE type LIKE 'decision_moment%'
  ORDER BY created_at DESC
  LIMIT 1;
  ```

- [ ] Emails delivered (check SMTP logs)

## 11. Documentation

- [ ] Share `docs/WEBHOOK_WHY_CREED_EVENTS.md` with team
- [ ] Document your specific triggers (Stripe, internal API, jobs)
- [ ] Add runbook entry for webhook troubleshooting
- [ ] Update API documentation with new endpoint

## 12. Rollback Plan

If anything goes wrong:

```bash
# Disable webhook processing (keep received events)
UPDATE job_queue SET status = 'pending' WHERE status = 'processing';

# Disable job queue processing in lib/jobs.ts
# Remove or comment out processDecisionMomentJobs and cleanupCompletedJobs

# Rollback migration (if needed)
npx node-pg-migrate down

# Monitor for errors
vercel logs
```

## Done!

The webhook system is now active. Users will receive decision moment notifications for:
- Payments processed (email)
- Milestones reached (email)
- Chapters completed (notification)
- Constraint improvements (email)
- Habit resets (email)

All personalized with their why & creed when available.
