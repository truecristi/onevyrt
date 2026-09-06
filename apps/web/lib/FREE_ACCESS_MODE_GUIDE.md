# Free-Access Mode API Guide

Complete implementation and integration guide for the Free-Access Mode system. Enables trial/freemium access to the ONEVYRT platform by bypassing programme gates and auto-approving submissions.

---

## Overview

**Free-Access Mode** converts a structured programme with sequential gates and coach-required reviews into a fully self-paced, auto-approved journey. Perfect for:

- **Trial activations** — Free trials for new customers (30-day access)
- **Promotional campaigns** — Limited-time access for lead generation
- **Freemium tiers** — Basic tier with full access but limited features
- **Quality assurance** — Test coaches/content without approval bottlenecks

### What Happens When Free-Access Is Active

| Feature | Normal Mode | Free-Access Mode |
|---------|------------|-----------------|
| **Lesson unlocking** | Sequential + coach approval | All lessons instantly unlocked |
| **Submission review** | Coach approval required | Auto-approved (no waiting) |
| **Coach notifications** | Daily digests, reminders sent | Silently suppressed |
| **Access control** | `accessGranted: true` required | Always granted |
| **Lesson status** | Gated by programme logic | Computed from progress only |

---

## Core Components

### 1. Database Query Helper

```typescript
checkFreeAccessMode(workspaceId: string): Promise<string | null>
```

Checks if a workspace has active free-access and returns the expiry timestamp.

**Returns:**
- ISO 8601 timestamp if active (e.g., `"2026-10-03T12:00:00Z"`)
- `null` if not active or expired

**Caching:**
- Results cached for 5 minutes (default)
- Prevents N queries per request if multiple operations touch the same workspace

**Example:**
```typescript
const expiresAt = await checkFreeAccessMode(workspace.id);
if (expiresAt) {
  console.log(`Free access expires at: ${expiresAt}`);
}
```

### 2. Enrollment Modifier

```typescript
bypassGatesIfFreeAccess(enrollment: Enrollment, isFreeAccess: boolean): Enrollment
```

Modifies an enrollment object to unlock all lessons and bypass sequential gating.

**Mutates in-place:** Returns the same object reference after modification.

**What it does:**
- Sets `lesson.gated = false` for all lessons (no gate check)
- Sets `enrollment.accessGranted = true` (no access pause)

**Example:**
```typescript
let enrollment = await getEnrollment(workspaceId);
const isFreeAccess = await checkFreeAccessMode(workspaceId) !== null;

if (isFreeAccess) {
  bypassGatesIfFreeAccess(enrollment, true);
  // All lessons now unlocked
}
```

### 3. Submission Auto-Approver

```typescript
autoApproveIfFreeAccess(submission: Submission, isFreeAccess: boolean): Submission
```

Marks a submission as instantly approved instead of pending coach review.

**Mutates in-place:** Returns the same object reference after modification.

**Sets:**
- `submission.reviewStatus = "approved"`
- `submission.reviewedAt = [current timestamp]`
- `submission.reviewedBy = "auto (free-access)"`
- `submission.coachFeedback = undefined` (cleared)

**Example:**
```typescript
let submission = {
  id: "abc123",
  evidence: "...",
  reviewStatus: "pending",
};

const isFreeAccess = (await checkFreeAccessMode(wsId)) !== null;
autoApproveIfFreeAccess(submission, isFreeAccess);
// submission.reviewStatus === "approved" now
```

### 4. Coach Notification Suppressor

```typescript
skipCoachNotificationsIfFreeAccess(workspaceId: string, notificationType: string): Promise<boolean>
```

Determines if a coach notification should be suppressed (not sent).

**Returns:**
- `true` if notification should be skipped
- `false` if notification should proceed

**Suppressed notification types:**
- `submission_pending_review` — No coach ping on new submissions
- `learner_stuck` — No "learner stuck" alerts
- `learner_quiet` — No "no activity this week" digests
- `cohort_session_reminder` — No session reminders

