# Email Preferences Integration Examples

This file shows practical examples of how to integrate email preferences into existing notification and email systems.

## Example 1: Reminder Email System

**File:** `lib/notifications.ts` (existing)

**Before:**
```typescript
export async function sendReminderEmail(userId: string, workspaceId: string) {
  const user = await getUser(userId);
  // Always send regardless of preferences
  await mailer.send({
    to: user.email,
    subject: "Check in on your progress",
    template: "reminder",
  });
}
```

**After:**
```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

export async function sendReminderEmail(userId: string, workspaceId: string) {
  // Check preferences first
  if (!await isNotificationAllowed(workspaceId, "reminder")) {
    console.log(`[Reminder] Skipping for ${workspaceId}: user opted out`);
    return;
  }

  const user = await getUser(userId);
  await mailer.send({
    to: user.email,
    subject: "Check in on your progress",
    template: "reminder",
  });
}
```

## Example 2: Weekly Digest Job

**File:** `lib/coach/digest-run.ts` (existing)

**Before:**
```typescript
export async function runWeeklyDigest() {
  const cohorts = await listAllCohorts();
  
  for (const cohort of cohorts) {
    // Send digest to all cohort members
    await sendDigestEmail(cohort.memberIds);
  }
}
```

**After:**
```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

export async function runWeeklyDigest() {
  const cohorts = await listAllCohorts();
  
  for (const cohort of cohorts) {
    const validMembers = [];
    
    // Filter members by preference
    for (const memberId of cohort.memberIds) {
      const workspace = await getWorkspaceForUser(memberId);
      if (await isNotificationAllowed(workspace.id, "digest")) {
        validMembers.push(memberId);
      }
    }
    
    if (validMembers.length > 0) {
      await sendDigestEmail(validMembers);
    }
  }
}
```

## Example 3: In-App Notifications

**File:** `lib/notifications.ts` (existing)

**Before:**
```typescript
export async function createNotification(input: {
  userId: string;
  workspaceId?: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  dedupeKey?: string;
}): Promise<Notification | null> {
  // Create notification without checking preferences
  const id = randomBytes(8).toString("hex");
  const res = await pgPool().query(
    `INSERT INTO notifications (...) VALUES (...)`,
    // ...
  );
  return res.rows[0] ? rowToNotification(res.rows[0]) : null;
}
```

**After:**
```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

export async function createNotification(input: {
  userId: string;
  workspaceId?: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  dedupeKey?: string;
  // New optional field for preference checking
  notificationType?: "reminder" | "digest" | "inApp" | "decision";
}): Promise<Notification | null> {
  // Check preferences if workspace provided
  if (input.workspaceId && input.notificationType) {
    if (!await isNotificationAllowed(input.workspaceId, input.notificationType)) {
      console.log(`[InApp] Skipping ${input.type}: user opted out`);
      return null; // Return null to indicate it was skipped
    }
  }

  const id = randomBytes(8).toString("hex");
  const res = await pgPool().query(
    `INSERT INTO notifications (...) VALUES (...)`,
    // ...
  );
  return res.rows[0] ? rowToNotification(res.rows[0]) : null;
}
```

**Usage:**
```typescript
// Create a decision moment notification
await createNotification({
  userId: "user-123",
  workspaceId: "ws-456",
  type: "decision_moment",
  title: "Time to review",
  body: "Your weekly review awaits",
  notificationType: "decision", // Will be checked
});
```

## Example 4: SMS Notifications (Twilio)

**File:** `lib/acquisition/otp.ts` (existing)

**Before:**
```typescript
export async function sendOTPViaSMS(phoneNumber: string, code: string) {
  // Always send without checking preferences
  const twilio = getTwilioClient();
  await twilio.messages.create({
    body: `Your verification code is: ${code}`,
    from: process.env.TWILIO_PHONE,
    to: phoneNumber,
  });
}
```

