# Email Template System

Comprehensive email and notification template system for ONEVYRT, handling all transactional and programme-related communications.

## Overview

The email template system provides:

1. **Reusable Components** - Type-safe React components for consistent email styling
2. **Email Templates** - Pre-built templates for all major user flows
3. **Template Renderer** - Converts React templates to HTML + plain text
4. **Email Queue** - Database-backed queue with retry logic and scheduling
5. **Email Processor** - Job that sends queued emails and handles failures
6. **Preview API** - HTTP endpoint for testing and visual inspection

## Architecture

```
┌─────────────────────┐
│   Email Queued      │  (queueEmail, queueEmailBatch)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   email_queue       │  PostgreSQL table
│   (pending emails)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Cron Job          │  (processSendQueuedEmails)
│   send-queued-...   │  Called by daily tick
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Render Template   │  React -> HTML + plain text
│   (renderTemplate)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Send Mail         │  SMTP or Resend
│   (sendMail)        │  from lib/mailer.ts
└─────────────────────┘
```

## Components

### Reusable Email Components (`components/email/`)

```typescript
import {
  EmailWrapper,
  Section,
  Card,
  Button,
  Link,
  Heading,
  Paragraph,
  ChapterStatus,
  ProgressBar,
  Divider,
} from "@/components/email";
```

**EmailWrapper**
- Header with branding
- Main content area
- Footer with links

**Section & Card**
- Flexible layout containers
- Customizable backgrounds and borders

**Button & Link**
- Styled CTAs
- Consistent color schemes

**Heading & Paragraph**
- Semantic text elements
- Preset sizes and colors

**ChapterStatus**
- Badge showing chapter approval status
- Color-coded states (pending, approved, rejected)

**ProgressBar**
- Visual progress indicator
- Completion percentage

**Divider**
- Visual section separator

### Email Templates (`lib/email-templates/`)

#### Welcome Templates
- `WelcomeNewUserTemplate` - New user signup
- `WelcomeNewWorkspaceTemplate` - New workspace creation

#### Chapter Notifications
- `ChapterSubmissionNotification` - To coaches when learner submits
- `ChapterApprovedNotification` - To learner when coach approves
- `ChapterRevisionRequestedNotification` - To learner when revision needed

#### Coaching Templates
- `CoachMessageNotification` - Direct message from coach
- `WeeklyCoachDigest` - Weekly summary for coaches
- `CohortSessionReminder` - Reminder for upcoming cohort session
- `CoachingReminder` - Engagement reminders (stalled, incomplete, deadline)

#### Milestone & Progress Templates
- `MilestoneAchieved` - Achievement notifications
- `JourneyProgress` - Regular progress updates
- `GrowthPlanUpdate` - Growth plan notifications
- `TransformationReportReady` - Final report delivery

## Usage

### Basic Template Rendering

```typescript
import { renderTemplate } from "@/lib/email-templates";
import { WelcomeNewUserTemplate } from "@/lib/email-templates/welcome-template";

const rendered = renderTemplate(
  <WelcomeNewUserTemplate
    name="John Doe"
    verificationLink="https://..."
    appUrl="https://onevyrt.masteryresearch.com"
  />,
  "Welcome to ONEVYRT!"
);

console.log(rendered.html);  // Full HTML with wrapper
console.log(rendered.text);  // Plain text version
```

### Queueing an Email

```typescript
import { queueEmail } from "@/lib/email-templates/queue";

await queueEmail({
  templateId: "welcome-user",
  to: "user@example.com",
  name: "John Doe",
  data: {
    name: "John Doe",
    verificationLink: "https://...",
    appUrl: "https://onevyrt.masteryresearch.com",
  },
  // Optional: schedule for later
  scheduledFor: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
});
```

### Batch Queueing

```typescript
import { queueEmailBatch } from "@/lib/email-templates/queue";

const emails = cohortMembers.map((member) => ({
  templateId: "cohort-session-reminder",
  to: member.email,
  name: member.name,
  data: {
    learnerName: member.name,
    coachName: "Coach Sarah",
    sessionDate: "September 5, 2026",
    sessionTime: "3:00 PM UTC",
    sessionTopic: "Chapter 1 Clinic",
    joinLink: "https://...",
    appUrl: "https://onevyrt.masteryresearch.com",
    hoursUntilSession: 24,
  },
}));

await queueEmailBatch(emails);
```

### Custom Templates

```typescript
// Create a new template by composing components
import { EmailWrapper, Heading, Paragraph, Button } from "@/components/email";

export function CustomTemplate({ name, actionLink }: Props) {
  return (
    <EmailWrapper>
      <Heading level={2}>Hello, {name}!</Heading>
      <Paragraph>This is your custom email.</Paragraph>
      <Button href={actionLink}>Take Action</Button>
    </EmailWrapper>
  );
}

// Use it
const rendered = renderTemplate(
  <CustomTemplate name="John" actionLink="https://..." />,
  "Subject Line"
);
```