**Example:**
```typescript
if (await skipCoachNotificationsIfFreeAccess(wsId, "submission_pending_review")) {
  return; // Don't notify coaches
}

// Proceed with normal notification
await createNotification({ ... });
```

### 5. Context & Integration Helpers

#### Request Context

```typescript
interface FreeAccessContext {
  workspaceId: string;
  isFreeAccess: boolean;
  expiresAt?: string; // ISO 8601
}

injectFreeAccessContext(workspaceId: string): Promise<FreeAccessContext>
```

Create a context object for passing through request handlers.

**Example:**
```typescript
const context = await injectFreeAccessContext(workspace.id);
if (context.isFreeAccess) {
  res.headers.set("X-Free-Access", "true");
  res.headers.set("X-Free-Access-Expires", context.expiresAt || "");
}
```

#### Enrollment State Retrieval

```typescript
getEnrollmentWithFreeAccess(
  workspaceId: string,
  getEnrollmentFn: (wsId: string) => Promise<Enrollment | null>
): Promise<Enrollment | null>
```

Fetch enrollment with gates pre-bypassed if free-access is active.

**Example:**
```typescript
const enrollment = await getEnrollmentWithFreeAccess(
  workspaceId,
  getEnrollment
);
// If free-access is active, all lessons are unlocked
```

---

## Admin Operations

### Enable Free-Access

```typescript
enableFreeAccessMode(workspaceId: string, expiresAt: string): Promise<boolean>
```

Enable free-access for a workspace until a given timestamp.

**Parameters:**
- `workspaceId` — The workspace ID
- `expiresAt` — ISO 8601 datetime (must be in the future)

**Returns:** `true` if successful, `false` if workspace not found.

**Example:**
```typescript
const now = new Date();
const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const success = await enableFreeAccessMode(
  workspace.id,
  thirtyDaysLater.toISOString()
);
```

### Disable Free-Access

```typescript
disableFreeAccessMode(workspaceId: string): Promise<boolean>
```

Disable free-access for a workspace (restore normal gating).

**Returns:** `true` if successful, `false` if workspace not found.

**Example:**
```typescript
await disableFreeAccessMode(workspace.id);
// Normal programme gating and coach review required again
```

### Batch Operations

```typescript
batchUpdateFreeAccessMode(
  workspaceIds: string[],
  expiresAt: string | null
): Promise<number>
```

Enable/disable free-access for multiple workspaces.

**Parameters:**
- `workspaceIds` — Array of workspace IDs
- `expiresAt` — ISO 8601 (set to activate) or `null` (to disable)

**Returns:** Count of successfully updated workspaces.

**Example:**
```typescript
// Enable free-access for 100 trial workspaces
const updated = await batchUpdateFreeAccessMode(
  trialWorkspaceIds,
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
);
console.log(`Updated ${updated} workspaces`);
```

### Listing Active Workspaces

```typescript
listActiveFreeeAccessWorkspaces(limit?: number): Promise<string[]>
```

Find all workspaces currently in free-access mode.

**Returns:** Array of workspace IDs with active free-access.

**Example:**
```typescript
const active = await listActiveFreeeAccessWorkspaces(100);
console.log(`${active.length} workspaces in free-access mode`);
```

---

## API Routes

### POST /api/admin/free-access/enable

Enable free-access for a workspace.

**Request:**
```json
{
  "workspaceId": "abc123def456",
  "expiresAt": "2026-10-03T12:00:00Z"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Free-access enabled until 2026-10-03T12:00:00Z",
  "workspaceId": "abc123def456",
  "expiresAt": "2026-10-03T12:00:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid expiresAt: must be in the future"
}
```

**Status Codes:**
- `200` — Success
- `400` — Invalid request (missing fields, invalid timestamp, etc.)
- `403` — Unauthorized (not admin)
- `404` — Workspace not found
- `500` — Server error

### POST /api/admin/free-access/disable

