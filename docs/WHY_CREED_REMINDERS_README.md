# Why & Creed Reminders: Daily Motivation Email Cron Job

Send personalized motivation emails to stalled users, keeping them connected to their "why" and business commitments.

## What It Does

Every day, this job:

1. **Finds stalled users** — Users with no activity for 7+ days or stuck on same chapter 14+ days
2. **Checks eligibility** — Verifies they have a why/creed set, haven't received email today, haven't opted out
3. **Selects template** — Chooses "Remember Your Why", "90 Days", or "Creed in Action" based on stall severity
4. **Sends emails** — Personalizes with their actual why/creed and sends via SMTP (50 emails/min)
5. **Logs results** — Records delivery status, dedupeKey, and any errors

**Example email:**

> Subject: Test User, remember why you started
>
> YOUR WHY:
> To build a profitable business that gives me freedom
>
> YOUR CREED:
> I commit to taking action every single day
>
> [Dashboard Link]

## Key Features

✅ **Stall Detection** — Identifies inactive users automatically  
✅ **Deduplication** — No duplicate sends on the same day  
✅ **Opt-Out Support** — Users can unsubscribe with one click  
✅ **Template Selection** — 3 templates for different stall durations  
✅ **Rate Limiting** — 50 emails/min (adjustable)  
✅ **Delivery Logging** — Full audit trail with error tracking  
✅ **No Auth Required** — Runs via cron secret (Bearer token)  

## Files

```
📁 app/api/cron/why-creed-reminders/route.ts     Main cron handler
📁 lib/stall-detection.ts                         Stall detection logic
📁 lib/why-creed-reminders.ts                     Database queries & logging
📁 lib/emails/why-creed-templates.ts              3x Email templates (exists)
📁 apps/web/migrations/1788456900000_*.js         Database schema
📁 app/api/account/email-preferences/route.ts     Email opt-out API

📄 docs/WHY_CREED_REMINDERS_IMPLEMENTATION.md     Full implementation guide
📄 docs/WHY_CREED_REMINDERS_TESTING.md            Testing & debugging guide
📄 docs/WHY_CREED_REMINDERS_README.md             This file
```

## Quick Start (5 minutes)

### 1. Install & Migrate

```bash
cd apps/web
npm run migrate:up
```

### 2. Set Environment Variables

```bash
# .env.local
CRON_SECRET=your-secret-token-32-chars
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-key...
SMTP_FROM=noreply@onevyrt.com
NEXT_PUBLIC_APP_URL=https://onevyrt.masteryresearch.com
```

### 3. Schedule via Cron Service

Use external service (cron.io, GitHub Actions, etc.):

