# Email Preferences Integration Guide

## Overview

ONEVYRT respects user email and notification preferences across all delivery systems. Users can opt out of:

- **Reminder Emails** — Reminder emails (e.g., "check in on your progress")
- **Weekly Digest** — Weekly digest emails (e.g., "here's your week in review")
- **In-App Notifications** — Bell icon notifications
- **Decision Moments** — Decision moment notifications (e.g., "time to review")

All email, SMS, and in-app notification systems must check preferences **before sending** to respect user choice.

## Database

**Table:** `email_preferences`

```sql
CREATE TABLE email_preferences (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  reminder_emails boolean DEFAULT true NOT NULL,
  weekly_digest boolean DEFAULT true NOT NULL,
  in_app_notifications boolean DEFAULT true NOT NULL,
  decision_moments boolean DEFAULT true NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  deleted_at timestamp,  -- Soft delete support
  UNIQUE(workspace_id)
);

CREATE INDEX email_preferences_workspace_id ON email_preferences(workspace_id);
CREATE INDEX email_preferences_deleted_at ON email_preferences(deleted_at);
```

## Library API

### `lib/email-preferences.ts`

#### 1. Get Preferences (with defaults)

```typescript
import { getEmailPreferences } from "@/lib/email-preferences";

// Returns preferences for the workspace, or creates defaults if none exist
const prefs = await getEmailPreferences(workspaceId);
// {
//   id: "...",
//   workspaceId: "...",
//   reminderEmails: true,
//   weeklyDigest: true,
//   inAppNotifications: true,
//   decisionMoments: true,
//   createdAt: "2026-09-03T...",
//   updatedAt: "2026-09-03T..."
// }
```

#### 2. Update Preferences (partial update)

```typescript
import { updateEmailPreferences } from "@/lib/email-preferences";

// Update one or more preferences
const updated = await updateEmailPreferences(workspaceId, {
  reminderEmails: false,  // Opt out of reminder emails
  // Other fields unchanged
});
```

#### 3. Check if Notification is Allowed (MOST IMPORTANT)

```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

// Before sending ANY notification, check:
if (await isNotificationAllowed(workspaceId, "reminder")) {
  // Send reminder email
  await sendReminderEmail(workspaceId, userId);
}

if (await isNotificationAllowed(workspaceId, "digest")) {
  // Send weekly digest
  await sendWeeklyDigest(workspaceId);
}

if (await isNotificationAllowed(workspaceId, "inApp")) {
  // Create in-app notification
  await createNotification({...});
}

if (await isNotificationAllowed(workspaceId, "decision")) {
  // Send decision moment
  await sendDecisionMoment(workspaceId, userId);
}
```

#### 4. Check Multiple Permissions at Once

```typescript
import { checkNotificationPermissions } from "@/lib/email-preferences";

const allowed = await checkNotificationPermissions(workspaceId, [
  "reminder",
  "digest",
  "inApp",
  "decision"
]);
// { reminder: true, digest: false, inApp: true, decision: true }
```

#### 5. Reset to Defaults

```typescript
import { resetToDefaults } from "@/lib/email-preferences";

// Enable all notifications for a workspace
const reset = await resetToDefaults(workspaceId);
```

#### 6. Soft Delete

```typescript
import { deleteEmailPreferences } from "@/lib/email-preferences";

// Soft-delete preferences (they still exist but are marked deleted)
// getEmailPreferences will create new defaults
await deleteEmailPreferences(workspaceId);
```

## Integration Checklist

### Email Systems

All email delivery functions should check preferences:

```typescript
// Before: lib/notifications.ts, lib/cohorts.ts, etc.

// After sending email, check:
if (!await isNotificationAllowed(workspaceId, "reminder")) {
  console.log("User opted out of reminder emails, skipping");
  return;
}

// Send email...
await sendEmail({...});
```

### Job Systems

Jobs that send batch emails/notifications (e.g., `lib/cohorts.ts`, `lib/coach/digest-run.ts`):

```typescript
// In digest job:
for (const workspaceId of allWorkspaceIds) {
  if (await isNotificationAllowed(workspaceId, "digest")) {
    await sendWeeklyDigest(workspaceId);
  }
}
```

### In-App Notifications

Before creating notifications in `lib/notifications.ts`:

```typescript
export async function createNotification(input: {
  userId: string;
  workspaceId?: string;
  type: string;
  // ...
  notificationType?: "reminder" | "digest" | "inApp" | "decision";
}): Promise<Notification | null> {
  // Check preferences if workspaceId provided
  if (input.workspaceId && input.notificationType) {
    const allowed = await isNotificationAllowed(input.workspaceId, input.notificationType);
    if (!allowed) return null; // Silently skip if opted out
  }

  // Create notification...
}
```

### SMS (via Twilio)

```typescript
import { isNotificationAllowed } from "@/lib/email-preferences";

async function sendSMS(workspaceId: string, phoneNumber: string, message: string) {
  // Check if SMS notifications are allowed (map to "reminder" or "digest" as appropriate)
  if (!await isNotificationAllowed(workspaceId, "reminder")) {
    console.log("User opted out of SMS notifications");
    return;
  }

  // Send SMS via Twilio...
}
```

