# Analytics Integration Guide

This guide shows how to integrate event tracking into existing ONEVYRT pages and API routes.

## Quick Start

### 1. Track Page Views (Automatic)

Simply use the `useTracking` hook in your component:

```typescript
// app/programme/chapter-1/page.tsx
"use client";

import { useTracking } from "@/lib/hooks/useTracking";

export default function ChapterPage({ userId, workspaceId }) {
  // Page views are automatically tracked
  useTracking({ userId, workspaceId });

  return <div>Chapter content...</div>;
}
```

### 2. Track User Actions

```typescript
// components/SubmitButton.tsx
"use client";

import { useTrackClick } from "@/lib/hooks/useTracking";

export function SubmitChapterButton({ userId, workspaceId, chapterId }) {
  const trackClick = useTrackClick("submit_chapter", "button_click", {
    userId,
    workspaceId,
  });

  const handleClick = async () => {
    await trackClick({ chapter_id: chapterId });
    // ... submit chapter
  };

  return <button onClick={handleClick}>Submit Chapter</button>;
}
```

### 3. Track Form Submissions

```typescript
// components/ChapterForm.tsx
"use client";

import { useTrackFormSubmit } from "@/lib/hooks/useTracking";

export function ChapterForm({ userId, workspaceId }) {
  const trackSubmit = useTrackFormSubmit("chapter_form", { userId, workspaceId });

  const handleSubmit = async (formData) => {
    await trackSubmit({
      fields_filled: Object.keys(formData).length,
      timestamp: new Date().toISOString(),
    });

    // ... submit form
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 4. Track Conversions

```typescript
// components/ChapterCompletion.tsx
"use client";

import { useTracking } from "@/lib/hooks/useTracking";

export function ChapterCompletion({ userId, workspaceId, chapter }) {
  const { trackConversion } = useTracking({ userId, workspaceId });

  const handleComplete = async () => {
    await trackConversion({
      conversionType: "chapter_completed",
      conversionName: chapter.title,
      sourcePage: `/programme/${chapter.id}`,
      funnelStage: "decision",
    });

    // Redirect or show success
  };

  return <button onClick={handleComplete}>Complete Chapter</button>;
}
```

## Integration Patterns

### Pattern 1: Tracking API Route Calls

```typescript
// app/api/programme/submit/route.ts
import { withTracking } from "@/lib/middleware/track-api-calls";