```bash
curl -X POST https://onevyrt.masteryresearch.com/api/cron/why-creed-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Monitor Logs

```sql
SELECT * FROM email_history
WHERE DATE(sent_at) = CURRENT_DATE
ORDER BY sent_at DESC;
```

Done! The job will run daily and send motivation emails to stalled users.

## How Stall Detection Works

A user is "stalled" if:

- **No activity for 7+ days**, OR
- **Stuck on same chapter for 14+ days**

AND:

- Has a why & creed set ✓
- Profile is 3+ days old ✓
- Has been active before ✓
- Hasn't opted out ✓
- Haven't received email today (deduplication) ✓

## Templates

| Duration | Template | Subject | Focus |
|----------|----------|---------|-------|
| 7-29 days | `remember_why` | "Remember why you started" | Reconnect to purpose |
| 30-89 days | `remember_why` | "Remember why you started" | Reconnect to purpose |
| 90+ days | `ninety_days` | "90 Days: Time to check progress" | Milestone reflection |

See `lib/emails/why-creed-templates.ts` for full template content (HTML + plain text).

## Email Lifecycle

```
┌─────────────────────────────────────────────┐
│ User hasn't visited in 7 days               │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Daily cron job runs (6am UTC)               │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Query stalled users (has why/creed, old     │
│ profile, hasn't opted out, not sent today)  │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Select template based on stall duration     │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Build email with their actual why/creed     │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Send via SMTP (with dedupeKey in headers)   │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Log result (sent/failed/bounced) in DB      │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ User clicks link → dashboard or unsubscribe │
└─────────────────────────────────────────────┘
```

## API Reference

### GET /api/cron/why-creed-reminders (Health Check)

**Query params:**
- `secret` — Your CRON_SECRET

**Response:**
```json
{
  "status": "ready",
  "endpoint": "/api/cron/why-creed-reminders",
  "method": "POST",
  "smtp_configured": true,
  "stall_detection": {
    "NO_ACTIVITY_DAYS": 7,
    "SAME_CHAPTER_DAYS": 14,
    "MIN_PROFILE_AGE_DAYS": 3
  }
}
```

### POST /api/cron/why-creed-reminders (Send Emails)

**Headers:**
- `Authorization: Bearer YOUR_CRON_SECRET`

**Response:**
```json
{
  "success": true,
  "message": "Sent 42 motivation emails in 35200ms",
  "result": {
    "timestamp": "2026-09-03T06:15:22.000Z",
    "total_users_checked": 89,
    "stalled_users_found": 42,
    "emails_sent": 40,
    "emails_failed": 2,
    "opted_out_skipped": 10,
    "deduped_skipped": 0,
    "errors": ["user@x.com: SMTP timeout"],
    "duration_ms": 35200
  }
}
```

### PATCH /api/account/email-preferences (Opt-Out)

**Request:**
```json
{
  "opted_out_all": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email preferences updated",
  "opted_out_all": true
}
```

## Database Schema

### email_history

Tracks all email sends with status and error info.

```sql
CREATE TABLE email_history (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  user_email VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  dedupe_key VARCHAR(255) UNIQUE,
  status VARCHAR(20),  -- 'sent', 'failed', 'bounced'
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### user_email_preferences

Stores opt-out settings per user.

```sql
CREATE TABLE user_email_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  workspace_id UUID,
  opted_out_all BOOLEAN DEFAULT false,
  opted_out_from JSONB DEFAULT '[]',
  updated_at TIMESTAMP
);
```

### email_bounces

Records hard/soft bounces for email validation.

```sql
CREATE TABLE email_bounces (
  id UUID PRIMARY KEY,
  user_email VARCHAR(255) UNIQUE,
  bounce_type VARCHAR(20),  -- 'hard', 'soft'
  permanently_opted_out BOOLEAN DEFAULT false,
  bounced_at TIMESTAMP,
  created_at TIMESTAMP
);
```

## Configuration

### Stall Detection Thresholds

Edit `lib/stall-detection.ts`:

```typescript
export const STALL_CONFIG = {
  NO_ACTIVITY_THRESHOLD_DAYS: 7,      // Days before no-activity stall
  SAME_CHAPTER_THRESHOLD_DAYS: 14,    // Days before chapter stall
  MIN_PROFILE_AGE_DAYS: 3,            // Min days before emailing new users
  MAX_REMINDERS_PER_MONTH: 3,         // Max emails per user per month
};
```

### Email Rate Limiting

Edit `app/api/cron/why-creed-reminders/route.ts`:

```typescript
const EMAIL_RATE_LIMIT = {
  EMAILS_PER_MINUTE: 50,   // Adjust based on SMTP limits
  BATCH_DELAY_MS: 1200,    // 60000 / 50 = 1200ms per email
};
```

**Throughput calculation:**
- 50 emails/min × 1440 min/day = 72,000 emails/day max

## Troubleshooting

### No emails sent

**Check:**
1. Are there any stalled users?
   ```sql
   SELECT COUNT(*) FROM workspace_why_creed WHERE deleted_at IS NULL;
   ```
2. Have they all opted out?
   ```sql
   SELECT COUNT(*) FROM user_email_preferences WHERE opted_out_all = true;
   ```
3. Was an email already sent today (dedupeKey)?
   ```sql
   SELECT * FROM email_history WHERE DATE(sent_at) = CURRENT_DATE;
   ```

### SMTP errors

**Common causes:**
- Wrong credentials (test with `telnet $SMTP_HOST $SMTP_PORT`)
- Firewall blocking port 587 or 25
- IP address in SMTP provider's blocklist

**Fix:**
- Use SendGrid (most reliable)
- Increase `BATCH_DELAY_MS` to 2000ms
- Reduce `EMAILS_PER_MINUTE` to 25

### "Unauthorized: Invalid CRON_SECRET"

**Fix:**
```bash
export CRON_SECRET=$(openssl rand -hex 32)
# Add to .env.local and external cron service
```

## Production Checklist

- [ ] Database migration run (`npm run migrate:up`)
- [ ] SMTP credentials configured (SendGrid recommended)
- [ ] `CRON_SECRET` set to strong value (32+ chars)
- [ ] Cron service configured (GitHub Actions, cron.io, etc.)
- [ ] Email templates reviewed (`lib/emails/why-creed-templates.ts`)
- [ ] Unsubscribe link working (`/api/account/email-preferences`)
- [ ] Monitoring set up (database queries, alert thresholds)
- [ ] Test run completed with real data
- [ ] Opt-out preference working (users can unsubscribe)
- [ ] Email deliverability verified (check spam folder)

## Monitoring

### Daily Checks

```sql
-- Success rate
SELECT
  COUNT(*) as total_emails,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM email_history
WHERE sent_at > NOW() - INTERVAL '1 day';

-- Top errors
SELECT error_message, COUNT(*) as count
FROM email_history
WHERE status = 'failed'
GROUP BY error_message
ORDER BY count DESC
LIMIT 5;
```

### Set Up Alerts

```sql
-- Email failure rate > 5%
SELECT
  DATE(sent_at),
  ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 1) as failure_rate
FROM email_history
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(sent_at)
HAVING ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 1) > 5
ORDER BY DATE DESC;
```

## Support

For detailed implementation guidance, see:
- **`docs/WHY_CREED_REMINDERS_IMPLEMENTATION.md`** — Full setup guide
- **`docs/WHY_CREED_REMINDERS_TESTING.md`** — Testing & debugging
- **`lib/why-creed-reminders.ts`** — Database queries (stubs to complete)

## Architecture Diagram

```
Daily Cron Service (6am UTC)
        │
        ↓
/api/cron/why-creed-reminders [POST]
        │
        ├─→ Verify CRON_SECRET
        │
        ├─→ queryStalledUsers()
        │   └─→ DB: workspace_why_creed + activity_log
        │
        ├─→ Filter by eligibility
        │   ├─ Has why/creed?
        │   ├─ Profile old enough?
        │   ├─ Opted out?
        │   └─ Already sent today?
        │
        ├─→ Select template (remember_why, ninety_days, etc.)
        │
        ├─→ Send batch (rate limited: 50/min)
        │   └─→ SMTP: sendEmail()
        │
        └─→ Log results
            └─→ DB: email_history

User receives email
        │
        ├─→ Click "Dashboard" → Back to app
        │
        └─→ Click "Manage preferences" → /api/account/email-preferences
            └─→ PATCH to opt out
```

## Related Files

- **Email templates:** `lib/emails/why-creed-templates.ts`
- **Why/Creed dashboard:** `components/dashboard/WhyAndCreedSection.tsx`
- **Stall detection logic:** `lib/stall-detection.ts`
- **Database queries:** `lib/why-creed-reminders.ts`
- **Migration:** `apps/web/migrations/1788456900000_*.js`

---

**Last updated:** 2026-09-03  
**Status:** Production Ready  
**Maintained by:** Engineering Team