**After:**
```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

export async function sendOTPViaSMS(
  workspaceId: string,
  phoneNumber: string,
  code: string
) {
  // Check if SMS/reminder notifications are allowed
  // (map SMS to reminder preference category)
  if (!await isNotificationAllowed(workspaceId, "reminder")) {
    console.log(`[SMS] Skipping for ${workspaceId}: user opted out`);
    return;
  }

  const twilio = getTwilioClient();
  await twilio.messages.create({
    body: `Your verification code is: ${code}`,
    from: process.env.TWILIO_PHONE,
    to: phoneNumber,
  });
}
```

## Example 5: Batch Email Sender

**File:** `lib/jobs.ts` or new `lib/batch-email.ts`

```typescript
import { isNotificationAllowed, checkNotificationPermissions } from "@/lib/email-preferences";

interface BatchEmailConfig {
  type: "reminder" | "digest" | "inApp" | "decision";
  recipients: Array<{ userId: string; workspaceId: string; email: string }>;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export async function sendBatchEmail(config: BatchEmailConfig) {
  const { type, recipients, subject, template, data } = config;

  // Build a map of workspace -> recipients
  const byWorkspace = new Map<string, typeof recipients>();
  for (const recipient of recipients) {
    if (!byWorkspace.has(recipient.workspaceId)) {
      byWorkspace.set(recipient.workspaceId, []);
    }
    byWorkspace.get(recipient.workspaceId)!.push(recipient);
  }

  // Filter by preferences
  let totalSent = 0;
  let totalSkipped = 0;

  for (const [workspaceId, workspaceRecipients] of byWorkspace.entries()) {
    if (!await isNotificationAllowed(workspaceId, type)) {
      console.log(`[Batch] Skipping ${workspaceRecipients.length} for ${workspaceId}: opted out of ${type}`);
      totalSkipped += workspaceRecipients.length;
      continue;
    }

    // Send to all recipients in this workspace
    for (const recipient of workspaceRecipients) {
      try {
        await mailer.send({
          to: recipient.email,
          subject,
          template,
          data,
        });
        totalSent++;
      } catch (error) {
        console.error(`Failed to send ${type} email to ${recipient.email}:`, error);
      }
    }
  }

  console.log(`[Batch] Sent ${totalSent}, skipped ${totalSkipped} for ${type}`);
}
```

**Usage:**
```typescript
// Send weekly digest emails
await sendBatchEmail({
  type: "digest",
  recipients: [
    { userId: "u1", workspaceId: "ws1", email: "user1@example.com" },
    { userId: "u2", workspaceId: "ws1", email: "user2@example.com" },
    { userId: "u3", workspaceId: "ws2", email: "user3@example.com" },
  ],
  subject: "Your Weekly Digest",
  template: "weekly-digest",
  data: { week: "Sep 1-7" },
});
```

## Example 6: Cohort Session Reminders

**File:** `lib/cohorts.ts` (existing)

**Before:**
```typescript
export async function remindCohortMembers(cohortId: string) {
  const cohort = await getCohort(cohortId);
  const members = cohort.memberIds;

  for (const memberId of members) {
    const user = await getUser(memberId);
    // Send reminder without checking preferences
    await mailer.send({
      to: user.email,
      subject: "Upcoming cohort session",
      // ...
    });
  }
}
```

**After:**
```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

export async function remindCohortMembers(cohortId: string) {
  const cohort = await getCohort(cohortId);
  const members = cohort.memberIds;

  for (const memberId of members) {
    const user = await getUser(memberId);
    const workspace = await getWorkspaceForUser(memberId);

    // Check preferences before sending
    if (!await isNotificationAllowed(workspace.id, "reminder")) {
      console.log(`[Cohort] Skipping reminder for ${memberId}: opted out`);
      continue;
    }

    await mailer.send({
      to: user.email,
      subject: "Upcoming cohort session",
      // ...
    });
  }
}
```