## API Routes

### Fetch Current Preferences

```
GET /api/workspace/:id/email-preferences
```

**Example:**
```bash
curl -X GET https://app.example.com/api/workspace/ws-123/email-preferences
```

**Response:**
```json
{
  "id": "pref-456",
  "workspaceId": "ws-123",
  "reminderEmails": true,
  "weeklyDigest": false,
  "inAppNotifications": true,
  "decisionMoments": true,
  "createdAt": "2026-09-03T10:00:00.000Z",
  "updatedAt": "2026-09-03T10:00:00.000Z"
}
```

### Update Preferences

```
POST /api/workspace/:id/email-preferences
```

**Payload (any combination):**
```json
{
  "reminderEmails": false,
  "weeklyDigest": false
}
```

**Or reset to defaults:**
```json
{
  "resetToDefaults": true
}
```

**Response:** Updated preferences object

**Example:**
```bash
curl -X POST https://app.example.com/api/workspace/ws-123/email-preferences \
  -H "Content-Type: application/json" \
  -d '{"reminderEmails": false, "weeklyDigest": false}'
```

## Component Example

### React Settings Component

```typescript
import { useState, useEffect } from "react";
import { EmailPreferences } from "@/lib/email-preferences";

export function EmailPreferencesForm({ workspaceId }: { workspaceId: string }) {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/workspace/${workspaceId}/email-preferences`)
      .then((r) => r.json())
      .then(setPrefs);
  }, [workspaceId]);

  async function updatePref(key: keyof Omit<EmailPreferences, "id" | "workspaceId" | "createdAt" | "updatedAt">, value: boolean) {
    setSaving(true);
    try {
      const updated = await fetch(`/api/workspace/${workspaceId}/email-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }).then((r) => r.json());
      setPrefs(updated);
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.reminderEmails}
          onChange={(e) => updatePref("reminderEmails", e.target.checked)}
          disabled={saving}
        />
        Reminder Emails
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.weeklyDigest}
          onChange={(e) => updatePref("weeklyDigest", e.target.checked)}
          disabled={saving}
        />
        Weekly Digest
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.inAppNotifications}
          onChange={(e) => updatePref("inAppNotifications", e.target.checked)}
          disabled={saving}
        />
        In-App Notifications
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.decisionMoments}
          onChange={(e) => updatePref("decisionMoments", e.target.checked)}
          disabled={saving}
        />
        Decision Moments
      </label>
    </div>
  );
}
```

## Migration Notes

- Migration: `1802000000000_email-preferences.js`
- Preferences table is purely additive (no breaking changes)
- Default preferences (all enabled) are created automatically on first access
- Soft-delete pattern matches existing pattern (`workspace_why_creed`)
- Uses advisory lock for concurrent safe updates

## Backwards Compatibility

**IMPORTANT:** Existing systems must be updated to respect preferences:

1. Email systems should check `reminderEmails` / `weeklyDigest` before sending
2. In-app notification creation should check `inAppNotifications`
3. Decision moment triggers should check `decisionMoments`
4. SMS should be mapped to either `reminderEmails` or a new type

See "Integration Checklist" above for specific files that need updates.

## Audit Trail

To view preference change history for a workspace:

```typescript
import { getAllPreferencesHistory } from "@/lib/email-preferences";

// Get all preference changes (excluding soft-deleted)
const history = await getAllPreferencesHistory(workspaceId);

// Get all changes including soft-deleted
const fullHistory = await getAllPreferencesHistory(workspaceId, true);
```

## Testing

```typescript
import { getEmailPreferences, updateEmailPreferences, isNotificationAllowed } from "@/lib/email-preferences";

// Test basic flow
const prefs = await getEmailPreferences("test-ws-1");
expect(prefs.reminderEmails).toBe(true); // Default

// Update and verify
await updateEmailPreferences("test-ws-1", { reminderEmails: false });
const updated = await getEmailPreferences("test-ws-1");
expect(updated.reminderEmails).toBe(false);

// Test permission check
const allowed = await isNotificationAllowed("test-ws-1", "reminder");
expect(allowed).toBe(false);
```

## Performance Considerations

- Preferences are lazy-created on first access (no bulk migration needed)
- Advisory locks prevent race conditions but serialize concurrent updates
- Consider caching preferences in memory with cache-busting on updates
- Index on `workspace_id` ensures fast lookups
- Soft-delete pattern allows audit trail while keeping performance

## Future Extensions

- [ ] Per-user overrides (workspace settings + per-user preferences)
- [ ] Notification type granularity (e.g., "course reminders" vs "coaching reminders")
- [ ] Frequency controls (e.g., "digest: daily/weekly/never")
- [ ] Preference groups (e.g., "all transactional", "all marketing")
- [ ] Consent tracking (GDPR compliance)
- [ ] Unsubscribe links in emails
