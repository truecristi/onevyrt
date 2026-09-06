# Why & Creed Reminders: Daily Motivation Emails

## Overview

A daily cron job that identifies stalled users and sends personalized motivation emails based on their "why" and "creed". The system includes:

- **Stall Detection**: Finds users who haven't been active for 7+ days or are stuck on the same chapter for 14+ days
- **Template Selection**: Chooses appropriate template based on stall severity (mild/moderate/severe)
- **Email Sending**: SMTP integration with rate limiting (50 emails/min)
- **Deduplication**: Uses dedupeKey to prevent duplicate sends on the same day
- **Opt-Out Support**: Respects user email preferences and hard/soft bounce handling
- **Delivery Logging**: Tracks all send attempts with status and error messages

## Files

```
app/api/cron/why-creed-reminders/route.ts       — Main cron handler (POST)
lib/stall-detection.ts                           — Stall detection logic & config
lib/why-creed-reminders.ts                       — Database queries & logging
lib/emails/why-creed-templates.ts                — Email templates (already exists)
apps/web/migrations/1788456900000_*.js           — Database schema
docs/WHY_CREED_REMINDERS_IMPLEMENTATION.md       — This file
```

## Setup Instructions

### 1. Run Database Migration

```bash
cd apps/web
npm run migrate:up

# Verify tables created:
psql $DATABASE_URL -c "
  \dt email_history user_email_preferences email_bounces
"
```

### 2. Configure Environment Variables

Add to `.env.local` (or production secrets):

```env
# Cron authentication
CRON_SECRET=your-secret-token-32-chars-min

# SMTP configuration (e.g., SendGrid, AWS SES, Mailgun)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-key...
SMTP_FROM=noreply@onevyrt.com

# App configuration
NEXT_PUBLIC_APP_URL=https://onevyrt.masteryresearch.com
```

### 3. Register Cron Job (Optional)

Add to `lib/jobs.ts` (if using internal job registry):

```typescript
// lib/jobs.ts
export const SCHEDULED_JOBS = {
  // ... other jobs
  "why-creed-reminders": {
    description: "Send motivation emails to stalled users",
    frequency: "daily",
    runAt: "06:00 UTC", // Morning (adjust to your timezone)
    timeout: 300000, // 5 minutes
    endpoint: "/api/cron/why-creed-reminders",
    requiresAuth: true,
  },
};
```

### 4. Implement Database Queries

Complete the stub implementations in `lib/why-creed-reminders.ts`:

#### a) `queryStalledUsers()`

Find all users who meet stall criteria:

```typescript
// Pseudo-SQL (adapt to your DB layer)
SELECT
  w.id as workspace_id,
  u.id as user_id,
  u.email,
  u.name,
  wc.why,
  wc.creed,
  u.created_at,
  COALESCE(al.last_activity_at, NULL) as last_activity_at,
  COALESCE((e.enrollment ->> 'currentChapter')::int, 0) as current_chapter,
  e.last_modified_at as chapter_updated_at,
  COALESCE(uep.opted_out_all, false) as has_opted_out
FROM workspaces w
JOIN workspaces_users wu ON w.id = wu.workspace_id
JOIN users u ON wu.user_id = u.id
LEFT JOIN workspace_why_creed wc ON w.id = wc.workspace_id
  AND wc.deleted_at IS NULL
LEFT JOIN enrollments e ON w.id = e.workspace_id
LEFT JOIN activity_log al ON w.id = al.workspace_id
  AND u.id = al.user_id
LEFT JOIN user_email_preferences uep ON u.id = uep.user_id
WHERE
  wc.why IS NOT NULL AND wc.why != ''
  AND wc.creed IS NOT NULL AND wc.creed != ''
  AND u.created_at < NOW() - INTERVAL '3 days'
  AND (
    COALESCE(al.last_activity_at, u.created_at) < NOW() - INTERVAL '7 days'
    OR e.last_modified_at < NOW() - INTERVAL '14 days'
  )
  AND COALESCE(uep.opted_out_all, false) = false
ORDER BY COALESCE(al.last_activity_at, u.created_at) ASC
LIMIT 1000;
```

#### b) `hasEmailBeenSentToday()`

Check deduplication:

```typescript
SELECT COUNT(*) > 0
FROM email_history
WHERE workspace_id = $1
  AND dedupe_key = $2
  AND DATE(sent_at) = CURRENT_DATE
  AND status IN ('sent', 'pending');
```

#### c) `countRemindersThisMonth()`

Enforce reminder frequency caps:

```typescript
SELECT COUNT(*)
FROM email_history
WHERE workspace_id = $1
  AND DATE_TRUNC('month', sent_at) = DATE_TRUNC('month', CURRENT_DATE)
  AND status = 'sent';
```

#### d) `logEmailSend()`

Track delivery attempts:

```typescript
INSERT INTO email_history (
  workspace_id, user_id, user_email, template_type, dedupe_key,
  status, message_id, error_message, sent_at, created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
ON CONFLICT (dedupe_key) DO UPDATE SET
  status = EXCLUDED.status,
  message_id = COALESCE(EXCLUDED.message_id, message_id),
  error_message = COALESCE(EXCLUDED.error_message, error_message),
  sent_at = NOW();
```