## Example 7: Decision Moment Triggers

**File:** `lib/programme-engagement.ts` (hypothetical)

```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

/**
 * Sends a "decision moment" notification when a learner needs to make a choice
 * (e.g., approve a submission, choose a next step)
 */
export async function triggerDecisionMoment(
  userId: string,
  workspaceId: string,
  config: {
    type: "chapter_submission" | "payment_required" | "next_step";
    title: string;
    body: string;
    actionUrl: string;
  }
) {
  // Check if decision moment notifications are enabled
  if (!await isNotificationAllowed(workspaceId, "decision")) {
    console.log(`[Decision] Skipping for ${workspaceId}: opted out`);
    return;
  }

  const user = await getUser(userId);

  // Send both in-app and email for decision moments
  await createNotification({
    userId,
    workspaceId,
    type: config.type,
    title: config.title,
    body: config.body,
    linkUrl: config.actionUrl,
    notificationType: "decision",
  });

  // Also send email if preferences allow
  if (await isNotificationAllowed(workspaceId, "reminder")) {
    await mailer.send({
      to: user.email,
      subject: config.title,
      template: "decision-moment",
      data: {
        body: config.body,
        actionUrl: config.actionUrl,
      },
    });
  }
}
```

**Usage:**
```typescript
// Trigger a decision moment for chapter submission approval
await triggerDecisionMoment(userId, workspaceId, {
  type: "chapter_submission",
  title: "Chapter 1 Ready for Review",
  body: "Your Business Psychology Blueprint is ready for coach review",
  actionUrl: "/coaching?chapter=1",
});
```

## Example 8: Admin Preference Audit

**File:** `app/api/admin/workspace-preferences/route.ts` (new admin endpoint)

```typescript
import { getAllPreferencesHistory } from "@/lib/email-preferences";

export async function GET(req: NextRequest, { params }: { params: { workspaceId: string } }) {
  // Admin-only endpoint (add auth check)
  const user = await currentUser(req.headers.get("cookie"));
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { workspaceId } = params;

  // Get full audit trail including soft-deleted records
  const history = await getAllPreferencesHistory(workspaceId, true);

  return NextResponse.json({
    workspaceId,
    current: history[0],
    history,
  });
}
```

## Integration Checklist

Use this checklist when adding email preference checks to existing systems:

- [ ] Identify the notification/email system (reminder, digest, in-app, decision)
- [ ] Add import: `import { isNotificationAllowed } from "@/lib/email-preferences";`
- [ ] Before sending, check: `if (!await isNotificationAllowed(workspaceId, "type")) return;`
- [ ] For batch operations, filter recipients by workspace and preference
- [ ] Log when skipping notifications due to preferences
- [ ] Test that opting out actually prevents delivery
- [ ] Update integration documentation if the system's behavior changes

## Testing Email Preferences

```typescript
import { updateEmailPreferences, isNotificationAllowed } from "@/lib/email-preferences";

// Test setup
const testWorkspace = "test-ws-123";

// Test 1: Disable reminder emails
await updateEmailPreferences(testWorkspace, { reminderEmails: false });
const allowed = await isNotificationAllowed(testWorkspace, "reminder");
console.assert(!allowed, "Reminder emails should be disabled");

// Test 2: Digest still enabled
const digestAllowed = await isNotificationAllowed(testWorkspace, "digest");
console.assert(digestAllowed, "Digest should still be enabled");

// Test 3: Reset and verify all are enabled
await resetToDefaults(testWorkspace);
const allAllowed = await Promise.all([
  isNotificationAllowed(testWorkspace, "reminder"),
  isNotificationAllowed(testWorkspace, "digest"),
  isNotificationAllowed(testWorkspace, "inApp"),
  isNotificationAllowed(testWorkspace, "decision"),
]);
console.assert(allAllowed.every(x => x), "All should be enabled after reset");
```