Disable free-access for a workspace.

**Request:**
```json
{
  "workspaceId": "abc123def456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Free-access disabled",
  "workspaceId": "abc123def456"
}
```

**Status Codes:**
- `200` — Success
- `400` — Invalid request
- `403` — Unauthorized (not admin)
- `404` — Workspace not found
- `500` — Server error

### GET /api/admin/free-access/status?workspaceId=abc123def456

Check free-access status of a workspace.

**Response (Active):**
```json
{
  "success": true,
  "workspaceId": "abc123def456",
  "isFreeAccess": true,
  "expiresAt": "2026-10-03T12:00:00Z",
  "expiresIn": "30 days 12h",
  "message": "Free-access active (expires in 30 days 12h)"
}
```

**Response (Inactive):**
```json
{
  "success": true,
  "workspaceId": "abc123def456",
  "isFreeAccess": false,
  "message": "Free-access is not active"
}
```

---

## Integration Checklist

To fully integrate free-access mode into your codebase:

- [ ] **Database:** Verify `workspaces.plan_metadata` JSONB column exists
- [ ] **lib/enrollments.ts:**
  - [ ] In `submitAssignment()`, check free-access before setting `reviewStatus`
  - [ ] Call `autoApproveIfFreeAccess()` if active
  - [ ] Update lesson status to "approved" (not "submitted")
- [ ] **lib/programme-notifications.ts:**
  - [ ] Before `createNotification()` for coach types, call `skipCoachNotificationsIfFreeAccess()`
  - [ ] Return early if suppressed
- [ ] **API Routes:**
  - [ ] `/api/programme/enrollment`: Call `bypassGatesIfFreeAccess()` before returning enrollment
  - [ ] `/api/coaching/review`: Check free-access in guard clause
  - [ ] `/api/admin/free-access/*`: Create enable/disable/status routes
- [ ] **Middleware:**
  - [ ] Call `injectFreeAccessContext()` in auth/workspace middleware
  - [ ] Attach result to request context for route handlers
- [ ] **Client-side:**
  - [ ] Fetch `isFreeAccess` and `expiresAt` in enrollment response
  - [ ] Show trial badge/banner if free-access is active
  - [ ] Disable coach messaging UI if free-access
- [ ] **Tests:**
  - [ ] Test `checkFreeAccessMode()` with active/expired/missing
  - [ ] Test `autoApproveIfFreeAccess()` mutation
  - [ ] Test routes with admin/non-admin users
  - [ ] Test expiry boundary (now vs. future)

---

## Testing

### Unit Tests

```typescript
describe("Free-Access Mode", () => {
  test("checkFreeAccessMode returns null when inactive", async () => {
    const result = await checkFreeAccessMode("ws-id");
    expect(result).toBeNull();
  });

  test("checkFreeAccessMode returns expiry when active", async () => {
    await enableFreeAccessMode("ws-id", "2026-10-03T12:00:00Z");
    const result = await checkFreeAccessMode("ws-id");
    expect(result).toBe("2026-10-03T12:00:00Z");
  });

  test("bypassGatesIfFreeAccess unlocks all lessons", () => {
    const enrollment = {
      lessons: [
        { lessonId: "1", gated: true },
        { lessonId: "2", gated: true },
      ],
    } as Enrollment;

    bypassGatesIfFreeAccess(enrollment, true);
    expect(enrollment.lessons[0].gated).toBe(false);
    expect(enrollment.lessons[1].gated).toBe(false);
  });

  test("autoApproveIfFreeAccess sets approval status", () => {
    const submission = { reviewStatus: "pending" } as Submission;
    autoApproveIfFreeAccess(submission, true);
    expect(submission.reviewStatus).toBe("approved");
    expect(submission.reviewedBy).toBe("auto (free-access)");
  });

  test("skipCoachNotificationsIfFreeAccess suppresses coach types", async () => {
    await enableFreeAccessMode("ws-id", "2026-10-03T12:00:00Z");
    const skip = await skipCoachNotificationsIfFreeAccess(
      "ws-id",
      "submission_pending_review"
    );
    expect(skip).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe("Free-Access Mode Routes", () => {
  test("POST /api/admin/free-access/enable enables access", async () => {
    const res = await fetch("/api/admin/free-access/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws-id",
        expiresAt: "2026-10-03T12:00:00Z",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("POST /api/admin/free-access/enable rejects past dates", async () => {
    const res = await fetch("/api/admin/free-access/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws-id",
        expiresAt: "2020-01-01T00:00:00Z", // Past
      }),
    });

    expect(res.status).toBe(400);
  });

  test("GET /api/admin/free-access/status returns active status", async () => {
    await enableFreeAccessMode("ws-id", "2026-10-03T12:00:00Z");

    const res = await fetch(
      "/api/admin/free-access/status?workspaceId=ws-id"
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isFreeAccess).toBe(true);
    expect(data.expiresIn).toBeDefined();
  });
});
```

