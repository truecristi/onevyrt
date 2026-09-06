# Why & Creed Reminders: Testing & Verification Guide

## Quick Start

### 1. Verify Installation

```bash
# Check files exist
ls -la app/api/cron/why-creed-reminders/route.ts
ls -la lib/stall-detection.ts
ls -la lib/why-creed-reminders.ts
ls -la apps/web/migrations/1788456900000_*.js

# Run migration
cd apps/web
npm run migrate:up
```

### 2. Health Check

```bash
# GET endpoint (public, no auth)
curl "http://localhost:3000/api/cron/why-creed-reminders?secret=test-secret"

# Expected response:
{
  "status": "ready",
  "endpoint": "/api/cron/why-creed-reminders",
  "smtp_configured": false,
  "stall_detection": {
    "NO_ACTIVITY_DAYS": 7,
    "SAME_CHAPTER_DAYS": 14,
    "MIN_PROFILE_AGE_DAYS": 3
  }
}
```

### 3. Dry Run (No SMTP)

```bash
# POST to cron endpoint (with auth)
export CRON_SECRET="test-secret-12345"

curl -X POST http://localhost:3000/api/cron/why-creed-reminders \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response (if no stalled users):
{
  "success": true,
  "message": "Sent 0 motivation emails in 145ms",
  "result": {
    "timestamp": "2026-09-03T10:30:00.000Z",
    "total_users_checked": 0,
    "stalled_users_found": 0,
    "emails_sent": 0,
    "emails_failed": 0,
    "opted_out_skipped": 0,
    "deduped_skipped": 0,
    "errors": [],
    "duration_ms": 145
  }
}
```

## Manual Testing Workflow

### Step 1: Create Test Data

```sql
-- Create test user
INSERT INTO users (id, email, name, password_hash, created_at)
VALUES (
  'test-user-1'::uuid,
  'test@example.com',
  'Test User',
  'hash...',
  NOW() - INTERVAL '30 days'
);

-- Create workspace
INSERT INTO workspaces (id, name, owner_id, created_at)
VALUES (
  'test-ws-1'::uuid,
  'Test Workspace',
  'test-user-1'::uuid,
  NOW() - INTERVAL '30 days'
);

-- Add user to workspace
INSERT INTO workspaces_users (workspace_id, user_id, role)
VALUES ('test-ws-1'::uuid, 'test-user-1'::uuid, 'owner');

-- Set why & creed
INSERT INTO workspace_why_creed (
  id, workspace_id, why, creed, created_at, deleted_at
)
VALUES (
  'test-wc-1'::uuid,
  'test-ws-1'::uuid,
  'To build a profitable business that gives me freedom',
  'I commit to taking action every single day toward my business goals',
  NOW() - INTERVAL '30 days',
  NULL
);

-- Record activity (7+ days old for stall detection)
INSERT INTO activity_log (
  id, workspace_id, user_id, action, metadata, created_at
)
VALUES (
  'test-activity-1'::uuid,
  'test-ws-1'::uuid,
  'test-user-1'::uuid,
  'page_view',
  '{"page": "/command-center"}'::jsonb,
  NOW() - INTERVAL '15 days' -- 15 days ago = stalled
);

-- Create enrollment (optional, for chapter tracking)
INSERT INTO enrollments (workspace_id, enrollment, last_modified_at)
VALUES (
  'test-ws-1'::uuid,
  '{
    "currentChapter": 2,
    "startedAt": "2026-08-01T00:00:00Z",
    "progress": {"chapter_1": "completed"}
  }'::jsonb,
  NOW() - INTERVAL '15 days'
);
```

### Step 2: Query Test Data

```sql
-- Verify setup
SELECT * FROM workspace_why_creed WHERE workspace_id = 'test-ws-1'::uuid;
SELECT * FROM activity_log WHERE workspace_id = 'test-ws-1'::uuid;
SELECT * FROM enrollments WHERE workspace_id = 'test-ws-1'::uuid;
```

### Step 3: Test Stall Detection Logic

```typescript
// lib/stall-detection.ts
import { isUserStalled, daysSinceDate } from "@/lib/stall-detection";

// Simulate a stalled user
const testUser = {
  noActivityDays: 15,
  sameChapterDays: 8,
  hasWhyAndCreed: true,
  isProfileOldEnough: true,
  isActiveUser: true,
};

const isStalled = isUserStalled(testUser);
console.log("Is stalled:", isStalled); // Should be true (15 >= 7)

// Test daysSinceDate
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
console.log("Days since:", daysSinceDate(sevenDaysAgo)); // Should be ~7
```