async function handler(req: Request) {
  const { chapterId } = await req.json();
  
  // ... submit chapter
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const POST = withTracking(handler, {
  actionName: "submit_chapter",
  metricName: "submit_chapter_api",
});
```

### Pattern 2: Tracking with Manual Calls

```typescript
// app/api/programme/submit/route.ts
import { trackConversion, trackPerformance } from "@/lib/analytics-extended";
import { trackEventAllIntegrationsServer } from "@/lib/integrations/analytics-integrations";

export async function POST(req: Request) {
  const user = await currentUser(req.headers.get("cookie"));
  const { chapterId } = await req.json();
  const startTime = Date.now();

  try {
    // ... submit chapter logic
    
    // Track conversion
    await trackConversion(user.id, user.workspaceId, {
      conversionType: "chapter_completed",
      conversionName: `Chapter ${chapterId}`,
    });

    // Track performance
    await trackPerformance(user.id, user.workspaceId, {
      metricType: "api_latency",
      metricName: "submit_chapter_api",
      valueMs: Date.now() - startTime,
      apiEndpoint: "/api/programme/submit",
    });

    // Track in external integrations
    await trackEventAllIntegrationsServer(
      user.id,
      "chapter_completed",
      { chapter_id: chapterId }
    );

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    await trackError(user.id, user.workspaceId, {
      errorType: "api_error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      pagePath: "/api/programme/submit",
    });
    throw error;
  }
}
```

### Pattern 3: Tracking Database Operations

```typescript
// lib/operations/submit-chapter.ts
import { trackAction, measurePerformance } from "@/lib/middleware/track-api-calls";

export async function submitChapter(userId: string, chapterId: string, data: any) {
  // Track the action with error handling
  return await trackAction(
    userId,
    null,
    "chapter_submit",
    "submit_chapter",
    async () => {
      // Measure performance
      return await measurePerformance(
        userId,
        null,
        "insert_submission",
        async () => {
          // ... database operation
          return { success: true };
        },
        {
          metricType: "database_query",
          endpoint: "chapters.insert",
        }
      );
    },
    {
      chapter_id: chapterId,
      data_size: JSON.stringify(data).length,
    }
  );
}
```

## Integration Checklist

### Chapters 1-4 Progress Tracking

- [ ] Track when user enters chapter
- [ ] Track lesson completion
- [ ] Track chapter submission
- [ ] Track coach approval
- [ ] Track chapter completion

**Example for Chapter 1:**

```typescript
// app/programme/chapter-1/page.tsx
"use client";

import { useTracking } from "@/lib/hooks/useTracking";
import { useEffect } from "react";

export default function Chapter1Page({ userId, workspaceId }) {
  const { trackAction, trackConversion } = useTracking({ userId, workspaceId });

  useEffect(() => {
    // Track chapter entry
    trackAction({
      actionType: "page_view",
      actionName: "enter_chapter_1",
      metadata: { chapter: "chapter-1" },
    }).catch(console.warn);
  }, []);

  const handleLessonComplete = async (lessonId: string) => {
    await trackAction({
      actionType: "lesson_complete",
      actionName: `complete_lesson_${lessonId}`,
      metadata: { chapter: "chapter-1", lesson: lessonId },
    });
  };

  const handleChapterSubmit = async () => {
    await trackConversion({
      conversionType: "chapter_submitted",
      conversionName: "Chapter 1 Submission",
      funnelStage: "decision",
      sourcePage: "/programme/chapter-1",
    });
  };

  return (
    <div>
      {/* Chapter content */}
    </div>
  );
}
```

### Funnel & Campaign Tracking

Track the full customer journey from awareness to conversion:

```typescript
// Track funnel stages
enum FunnelStage {
  Awareness = "awareness",    // Landing page visit
  Consideration = "consideration",  // Viewing features
  Decision = "decision",      // Signup or enrollment
  Retention = "retention",    // Return visit
}

// Track progression through funnel
await trackConversion({
  conversionType: "funnel_step",
  conversionName: "viewed_pricing",
  funnelStage: FunnelStage.Consideration,
});

await trackConversion({
  conversionType: "signed_up",
  conversionName: "user_signup",
  funnelStage: FunnelStage.Decision,
});

await trackConversion({
  conversionType: "enrolled_cohort",
  conversionName: "cohort_enrollment",
  revenueValue: 49900, // $499 in cents
  currency: "USD",
  funnelStage: FunnelStage.Decision,
});
```

### Email & Notification Tracking

```typescript
// lib/coaching/send-approval-email.ts
import { trackConversion } from "@/lib/analytics-extended";

export async function sendApprovalEmail(userId: string, workspaceId: string, chapterId: string) {
  // Send email
  await sendEmail(userId, {
    subject: `Chapter ${chapterId} Approved!`,
    // ...
  });

  // Track conversion
  await trackConversion(userId, workspaceId, {
    conversionType: "chapter_approved",
    conversionName: `Chapter ${chapterId} Approved`,
    funnelStage: "retention",
    metadata: {
      email_sent: true,
    },
  });
}
```

## Advanced Patterns

### A/B Testing Integration

```typescript
import { trackAction } from "@/lib/analytics-extended";

export async function trackABTestVariant(
  userId: string,
  testName: string,
  variantId: string
) {
  await trackAction(userId, null, "ab_test_variant", testName, {
    metadata: {
      variant: variantId,
      timestamp: new Date().toISOString(),
    },
  });
}
```

### Revenue Tracking

```typescript
import { trackConversion } from "@/lib/analytics-extended";

export async function trackPayment(
  userId: string,
  workspaceId: string,
  amount: number,
  currency: string
) {
  await trackConversion(userId, workspaceId, {
    conversionType: "payment_completed",
    conversionName: "user_payment",
    revenueValue: amount,
    currency,
    metadata: {
      payment_method: "stripe",
      timestamp: new Date().toISOString(),
    },
  });
}
```

### Cohort Tracking

```typescript
import { trackAction } from "@/lib/analytics-extended";

export async function trackCohortEnrollment(
  userId: string,
  cohortId: string,
  cohortName: string
) {
  await trackAction(userId, null, "cohort_join", "enroll_cohort", {
    metadata: {
      cohort_id: cohortId,
      cohort_name: cohortName,
    },
  });
}
```

## Testing

### Local Testing

1. Ensure database is running and migrations applied:
```bash
npm run migrate:up
```

2. Add analytics environment variables to `.env.local`:
```bash
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-TEST
NEXT_PUBLIC_POSTHOG_KEY=phc_test
# etc.
```

3. Open DevTools console and verify events are being tracked:
```javascript
// Check page views
fetch('/api/analytics/dashboard').then(r => r.json()).then(console.log)
```

### Verifying Events in Database

```sql
-- Check page views
SELECT COUNT(*) FROM page_views WHERE created_at > now() - interval '1 hour';

-- Check conversions
SELECT * FROM conversion_events WHERE created_at > now() - interval '1 hour';

-- Check errors
SELECT * FROM analytics_errors WHERE created_at > now() - interval '1 hour';

-- Check performance metrics
SELECT * FROM performance_metrics WHERE created_at > now() - interval '1 hour';
```

## Common Issues

### Events Not Being Tracked

1. Check if analytics is enabled in privacy settings:
```typescript
const privacy = await getPrivacySettings(userId);
if (!privacy?.analyticsEnabled) {
  // Analytics disabled for this user
}
```

2. Check if DNT is enabled:
```javascript
// Browser console
navigator.doNotTrack  // Should be "1" if DNT enabled
```

3. Verify database table exists:
```sql
SELECT * FROM page_views LIMIT 1;
```

### Performance Issues

1. Monitor table sizes:
```sql
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%views' OR tablename LIKE '%events';
```

2. Implement data cleanup job:
```typescript
// app/api/cron/analytics-cleanup/route.ts
export async function POST(req: Request) {
  const retentionDays = 90;
  
  await pgPool().query(
    `DELETE FROM page_views WHERE created_at < now() - $1::interval`,
    [`${retentionDays} days`]
  );
  
  // ... cleanup other tables
}
```

## Next Steps

1. Start by tracking key conversion events (chapter completion, approval)
2. Monitor conversion funnel in dashboard at `/admin/analytics`
3. Set up external integrations (GA4, Segment, PostHog) for advanced analytics
4. Implement alerts for error spikes and performance degradation
5. Use analytics insights to optimize user flows

## Resources

- [Analytics Documentation](./ANALYTICS.md)
- [Tracking Hook API](../lib/hooks/useTracking.ts)
- [Analytics Integrations](../lib/integrations/analytics-integrations.ts)
- [Privacy Settings Component](../components/PrivacySettings.tsx)