## Database Schema

### email_queue Table

```sql
CREATE TABLE email_queue (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,           -- Template identifier
  to_email TEXT NOT NULL,              -- Recipient email
  recipient_name TEXT,                 -- Display name
  data JSONB NOT NULL,                 -- Template data
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  error TEXT,                          -- Error message if failed
  sent_at TIMESTAMP,                   -- When successfully sent
  created_at TIMESTAMP NOT NULL,       -- Queue timestamp
  scheduled_for TIMESTAMP,             -- When to send
  retries INTEGER NOT NULL DEFAULT 0,  -- Number of retry attempts
  last_retry_at TIMESTAMP              -- Last retry attempt
);

-- Indexes for performance
CREATE INDEX email_queue_status_scheduled_idx ON email_queue(status, scheduled_for);
CREATE INDEX email_queue_created_at_idx ON email_queue(created_at DESC);
CREATE INDEX email_queue_to_email_idx ON email_queue(to_email);
CREATE INDEX email_queue_template_id_idx ON email_queue(template_id);
```

## Job: Send Queued Emails

The `processSendQueuedEmails()` job:

1. Fetches pending emails (batches of 50)
2. Renders each template with its data
3. Sends via SMTP or Resend
4. Marks as sent or failed
5. Retries failed emails (up to 3 times)
6. Cleans up old records (30-day retention)

**Called by:** Daily cron job (`api/cron/tick`)
**Status:** Logs to console with counts

```typescript
import { processSendQueuedEmails } from "@/lib/jobs/send-queued-emails";

const result = await processSendQueuedEmails();
// {
//   processed: 25,
//   sent: 23,
//   failed: 2,
//   errors: [...]
// }
```

## Email Preview API

Test and preview templates without sending:

```
GET /api/email/preview?template=welcome-user&name=John&format=html
GET /api/email/preview?template=chapter-approved&format=text
GET /api/email/preview?template=milestone-achieved&format=json
```

**Query Parameters:**
- `template` (required) - Template ID
- `format` (optional) - `html` (default), `text`, or `json`
- `name` - Recipient name
- `chapterNumber` - For chapter templates
- Any template-specific parameters

**Supported Templates:**
- `welcome-user`
- `chapter-approved`
- `milestone-achieved`

Add more templates to `/api/email/preview/route.ts` as needed.

## Configuration

### Email Provider

Configure via environment variables:

**SMTP:**
```env
MAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false          # false for STARTTLS, true for implicit TLS
SMTP_USERNAME=user@example.com
SMTP_PASSWORD=password
SMTP_FROM_EMAIL=noreply@onevyrt.com
SMTP_FROM_NAME=ONEVYRT
```

**Resend:**
```env
RESEND_API_KEY=re_xxx...
MAIL_FROM=noreply@onevyrt.com
```

### Queue Behavior

- **Max Retries:** 3 (configurable in `send-queued-emails.ts`)
- **Retention:** 30 days for processed emails
- **Batch Size:** 50 emails per job iteration
- **Scheduling:** Optional `scheduledFor` parameter delays delivery

## Best Practices

### 1. Always Queue, Never Send Directly

```typescript
// ❌ Don't do this in request handlers
await sendMail({ to: "...", subject: "...", text: "..." });

// ✅ Queue it instead
await queueEmail({
  templateId: "...",
  to: "...",
  name: "...",
  data: { ... },
});
```

This ensures:
- Non-blocking request handling
- Automatic retry on failure
- Audit trail in database
- Easy replay if provider fails

### 2. Use Template Data, Not Computed Values

```typescript
// ✅ Queue with raw data
await queueEmail({
  templateId: "chapter-approved",
  to: learner.email,
  data: {
    learnerName: learner.name,
    chapterNumber: chapter.number,
    chapterName: chapter.name,
    // ... pass raw values
  },
});

// Template handles formatting/computation
```

### 3. Test via Preview API

```bash
# Test welcome template
curl "http://localhost:3000/api/email/preview?template=welcome-user&name=Test&format=html"

# Check plain text version
curl "http://localhost:3000/api/email/preview?template=welcome-user&format=text"

# Get JSON structure
curl "http://localhost:3000/api/email/preview?template=chapter-approved&format=json"
```

### 4. Schedule for Off-Peak Times

```typescript
// Send immediately
await queueEmail({ templateId: "...", to: "...", data: {} });

// Schedule for tomorrow at 2 AM
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(2, 0, 0, 0);

await queueEmail({
  templateId: "...",
  to: "...",
  data: {},
  scheduledFor: tomorrow,
});
```