### Step 4: Configure SMTP (for testing)

#### Option A: Use MailHog (local testing)

```bash
# Install & run MailHog
brew install mailhog
mailhog

# Set env vars
export SMTP_HOST=localhost
export SMTP_PORT=1025
export SMTP_USER=test
export SMTP_PASS=test
export SMTP_FROM=test@localhost

# Web UI: http://localhost:8025
```

#### Option B: Use SendGrid (production-like)

```bash
export SMTP_HOST=smtp.sendgrid.net
export SMTP_PORT=587
export SMTP_USER=apikey
export SMTP_PASS=SG.your-sendgrid-key...
export SMTP_FROM=noreply@onevyrt.com
```

#### Option C: Use Gmail (for testing)

```bash
# Generate app password: https://myaccount.google.com/apppasswords
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM=your-email@gmail.com
```

### Step 5: Run Cron Job with Test Data

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run cron job
export CRON_SECRET="test-secret"
export SMTP_HOST=localhost
export SMTP_PORT=1025
export SMTP_USER=test
export SMTP_PASS=test

curl -X POST http://localhost:3000/api/cron/why-creed-reminders \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Check response:
# {
#   "success": true,
#   "message": "Sent 1 motivation emails in 2534ms",
#   "result": {
#     "total_users_checked": 1,
#     "stalled_users_found": 1,
#     "emails_sent": 1,
#     "emails_failed": 0,
#     ...
#   }
# }
```

### Step 6: Verify Email Delivery

#### MailHog Web UI

Navigate to http://localhost:8025 and check:
- Subject line: "Test User, remember why you started"
- From: test@localhost (or configured SMTP_FROM)
- Body: Contains why & creed in rich HTML format

#### Database Log

```sql
SELECT * FROM email_history
WHERE created_at > NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC;

-- Expected:
-- id: uuid
-- workspace_id: test-ws-1
-- user_email: test@example.com
-- template_type: remember_why
-- status: sent (or failed)
-- sent_at: NOW()
```

## Automated Testing

### Unit Tests: Stall Detection

Create `lib/__tests__/stall-detection.test.ts`:

```typescript
import { isUserStalled, daysSinceDate, classifyStallSeverity } from "@/lib/stall-detection";

describe("Stall Detection", () => {
  it("should detect user with no activity 7+ days", () => {
    const user = {
      noActivityDays: 10,
      sameChapterDays: 2,
      hasWhyAndCreed: true,
      isProfileOldEnough: true,
      isActiveUser: true,
    };

    expect(isUserStalled(user)).toBe(true);
  });

  it("should detect user stuck on same chapter 14+ days", () => {
    const user = {
      noActivityDays: 3,
      sameChapterDays: 20,
      hasWhyAndCreed: true,
      isProfileOldEnough: true,
      isActiveUser: true,
    };

    expect(isUserStalled(user)).toBe(true);
  });

  it("should skip users without why/creed", () => {
    const user = {
      noActivityDays: 10,
      sameChapterDays: 10,
      hasWhyAndCreed: false,
      isProfileOldEnough: true,
      isActiveUser: true,
    };

    expect(isUserStalled(user)).toBe(false);
  });

  it("should classify severity correctly", () => {
    expect(classifyStallSeverity(10)).toBe("mild");
    expect(classifyStallSeverity(30)).toBe("moderate");
    expect(classifyStallSeverity(90)).toBe("severe");
  });

  it("should calculate days since date", () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const days = daysSinceDate(sevenDaysAgo);
    expect(days).toBe(7);

    expect(daysSinceDate(null)).toBe(Infinity);
  });
});
```

Run tests:

```bash
npm run test -- lib/__tests__/stall-detection.test.ts
```

### Integration Tests

Create `app/api/cron/__tests__/why-creed-reminders.integration.test.ts`:

```typescript
import { POST, GET } from "@/app/api/cron/why-creed-reminders/route";
import { NextRequest } from "next/server";

// Note: These are pseudo-tests; adapt to your test framework