### 5. Update Cron Route (in route.ts)

Replace stub calls with actual implementations:

```typescript
// At the top of route.ts, after imports:
import {
  queryStalledUsers,
  hasEmailBeenSentToday,
  countRemindersThisMonth,
  logEmailSend,
} from "@/lib/why-creed-reminders";
import {
  isUserStalled,
  daysSinceDate,
  classifyStallSeverity,
  isEligibleForEmail,
  STALL_CONFIG,
} from "@/lib/stall-detection";

// Replace stub functions:
async function findStalledUsers(): Promise<StalledUser[]> {
  const records = await queryStalledUsers();
  
  return records
    .filter(record => {
      const noActivityDays = daysSinceDate(record.last_activity_at);
      const sameChapterDays = daysSinceDate(record.chapter_updated_at);
      
      return isUserStalled({
        noActivityDays,
        sameChapterDays,
        hasWhyAndCreed: !!record.why && !!record.creed,
        isProfileOldEnough: daysSinceDate(record.created_at) >= STALL_CONFIG.MIN_PROFILE_AGE_DAYS,
        isActiveUser: !!record.last_activity_at,
      });
    })
    .map(record => ({
      workspace_id: record.workspace_id,
      user_id: record.user_id,
      email: record.email,
      name: record.name,
      why: record.why,
      creed: record.creed,
      last_activity: record.last_activity_at,
      days_since_activity: daysSinceDate(record.last_activity_at),
      current_chapter: record.current_chapter,
      chapter_started_at: record.chapter_updated_at,
      has_opted_out: record.has_opted_out,
      envelope_status: "not_sent",
    }));
}

async function hasEmailBeenSentToday(
  workspaceId: string,
  templateType: WhyCreedEmailType
): Promise<boolean> {
  const dedupeKey = getWhyCreedEmailDedupeKey(workspaceId, templateType, "daily");
  return await hasEmailBeenSentToday(workspaceId, templateType); // Use imported fn
}

async function logEmailSend(
  workspaceId: string,
  email: string,
  templateType: WhyCreedEmailType,
  dedupeKey: string,
  result: { success: boolean; error?: string; messageId?: string }
): Promise<void> {
  await logEmailSend({
    workspaceId,
    userEmail: email,
    templateType,
    dedupeKey,
    status: result.success ? "sent" : "failed",
    messageId: result.messageId,
    errorMessage: result.error,
  });
}
```

## Calling the Cron Job

### Option A: External Cron Service (Recommended)

Use services like cron.io, EasyCron, or GitHub Actions:

**cURL example:**

```bash
curl -X POST https://onevyrt.masteryresearch.com/api/cron/why-creed-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**GitHub Actions (daily at 6am UTC):**

`.github/workflows/cron-why-creed-reminders.yml`:

```yaml
name: Daily Why & Creed Reminders

on:
  schedule:
    - cron: "0 6 * * *" # 6am UTC daily

jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger why-creed-reminders
        run: |
          curl -X POST \
            https://onevyrt.masteryresearch.com/api/cron/why-creed-reminders \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### Option B: Internal Cron Tick (if using job registry)

Add to your existing cron tick handler:

```typescript
// app/api/cron/tick/route.ts
const JOB_HANDLERS: Record<string, () => Promise<any>> = {
  // ... existing jobs
  "why-creed-reminders": () =>
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/why-creed-reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }),
};
```

## Email Templates

Three templates are available (see `lib/emails/why-creed-templates.ts`):

| Template | Severity | Trigger | Purpose |
|----------|----------|---------|---------|
| `remember_why` | Mild/Moderate | 7-30 days inactive | Reconnect to purpose |
| `ninety_days` | Severe | 90+ days inactive | Milestone reflection |
| `creed_in_action` | Moderate | 30+ days + metrics | Show progress |

Selection is automatic based on stall duration:

```
90+ days inactive → ninety_days template
30-89 days inactive → remember_why template
7-29 days inactive → remember_why template
```

## Monitoring & Debugging

### Check Recent Emails

```typescript
// In your admin panel or API route
import { getRecentEmailHistory } from "@/lib/why-creed-reminders";

const history = await getRecentEmailHistory(workspaceId, 50);
console.log(history);
```

### Logs

The cron handler logs to console:

```
[CRON] Why & Creed Reminders Job {
  timestamp: "2026-09-03T06:15:22.000Z",
  total_users_checked: 142,
  stalled_users_found: 89,
  emails_sent: 85,
  emails_failed: 4,
  opted_out_skipped: 15,
  deduped_skipped: 0,
  errors: ["user@example.com: SMTP timeout", ...],
  duration_ms: 38500
}
```

## Opt-Out / Unsubscribe Flow

### User clicks "Manage email preferences"

Link: `/account?tab=email-preferences`

Component should:
1. Show current email preferences
2. Provide "Opt out of all emails" toggle
3. Call `PATCH /api/account/email-preferences`

**API route:** `app/api/account/email-preferences/route.ts`