### Manual Testing

1. **Enable free-access:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/free-access/enable \
     -H "Content-Type: application/json" \
     -d '{
       "workspaceId": "test-ws-id",
       "expiresAt": "2026-10-03T12:00:00Z"
     }'
   ```

2. **Check status:**
   ```bash
   curl http://localhost:3000/api/admin/free-access/status?workspaceId=test-ws-id
   ```

3. **Disable free-access:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/free-access/disable \
     -H "Content-Type: application/json" \
     -d '{"workspaceId": "test-ws-id"}'
   ```

4. **Verify in database:**
   ```sql
   SELECT id, plan_metadata->>'free_access_until' as free_access_until
   FROM workspaces
   WHERE id = 'test-ws-id';
   ```

---

## Troubleshooting

### "Free-access check always returns null"

**Cause:** The `plan_metadata` column doesn't exist.

**Fix:** Run migration to add the column:
```sql
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS plan_metadata jsonb DEFAULT '{}'::jsonb;
```

### "Cache not clearing after enabling/disabling"

**Cause:** `clearFreeAccessCache()` not called after database update.

**Fix:** Ensure all `enableFreeAccessMode()` and `disableFreeAccessMode()` calls are followed by cache clearing (already done in the functions themselves).

### "Submissions still pending after enabling free-access"

**Cause:** Existing submissions were created before free-access was enabled.

**Fix:** Auto-approval only applies to NEW submissions. Existing pending submissions remain unchanged.

**Solution:**
- Manually approve existing submissions via coach review
- Or call `resetLessonSubmissions()` to clear pending (learner can resubmit)

### "Coach notifications still sending"

**Cause:** `skipCoachNotificationsIfFreeAccess()` not called in notification flow.

**Fix:** Add check in `lib/programme-notifications.ts`:
```typescript
if (await skipCoachNotificationsIfFreeAccess(wsId, "submission_pending_review")) {
  return; // Skip notification
}
```

### "Expiry timestamp validation fails"

**Cause:** Invalid ISO 8601 format or non-UTC timezone.

**Fix:** Use one of these formats:
- `2026-10-03T12:00:00Z` (UTC, Z suffix)
- `2026-10-03T12:00:00+00:00` (Explicit UTC offset)
- `new Date().toISOString()` (Node.js, always UTC)

---

## Performance Considerations

### Caching

Free-access checks are cached for **5 minutes** per workspace. This reduces database load during high concurrency:

- Learner submits assignment (1 query to check free-access, cached)
- Lesson unlocked (0 queries, cache hit)
- Notification created (0 queries, cache hit)
- Later request from different user (cache hit)

**Cache cleared when:**
- `enableFreeAccessMode()` called
- `disableFreeAccessMode()` called
- `batchUpdateFreeAccessMode()` called
- TTL expires (5 minutes)

### Database Queries

All operations use **single-query** patterns:

- Check free-access: 1 query
- Enable/disable: 1 query
- Batch update: 1 query (N rows)