describe("Why & Creed Reminders Cron", () => {
  it("should return 401 without CRON_SECRET", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/why-creed-reminders", {
      method: "POST",
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("should return 200 with valid secret", async () => {
    process.env.CRON_SECRET = "test-secret";

    const req = new NextRequest("http://localhost:3000/api/cron/why-creed-reminders", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });

  it("GET should return health status", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/why-creed-reminders?secret=test");

    const response = await GET(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("ready");
  });
});
```

## Debugging Common Issues

### Issue: "Total users checked: 0"

**Diagnosis:**

```sql
-- Check if workspace_why_creed has records
SELECT COUNT(*) FROM workspace_why_creed WHERE deleted_at IS NULL;

-- Check if activity exists
SELECT MAX(created_at) FROM activity_log;

-- Check if any users are old enough
SELECT COUNT(*) FROM users WHERE created_at < NOW() - INTERVAL '3 days';
```

**Fix:** Create test data as shown in Step 1 above.

### Issue: "Emails sent: 0" but "Stalled users found: 5"

**Diagnosis:**

```sql
-- Check email preferences
SELECT * FROM user_email_preferences WHERE opted_out_all = true;

-- Check email history (deduplication)
SELECT * FROM email_history WHERE DATE(sent_at) = CURRENT_DATE;

-- Check SMTP config
echo $SMTP_HOST $SMTP_PORT
```

**Fix:**
- Verify SMTP configuration
- Check that users haven't already received an email today (dedupeKey)
- Check that `opted_out_all` is false

### Issue: "SMTP timeout" errors

**Diagnosis:**

```bash
# Test SMTP connectivity
nc -zv $SMTP_HOST $SMTP_PORT

# Test with telnet (if available)
telnet $SMTP_HOST $SMTP_PORT
```

**Fix:**
- Increase `EMAIL_RATE_LIMIT.BATCH_DELAY_MS` from 1200ms to 2000ms
- Reduce `EMAILS_PER_MINUTE` from 50 to 25
- Check network/firewall rules

### Issue: "Unauthorized: Invalid CRON_SECRET"

**Diagnosis:**

```bash
# Check env var is set
echo $CRON_SECRET

# Check header is correct
curl -v -X POST http://localhost:3000/api/cron/why-creed-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Fix:**
- Ensure `CRON_SECRET` is set in `.env.local`
- Ensure cron service is passing correct Authorization header
- Generate a new secret: `openssl rand -hex 32`

## Performance Testing

### Load Test: 1000 Users

```bash
# Create 1000 test users (caution: slow)
for i in {1..1000}; do
  psql $DATABASE_URL -c "
    INSERT INTO users (email, name, created_at)
    VALUES ('test-$i@example.com', 'Test User $i', NOW() - INTERVAL '30 days');
  "
done

# Run cron job
time curl -X POST http://localhost:3000/api/cron/why-creed-reminders \
  -H "Authorization: Bearer $CRON_SECRET"

# Expected: ~2-4 minutes for 1000 users at 50 emails/min
```

### Database Query Performance

```sql
-- Measure query time
EXPLAIN ANALYZE
SELECT COUNT(*) FROM workspace_why_creed
WHERE deleted_at IS NULL;

-- Expected: < 100ms

-- Check index usage
EXPLAIN SELECT * FROM workspace_why_creed
WHERE workspace_id = '...' AND deleted_at IS NULL;
```

## Monitoring in Production

### Daily Metrics

```sql
-- Emails sent per day
SELECT DATE(sent_at), COUNT(*) as emails_sent
FROM email_history
WHERE status = 'sent'
GROUP BY DATE(sent_at)
ORDER BY DATE DESC;

-- Failure rate
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
FROM email_history
WHERE DATE(sent_at) = CURRENT_DATE;
```

### Alert Conditions

Set up alerts if:
- Job takes > 300 seconds (increase EMAILS_PER_MINUTE)
- Failure rate > 5% (check SMTP logs, email validity)
- 0 users found 3+ days in a row (check data freshness)

## Cleanup

### Delete Test Data

```sql
DELETE FROM activity_log WHERE workspace_id = 'test-ws-1'::uuid;
DELETE FROM enrollments WHERE workspace_id = 'test-ws-1'::uuid;
DELETE FROM workspace_why_creed WHERE workspace_id = 'test-ws-1'::uuid;
DELETE FROM workspaces_users WHERE workspace_id = 'test-ws-1'::uuid;
DELETE FROM workspaces WHERE id = 'test-ws-1'::uuid;
DELETE FROM users WHERE id = 'test-user-1'::uuid;
DELETE FROM email_history WHERE workspace_id = 'test-ws-1'::uuid;
```

### Clear Email History (Optional)

```sql
-- Delete old email history (keep 90 days)
DELETE FROM email_history
WHERE sent_at < NOW() - INTERVAL '90 days';

-- Vacuum to reclaim space
VACUUM FULL email_history;
```