```typescript
import { setEmailPreference } from "@/lib/why-creed-reminders";

export async function PATCH(req: NextRequest) {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return unauthorized();

  const { optOutAll } = await req.json();
  const workspace = await getUserWorkspace(user.id);

  await setEmailPreference(user.id, workspace.id, optOutAll);

  return NextResponse.json({ success: true });
}
```

### Hard Bounce Handling (Optional)

When SMTP returns a hard bounce (554 - mailbox doesn't exist):

```typescript
import { handleEmailBounce } from "@/lib/why-creed-reminders";

const sendResult = await sendEmail(...);
if (sendResult.error?.includes("554")) {
  // Hard bounce: permanently opt out
  await handleEmailBounce(userEmail, "hard");
}
```

## Performance Considerations

### Rate Limiting

- **Emails per minute**: 50 (adjustable in `EMAIL_RATE_LIMIT`)
- **Batch delay**: 1200ms between emails
- **Total throughput**: ~72,000 emails/day

If you have more stalled users, increase `EMAILS_PER_MINUTE` or run multiple job instances.

### Database Query Optimization

The `queryStalledUsers()` query uses:
- Index on `workspace_why_creed(deleted_at)` for NULL checks
- Index on `activity_log(workspace_id, user_id, created_at)` for activity lookups
- Index on `enrollments(workspace_id)` for chapter queries

Consider:
```sql
-- Add if not present
CREATE INDEX idx_workspace_why_creed_deleted ON workspace_why_creed(deleted_at);
CREATE INDEX idx_activity_log_workspace_user_time ON activity_log(workspace_id, user_id, created_at DESC);
CREATE INDEX idx_enrollments_workspace ON enrollments(workspace_id);
```

### SMTP Connection Pooling

The current implementation creates a new transport per email. For large batches, consider:

```typescript
// Reuse transporter across batch
const transporter = nodemailer.createTransport({...});

for (const user of batch) {
  const result = await transporter.sendMail({...});
  // ...
}

// Close after batch
transporter.close();
```

## Testing

### Local Testing

```bash
# Test GET (health check)
curl "http://localhost:3000/api/cron/why-creed-reminders?secret=your-secret"

# Expected response:
{
  "status": "ready",
  "endpoint": "/api/cron/why-creed-reminders",
  "method": "POST",
  "stall_detection": {...},
  "smtp_configured": true
}

# Test POST (dry run)
curl -X POST http://localhost:3000/api/cron/why-creed-reminders \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "message": "Sent 42 motivation emails in 35200ms",
  "result": {
    "total_users_checked": 89,
    "stalled_users_found": 42,
    "emails_sent": 40,
    ...
  }
}
```

### Database Verification

```sql
-- Check email_history table
SELECT COUNT(*) as total_sends, status, COUNT(*) 
FROM email_history
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Check opt-outs
SELECT COUNT(*) as opted_out_count
FROM user_email_preferences
WHERE opted_out_all = true;

-- Recent failures
SELECT user_email, error_message, sent_at
FROM email_history
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 10;
```

## Known Limitations & Future Improvements

### Current Limitations

1. **Stall detection** uses simple time-based logic; could add ML to predict churn
2. **Template selection** is rule-based; could be personalized per user
3. **Metrics in emails** are optional; requires plugging in dashboard data
4. **No A/B testing** built in; could test subject lines, templates, send times
5. **No response tracking** (e.g., click-through rates); would need email link tracking

### Future Enhancements

- [ ] Add email open/click tracking (via pixel or link wrapping)
- [ ] Implement A/B testing framework for subject lines
- [ ] Add ML-based churn prediction
- [ ] Support SMS as fallback channel (via Twilio)
- [ ] Add timezone-aware send scheduling
- [ ] Integrate with email service provider webhooks (bounce/complaint handling)
- [ ] Build admin dashboard for email campaign monitoring
- [ ] Add template preview/testing in admin UI

## Troubleshooting

### "SMTP not configured" error

**Cause**: Missing SMTP env vars

**Fix**: Add `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` to `.env.local`

### "Unauthorized: Invalid or missing CRON_SECRET"

**Cause**: Cron request missing Authorization header or secret mismatch

**Fix**: 
```bash
# Generate a strong secret
openssl rand -hex 32 > /tmp/cron_secret.txt

# Add to env and cron service
export CRON_SECRET=$(cat /tmp/cron_secret.txt)
```

### Emails not sending (0 sent, no errors)

**Cause**: No stalled users found, or all were opted out/deduped

**Check**:
```sql
-- Verify stalled users exist
SELECT COUNT(*) FROM workspace_why_creed WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM email_history WHERE DATE(sent_at) = CURRENT_DATE;
```

### SMTP timeout errors

**Cause**: SMTP server slow or network latency

**Fix**: Increase `EMAIL_RATE_LIMIT.BATCH_DELAY_MS` or reduce `EMAILS_PER_MINUTE`

## Contact & Support

For questions or issues, check:
- ONEVYRT Slack: #engineering-alerts
- GitHub Issues: Label `cron-jobs`
- Email: engineering@onevyrt.com
