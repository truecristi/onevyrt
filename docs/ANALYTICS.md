# Analytics & Tracking System

ONEVYRT includes a comprehensive, privacy-first analytics and tracking system with internal database tracking and optional integrations with third-party analytics services.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Event Types](#event-types)
4. [Integration Setup](#integration-setup)
5. [Usage Guide](#usage-guide)
6. [Privacy & Compliance](#privacy--compliance)
7. [Dashboard](#dashboard)
8. [API Reference](#api-reference)

## Overview

The analytics system tracks:

- **Page Views** — User navigation and page interactions
- **User Actions** — Button clicks, form submissions, file uploads
- **Conversions** — Business outcomes (chapter completion, plan approval, document export)
- **Errors** — Client-side and server-side errors
- **Performance Metrics** — Page load times, API latency, database query times

### Privacy-First Design

- **Respects Do Not Track (DNT)** header — automatically disables tracking if user has DNT enabled
- **Anonymous by default** — no personally identifiable information (PII) collected unless explicitly opted in
- **GDPR compliant** — users can view, update, and delete their analytics data at any time
- **Selective integrations** — third-party services only used if explicitly configured

## Architecture

### Database Schema

#### `page_views`
Tracks user page navigation.

```sql
id, user_id, workspace_id, page_path, page_title, referrer, session_id, user_agent, country, metadata, created_at
```

#### `user_actions`
Tracks user interactions (clicks, submissions, uploads).

```sql
id, user_id, workspace_id, action_type, action_name, page_path, session_id, value, duration_ms, metadata, created_at
```

#### `conversion_events`
Tracks business conversions with optional revenue tracking.

```sql
id, user_id, workspace_id, conversion_type, conversion_name, revenue_value, currency, session_id, source_page, funnel_stage, metadata, created_at
```

#### `analytics_errors`
Tracks errors with context and severity levels.

```sql
id, user_id, workspace_id, error_type, error_message, error_code, error_stack, page_path, session_id, severity, context, created_at
```

#### `performance_metrics`
Tracks performance data (page load, API latency, DB queries).

```sql
id, user_id, workspace_id, metric_type, metric_name, value_ms, page_path, api_endpoint, session_id, metadata, created_at
```

#### `privacy_settings`
Stores user privacy preferences.

```sql
user_id, workspace_id, do_not_track, tracking_consent, analytics_enabled, marketing_emails, product_emails, gdpr_ackowledged, data_retention_days, created_at, updated_at
```

### Integration Layer

The system supports optional integrations with:

- **Google Analytics 4 (GA4)** — Standard web analytics, audience segments, conversion tracking
- **Segment** — Data warehouse and CDP integration for multi-tool routing
- **Sentry** — Advanced error tracking with source maps and replay
- **PostHog** — Product analytics with session recording and funnels

All integrations are:
- Environment-gated (only initialize if configured)
- Fire-and-forget (never block the main app)
- Redundant (if one fails, others continue)

## Event Types

### Page Views

```typescript
interface PageViewEvent {
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

// Automatic page tracking when using useTracking hook
// Manual tracking with:
await trackPageView(userId, workspaceId, {
  pagePath: '/programme/chapter-1',
  pageTitle: 'Chapter 1: Define',
});
```

### User Actions

```typescript
interface UserActionEvent {
  actionType: string;  // 'button_click', 'form_submit', 'file_upload'
  actionName: string;  // 'submit_chapter', 'approve_submission'
  pagePath?: string;
  value?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

// Example: Button click
const { trackAction } = useTracking({ userId, workspaceId });
await trackAction({
  actionType: 'button_click',
  actionName: 'submit_chapter_1',
  pagePath: '/programme/chapter-1',
});
```

### Conversions

```typescript
interface ConversionEvent {
  conversionType: string;      // 'chapter_completed', 'plan_approved'
  conversionName: string;
  revenueValue?: number;
  currency?: string;
  sourcePage?: string;
  funnelStage?: string;         // 'awareness', 'consideration', 'decision', 'retention'
  metadata?: Record<string, unknown>;
}

// Example: Chapter completed
const { trackConversion } = useTracking({ userId, workspaceId });
await trackConversion({
  conversionType: 'chapter_completed',
  conversionName: 'Chapter 1: Define',
  sourcePage: '/programme/chapter-1',
  funnelStage: 'decision',
});
```

### Errors

```typescript
interface ErrorEvent {
  errorType: string;   // 'client_error', 'server_error', 'network_error'
  errorMessage: string;
  errorCode?: string;
  errorStack?: string;
  pagePath?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, unknown>;
}

// Example: Form validation error
const { trackError } = useTracking({ userId, workspaceId });
await trackError({
  errorType: 'validation_error',
  errorMessage: 'Email field is required',
  pagePath: '/auth/signup',
  severity: 'warning',
});
```

### Performance Metrics

```typescript
interface PerformanceMetric {
  metricType: string;  // 'page_load', 'api_latency', 'database_query'
  metricName: string;
  valueMs: number;
  pagePath?: string;
  apiEndpoint?: string;
  metadata?: Record<string, unknown>;
}

// Example: API latency
const { trackPerformance } = useTracking({ userId, workspaceId });
await trackPerformance({
  metricType: 'api_latency',
  metricName: 'submit_chapter_api',
  valueMs: 245,
  apiEndpoint: '/api/programme/chapters/chapter-1/submit',
});
```

## Integration Setup

### Google Analytics 4

1. Create a GA4 property at https://analytics.google.com
2. Get the Measurement ID (format: `G-XXXXXXXXXX`)
3. Add environment variable:
   ```bash
   NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

### Segment

1. Create a Segment workspace at https://segment.com
2. Create a web source and get the Write Key
3. Add environment variables:
   ```bash
   SEGMENT_WRITE_KEY=your_segment_write_key
   NEXT_PUBLIC_SEGMENT_WRITE_KEY=your_segment_write_key  # For client-side
   ```

### Sentry

1. Create a Sentry project at https://sentry.io
2. Get the DSN for your project
3. Add environment variables:
   ```bash
   SENTRY_DSN=https://your_sentry_dsn
   NEXT_PUBLIC_SENTRY_DSN=https://your_sentry_dsn  # For client-side
   ```

### PostHog

1. Create a PostHog account at https://posthog.com
2. Create a project and get the API key
3. Add environment variables:
   ```bash
   NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
   NEXT_PUBLIC_POSTHOG_HOST=https://us.posthog.com  # Or your self-hosted instance
   ```

## Usage Guide

### Initialize in Root Layout

```typescript
// app/layout.tsx
"use client";

import { useEffect } from "react";
import { initializeAnalyticsIntegrations } from "@/lib/tracking-init";

export default function RootLayout({ children }) {
  useEffect(() => {
    initializeAnalyticsIntegrations();
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

### Track User Session

```typescript
// After login
import { trackUserSession } from "@/lib/tracking-init";

trackUserSession(user.id, {
  email: user.email,
  workspace_id: user.workspaceId,
  plan: user.plan,
});
```

### Track Page Views (Automatic)

```typescript
// Use the tracking hook in any component
"use client";

import { useTracking } from "@/lib/hooks/useTracking";

export function MyComponent({ userId, workspaceId }) {
  const { trackAction, trackConversion } = useTracking({ userId, workspaceId });
  
  // Page views are automatically tracked
  // Just use the hook!
  
  return <div>...</div>;
}
```

### Track User Actions

```typescript
import { useTrackClick, useTrackFormSubmit } from "@/lib/hooks/useTracking";

export function ChapterSubmitForm({ userId, workspaceId }) {
  const trackSubmit = useTrackFormSubmit("chapter_submission", { userId, workspaceId });

  const handleSubmit = async (data) => {
    await trackSubmit({
      chapter: "chapter-1",
      timestamp: new Date().toISOString(),
    });
    
    // Submit form...
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Track Conversions

```typescript
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
  };

  return <button onClick={handleComplete}>Complete Chapter</button>;
}
```

### Server-Side Tracking

```typescript
// app/api/programme/chapters/submit/route.ts
import { trackConversion } from "@/lib/analytics-extended";
import { trackEventAllIntegrationsServer } from "@/lib/integrations/analytics-integrations";

export async function POST(req: Request) {
  const { userId, workspaceId, chapter } = await req.json();

  // Track in database
  await trackConversion(userId, workspaceId, {
    conversionType: "chapter_completed",
    conversionName: chapter.title,
  });

  // Track in external integrations
  await trackEventAllIntegrationsServer(userId, "chapter_completed", {
    chapter_id: chapter.id,
    chapter_name: chapter.title,
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

## Privacy & Compliance

### Do Not Track

The system automatically respects the user's Do Not Track (DNT) preference:

```typescript
// In lib/analytics-extended.ts
if (navigator.doNotTrack === "1") {
  // Skip tracking
  return;
}
```

### Privacy Settings

Users can control their privacy preferences at `/api/analytics/privacy`:

```typescript
// Get current settings
const settings = await fetch("/api/analytics/privacy");

// Update settings
await fetch("/api/analytics/privacy", {
  method: "PUT",
  body: JSON.stringify({
    analyticsEnabled: false,
    marketingEmails: false,
    dataRetentionDays: 30,
  }),
});

// Delete all analytics data (GDPR right to be forgotten)
await fetch("/api/analytics/privacy", {
  method: "DELETE",
});
```

### Data Retention

Analytics data is automatically purged based on user preference (default: 90 days). Implement cleanup job:

```typescript
// app/api/cron/analytics-cleanup/route.ts
export async function POST(req: Request) {
  const retentionDays = 90;
  
  await pgPool().query(
    `DELETE FROM page_views WHERE created_at < now() - $1::interval`,
    [`${retentionDays} days`]
  );
  
  await pgPool().query(
    `DELETE FROM user_actions WHERE created_at < now() - $1::interval`,
    [`${retentionDays} days`]
  );
  
  // ... cleanup other tables
}
```

## Dashboard

### Access Analytics Dashboard

Admin users can view the analytics dashboard at `/admin/analytics`.

**Available visualizations:**

- Daily page views trend
- Unique users over time
- Daily conversions
- Daily errors
- Top pages
- Top user actions
- Conversion funnel
- Performance metrics (p95 latency, load times)
- Error logs with severity

### Dashboard Features

- **Time window selection** — 7 days, 30 days, 90 days, 1 year
- **Export data** — Download as CSV/JSON (coming soon)
- **Real-time updates** — Refresh every 5 minutes (coming soon)
- **Alerts** — Error spikes, performance degradation (coming soon)

## API Reference

### Analytics Events

#### `POST /api/analytics/events`

Track custom events (coming soon).

```bash
curl -X POST /api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "custom_event",
    "eventName": "user_exported_plan",
    "userId": "user_123",
    "workspaceId": "ws_456",
    "metadata": {
      "plan_id": "plan_789",
      "format": "pdf"
    }
  }'
```

### Analytics Dashboard

#### `GET /api/analytics/dashboard`

Get aggregated analytics data.

**Query Parameters:**
- `windowDays` — Time window (default: 30)

**Response:**

```json
{
  "windowDays": 30,
  "summary": {
    "totalPageViews": 12345,
    "totalUniqueUsers": 456,
    "totalConversions": 89,
    "totalErrors": 12
  },
  "dailyStats": [...],
  "pageViewStats": [...],
  "userActionStats": [...],
  "conversionStats": [...],
  "errorStats": [...],
  "performanceStats": [...]
}
```

### Privacy Settings

#### `GET /api/analytics/privacy`

Get current user's privacy settings.

```bash
curl /api/analytics/privacy
```

#### `PUT /api/analytics/privacy`

Update privacy settings.

```bash
curl -X PUT /api/analytics/privacy \
  -H "Content-Type: application/json" \
  -d '{
    "analyticsEnabled": false,
    "marketingEmails": false,
    "gdprAcknowledged": true
  }'
```

#### `DELETE /api/analytics/privacy`

Delete all analytics data for current user (GDPR).

```bash
curl -X DELETE /api/analytics/privacy
```

## Monitoring & Alerts

### Error Rate Monitoring

Monitor error rate from the analytics dashboard. Set up alerts for:

- Error rate > 1% 
- Critical errors detected
- Sentry integration for automatic alerts

### Performance Monitoring

Track performance metrics:
- Page load time > 3s
- API latency > 500ms
- Database query time > 1s

### Conversion Funnel

Monitor conversion funnel to identify drop-off points:

```
Awareness (page views)
  → Consideration (time on page)
  → Decision (interaction)
  → Conversion (chapter complete)
  → Retention (return visit)
```

## Troubleshooting

### Integrations Not Capturing Data

1. Check environment variables are set correctly
2. Check browser console for errors
3. Verify integration credentials/API keys
4. Check network tab in DevTools for API calls

### Performance Impact

The analytics system is designed to be lightweight:
- Page views tracked asynchronously
- No blocking calls
- Errors logged to console, not thrown
- External integrations optional

If experiencing issues:
1. Disable integrations one by one
2. Check database performance (monitor `page_views` table size)
3. Implement data retention/cleanup jobs

### Privacy Compliance

To ensure GDPR compliance:
1. Update privacy policy to mention analytics
2. Implement cookie consent banner (if required)
3. Provide clear privacy settings UI
4. Regularly audit data retention policies
5. Test GDPR data export/deletion flows

## Future Enhancements

Planned features (not yet implemented):

- [ ] Session recording (PostHog integration)
- [ ] Heatmap tracking (clicks, scrolls)
- [ ] A/B testing framework
- [ ] Custom event definitions UI
- [ ] Real-time alerts dashboard
- [ ] Data export/download (CSV, JSON)
- [ ] Analytics API (for custom queries)
- [ ] Predictive analytics (churn prediction, LTV forecasting)
- [ ] Third-party data warehouse sync
- [ ] Machine learning model integration