### 5. Batch Operations

```typescript
// Sending to 1000+ recipients? Use batch
const recipients = await db.query("SELECT * FROM learners");

for (let i = 0; i < recipients.length; i += 100) {
  const batch = recipients.slice(i, i + 100);
  await queueEmailBatch(
    batch.map((r) => ({
      templateId: "weekly-digest",
      to: r.email,
      name: r.name,
      data: { ... },
    }))
  );
}
```

## Adding New Templates

### 1. Create Template Component

```typescript
// lib/email-templates/my-new-template.tsx
export function MyNewTemplate({ prop1, prop2 }: Props) {
  return (
    <EmailWrapper>
      <Heading level={2}>Hello!</Heading>
      <Paragraph>{prop1}</Paragraph>
      <Button href="#">Click here</Button>
    </EmailWrapper>
  );
}
```

### 2. Add to Index

```typescript
// lib/email-templates/index.ts
export { MyNewTemplate } from "./my-new-template";
```

### 3. Handle in Job Processor

```typescript
// lib/jobs/send-queued-emails.ts
case "my-new-template":
  component = (
    <MyNewTemplate
      prop1={String(data.prop1 || "")}
      prop2={String(data.prop2 || "")}
    />
  );
  subject = "Your Subject";
  break;
```

### 4. Add to Preview API (Optional)

```typescript
// app/api/email/preview/route.ts
case "my-new-template":
  renderedTemplate = renderTemplate(
    <MyNewTemplate prop1={params.prop1 || "default"} prop2={...} />,
    "Subject"
  );
  break;
```

### 5. Queue from Application

```typescript
await queueEmail({
  templateId: "my-new-template",
  to: email,
  name: name,
  data: {
    prop1: "value1",
    prop2: "value2",
  },
});
```

## Monitoring

### Check Queue Status

```typescript
import { listQueuedEmails } from "@/lib/email-templates/queue";

// All pending
const { items, total } = await listQueuedEmails("pending");

// Recently sent
const { items, total } = await listQueuedEmails("sent", 20, 0);

// Failed
const { items, total } = await listQueuedEmails("failed");
```

### Get Specific Email

```typescript
import { getQueuedEmail } from "@/lib/email-templates/queue";

const queued = await getQueuedEmail(emailId);
console.log(queued.status, queued.error);
```

### View Logs

The `processSendQueuedEmails()` job logs to console:

```
[email-job] Completed: 50 processed, 48 sent, 2 failed
[email-job] Cleaned up 120 old email records
```

## Troubleshooting

### Emails Not Sending

1. **Check queue status:** `SELECT * FROM email_queue WHERE status = 'pending' LIMIT 10;`
2. **Check for errors:** `SELECT * FROM email_queue WHERE status = 'failed';`
3. **Verify job runs:** Check logs for `[email-job]` entries
4. **Test render:** `GET /api/email/preview?template=...`
5. **Verify SMTP:** Check `MAIL_ENABLED`, `SMTP_HOST`, etc.

### High Failure Rate

- Check SMTP credentials
- Verify recipient addresses are valid
- Check email provider rate limits
- Review error messages in `error` column

### Old Emails Accumulating

The cleanup job runs daily. If emails aren't cleaning up:

```typescript
import { cleanupOldEmails } from "@/lib/email-templates/queue";

// Manual cleanup (30 days)
const count = await cleanupOldEmails(30);
console.log(`Cleaned up ${count} emails`);
```

## Testing

### Unit Testing Templates

```typescript
import { render } from "@testing-library/react";
import { renderTemplate } from "@/lib/email-templates";
import { MyTemplate } from "@/lib/email-templates/my-template";

test("renders template correctly", () => {
  const rendered = renderTemplate(
    <MyTemplate name="Test" />,
    "Subject"
  );

  expect(rendered.html).toContain("Test");
  expect(rendered.text).toContain("Test");
  expect(rendered.subject).toBe("Subject");
});
```

### Integration Testing

```typescript
test("queues and processes email", async () => {
  await queueEmail({
    templateId: "welcome-user",
    to: "test@example.com",
    data: { ... },
  });

  const pending = await getPendingEmails();
  expect(pending).toHaveLength(1);

  // In real test, would call processSendQueuedEmails()
});
```

## Future Enhancements

- [ ] Email analytics (opens, clicks)
- [ ] A/B testing for subject lines
- [ ] Dynamic template blocks
- [ ] Unsubscribe preferences per learner
- [ ] Email delivery status webhooks
- [ ] Template versioning
- [ ] Drag-and-drop template builder