No multi-pass reads or write-then-read patterns.

### Notification Suppression

Notifications are checked BEFORE creation:

```typescript
// Skip check happens first (1 DB query)
if (await skipCoachNotificationsIfFreeAccess(wsId, type)) {
  return; // No notification, no database insert
}

// Only if NOT skipped, create notification
await createNotification(...);
```

This prevents unnecessary inserts.

---

## Production Deployment

### Pre-deployment Checklist

- [ ] Database migration applied (if new column needed)
- [ ] Index created on `plan_metadata->>'free_access_until'`
- [ ] All integration points updated in `lib/enrollments.ts`
- [ ] All integration points updated in `lib/programme-notifications.ts`
- [ ] Admin routes deployed (`/api/admin/free-access/*`)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Staging environment validated
- [ ] Rollback plan documented

### Monitoring

Add observability for free-access mode:

```typescript
// In enable/disable routes
console.log(
  `[free-access] Workspace ${workspaceId} status changed: ${before} → ${after}`
);

// In submission auto-approval
console.log(
  `[free-access] Auto-approved submission ${submissionId} in workspace ${wsId}`
);

// In notification suppression
console.log(
  `[free-access] Suppressed ${type} notification for workspace ${wsId}`
);
```

### Metrics to Track

- Number of active free-access workspaces
- Submissions auto-approved (vs. normal coach review)
- Notifications suppressed (vs. sent)
- Cache hit rate
- Database query count

---

## Migration From Trial Routes

If you have existing trial activation logic, migrate to free-access mode:

**Before:**
```typescript
// Custom trial logic scattered across routes
if (workspace.plan === "trial") {
  // Unlock lessons
  // Auto-approve submissions
  // Skip notifications
}
```

**After:**
```typescript
// Centralized, reusable API
const isFreeAccess = (await checkFreeAccessMode(wsId)) !== null;
bypassGatesIfFreeAccess(enrollment, isFreeAccess);
autoApproveIfFreeAccess(submission, isFreeAccess);
if (await skipCoachNotificationsIfFreeAccess(wsId, type)) return;
```

---

## Frequently Asked Questions

**Q: Can I enable free-access retroactively for a learner who already started?**

A: Yes. Call `enableFreeAccessMode()` and new submissions will auto-approve. Existing pending submissions remain unchanged (call `resetLessonSubmissions()` to clear them).

**Q: What happens when free-access expires?**

A: Next time free-access is checked (next submission, page load), it will return `null` and normal gating resumes. No automatic notification to learner is sent.

**Q: Can a learner see they're in free-access mode?**

A: Yes, if you expose `isFreeAccess` and `expiresAt` in the enrollment response. Up to you whether to show a banner.

**Q: Does free-access bypass all coach functionality?**

A: No, only notifications and gating. Coaches can still view the workspace and send messages (but learners won't get "submission pending" notifications).

**Q: Can I set a different expiry for each chapter?**

A: No, free-access is workspace-scoped. You'd need to track per-chapter expiries in `plan_metadata` separately.

---

## Files

| File | Purpose |
|------|---------|
| `lib/free-access-mode.ts` | Core API implementation |
| `lib/free-access-integration-examples.ts` | Integration patterns |
| `app/api/admin/free-access/enable/route.ts` | Enable endpoint |
| `app/api/admin/free-access/disable/route.ts` | Disable endpoint |
| `app/api/admin/free-access/status/route.ts` | Status check endpoint |
| `lib/FREE_ACCESS_MODE_GUIDE.md` | This document |

---

## Support

For issues or questions:

1. Check the **Troubleshooting** section
2. Review the **Integration Checklist**
3. Run the **Manual Testing** steps
4. Check database state directly:
   ```sql
   SELECT id, plan_metadata FROM workspaces
   WHERE plan_metadata->>'free_access_until' IS NOT NULL;
   ```

---

*Last updated: 2026-09-03*
