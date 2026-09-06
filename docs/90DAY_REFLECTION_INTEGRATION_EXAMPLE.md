# 90-Day Reflection Checkpoint — Integration Example

Complete working example of integrating the checkpoint into the command center dashboard.

---

## Complete Integration (Copy-Paste Ready)

### 1. Update `app/command-center/page.tsx`

```typescript
"use client";

import React, { useState, useEffect } from "react";
import { currentUser } from "@/lib/auth";
import { listForUser } from "@/lib/workspaces";
import { NinetyDayReflectionCheckpoint } from "@/components/dashboard/90DayReflectionCheckpoint";
import { useReflectionCheckpoint } from "@/components/dashboard/useReflectionCheckpoint";

interface WhyCreedData {
  why: string;
  creed: string;
}

export default function CommandCenterPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [whyCreedData, setWhyCreedData] = useState<WhyCreedData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { isDue, isLoading: isCheckingReflection } =
    useReflectionCheckpoint(workspaceId);
  const [showReflectionModal, setShowReflectionModal] = useState(false);

  // Fetch current workspace and why/creed data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingData(true);

        // Get workspaces
        const workspaces = await listForUser(currentUser.id);
        if (workspaces.length === 0) {
          // No workspace - redirect to onboarding
          window.location.href = "/welcome";
          return;
        }

        const primaryWorkspace = workspaces[0];
        setWorkspaceId(primaryWorkspace.id);

        // Fetch why/creed
        const response = await fetch(
          `/api/workspace/${primaryWorkspace.id}/why-creed`,
          { credentials: "include" }
        );

        if (response.ok) {
          const data = await response.json();
          setWhyCreedData({
            why: data.why || "",
            creed: data.creed || "",
          });
        }
      } catch (error) {
        console.error("Failed to load command center data:", error);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, []);

  // Show reflection modal when due (but only once per session)
  useEffect(() => {
    if (isDue && !showReflectionModal && !isCheckingReflection) {
      setShowReflectionModal(true);
    }
  }, [isDue, isCheckingReflection, showReflectionModal]);

  const handleReflectionComplete = () => {
    setShowReflectionModal(false);
    // Optional: Show success toast or refresh data
    console.log("Reflection saved successfully!");
  };

  const handleReflectionCancel = () => {
    setShowReflectionModal(false);
    // User can dismiss — they'll be reminded again in a few days
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            Loading your command center...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Dashboard Content */}
      <div className="container mx-auto py-12 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            Command Center
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Your hub for growth, reflection, and action.
          </p>
        </div>

        {/* Why & Creed Section (always visible) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-800">
          <WhyAndCreedSection
            workspaceId={workspaceId!}
            data={whyCreedData}
            onUpdate={setWhyCreedData}
          />
        </div>

        {/* Rest of dashboard content goes here */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Quick Stats
            </h2>
            {/* Add your dashboard content */}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Recent Activity
            </h2>
            {/* Add your dashboard content */}
          </div>
        </div>
      </div>

      {/* Reflection Checkpoint Modal (shown when due) */}
      {showReflectionModal && !isCheckingReflection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <NinetyDayReflectionCheckpoint
              workspaceId={workspaceId!}
              currentWhy={whyCreedData?.why || ""}
              currentCreed={whyCreedData?.creed || ""}
              onComplete={handleReflectionComplete}
              onCancel={handleReflectionCancel}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

### 2. Register Job in `lib/jobs.ts`

```typescript
// lib/jobs.ts
import { runReflectionReminderJob } from "@/lib/jobs/reflection-reminder-job";

export type Job = {
  key: string;
  name: string;
  description: string;
  run: () => Promise<any>;
  schedule: "hourly" | "daily" | "weekly" | "monthly";
};

export const jobs: Job[] = [
  // ... existing jobs
  {
    key: "reflection-reminder",
    name: "Reflection Checkpoint Reminders",
    description: "Send 90-day reflection reminders to workspace owners",
    run: runReflectionReminderJob,
    schedule: "daily",
  },
];
```

### 3. Database Migration

Run this once:

```bash
cd apps/web
npm run migrate up
```

This executes `migrations/1788550800000_add-90day-reflections-table.js`.

---

## Advanced: Modal with Backdrop Control

If you want more control over the modal behavior (e.g., prevent closing on backdrop click):

```typescript
// components/ReflectionCheckpointModal.tsx
import React from "react";
import { NinetyDayReflectionCheckpoint } from "./90DayReflectionCheckpoint";

interface ReflectionCheckpointModalProps {
  isOpen: boolean;
  workspaceId: string;
  currentWhy: string;
  currentCreed: string;
  onComplete: () => void;
  onCancel: () => void;
  allowDismiss?: boolean; // Set to false to prevent closing
}

export function ReflectionCheckpointModal({
  isOpen,
  workspaceId,
  currentWhy,
  currentCreed,
  onComplete,
  onCancel,
  allowDismiss = true,
}: ReflectionCheckpointModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (allowDismiss && e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        <NinetyDayReflectionCheckpoint
          workspaceId={workspaceId}
          currentWhy={currentWhy}
          currentCreed={currentCreed}
          onComplete={onComplete}
          onCancel={allowDismiss ? onCancel : undefined}
        />
      </div>
    </div>
  );
}
```

Usage:

```typescript
<ReflectionCheckpointModal
  isOpen={showReflectionModal}
  workspaceId={workspaceId!}
  currentWhy={whyCreedData?.why || ""}
  currentCreed={whyCreedData?.creed || ""}
  onComplete={handleReflectionComplete}
  onCancel={handleReflectionCancel}
  allowDismiss={true} // User can close
/>
```

---

## Testing Integration

### Unit Test Example (Vitest)

```typescript
// app/command-center/__tests__/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import CommandCenterPage from "../page";

jest.mock("@/lib/workspaces");
jest.mock("@/components/dashboard/useReflectionCheckpoint");

describe("Command Center", () => {
  it("shows reflection modal when due", async () => {
    // Mock hook to return isDue: true
    useReflectionCheckpoint.mockReturnValue({
      isDue: true,
      isLoading: false,
      nextReminderAt: "2025-12-03T00:00:00Z",
      error: null,
    });

    render(<CommandCenterPage />);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("90-Day Reflection")).toBeInTheDocument();
    });
  });

  it("hides modal when not due", async () => {
    useReflectionCheckpoint.mockReturnValue({
      isDue: false,
      isLoading: false,
      nextReminderAt: null,
      error: null,
    });

    render(<CommandCenterPage />);

    // Modal should not be visible
    expect(screen.queryByText("90-Day Reflection")).not.toBeInTheDocument();
  });
});
```

### E2E Test Example (Playwright)

```typescript
// e2e/reflection-checkpoint.spec.ts
import { test, expect } from "@playwright/test";

test.describe("90-Day Reflection Checkpoint", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/welcome");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "password123");
    await page.click("button:has-text('Sign In')");
    await page.waitForURL("/command-center");
  });

  test("shows modal when reflection is due", async ({ page }) => {
    // Mock API to return isDue: true
    await page.route("/api/workspace/*/reflection-checkpoint", (route) => {
      route.abort();
    });

    // Simulate 90 days passing in DB (admin only)
    await page.goto("/api/test/mock-reflection-due");

    // Navigate to command center
    await page.goto("/command-center");

    // Modal should appear
    await expect(page.locator("text=90-Day Reflection")).toBeVisible();
  });

  test("completes reflection flow", async ({ page }) => {
    // Assume modal is showing
    await page.goto("/command-center?reflection-due=true");

    // Step 1: Intro (auto-advance)
    await page.click("button:has-text('Next')");

    // Step 2: Why Evolution
    await page.fill(
      '[placeholder*="How has your Why evolved"]',
      "My purpose has deepened significantly."
    );
    await page.click("button:has-text('Next')");

    // Step 3: Creed Evolution
    await page.fill(
      '[placeholder*="What\'s new about your creed"]',
      "I'm more committed to serving my customers."
    );
    await page.click("button:has-text('Next')");

    // Step 4: Key Insights
    await page.fill(
      '[placeholder*="biggest breakthroughs"]',
      "I learned the importance of listening."
    );
    await page.click("button:has-text('Next')");

    // Step 5: Review
    await expect(page.locator("text=Review Your Reflection")).toBeVisible();
    await page.click("button:has-text('Save Reflection')");

    // Step 6: Complete
    await expect(page.locator("text=Reflection Complete")).toBeVisible();
    await page.click("button:has-text('Return to Dashboard')");

    // Back to dashboard
    await expect(page).toHaveURL("/command-center");
  });
});
```

---

## Monitoring & Analytics

### Check Reflection Metrics

```typescript
// lib/dashboard/reflection-analytics.ts
import { getReflectionMetrics } from "@/lib/dashboard/reflection-checkpoint";

export async function getReflectionDashboardMetrics(workspaceId: string) {
  const metrics = await getReflectionMetrics(workspaceId);

  return {
    totalReflections: metrics.totalReflections,
    lastReflectionDate: metrics.lastReflectionDate?.toLocaleDateString(),
    firstReflectionDate: metrics.firstReflectionDate?.toLocaleDateString(),
    daysActive: metrics.lastReflectionDate
      ? Math.floor(
          (Date.now() - metrics.lastReflectionDate.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : 0,
    isActive: metrics.totalReflections > 0,
  };
}
```

Usage:

```typescript
const metrics = await getReflectionDashboardMetrics(workspaceId);
console.log(`User has completed ${metrics.totalReflections} reflections`);
```

### Email Digest Example

```typescript
// lib/email/reflection-digest.ts
import { generateReflectionSummary } from "@/lib/dashboard/reflection-checkpoint";

export async function sendReflectionDigest(
  userEmail: string,
  workspaceId: string
) {
  const summary = await generateReflectionSummary(workspaceId);

  const emailBody = `
    <h2>Your Reflection Summary</h2>
    <pre>${summary}</pre>
    <p>Log in to see your full journey and upcoming milestones.</p>
  `;

  // Send via email service
  // await sendEmail(userEmail, "Your 90-Day Journey", emailBody);
}
```

---

## Environment Configuration

### Optional: Add to `.env.local`

```bash
# Enable/disable reflection reminders
REFLECTION_REMINDERS_ENABLED=true

# Set reminder frequency (in days)
REFLECTION_REMINDER_INTERVAL_DAYS=90

# Set reminder grace period (send reminders for N days after due date)
REFLECTION_REMINDER_GRACE_PERIOD_DAYS=7
```

Then use in job:

```typescript
if (process.env.REFLECTION_REMINDERS_ENABLED === "false") {
  return { checked: 0, reminded: 0 };
}
```

---

## Troubleshooting Integration

### Modal doesn't appear on command center

1. **Check job is registered:**
   ```bash
   grep -n "reflection-reminder" lib/jobs.ts
   ```

2. **Check API is responding:**
   ```bash
   curl http://localhost:3000/api/workspace/WORKSPACE_ID/reflection-checkpoint
   ```

3. **Check database has the table:**
   ```sql
   SELECT * FROM information_schema.tables
   WHERE table_name = 'workspace_90day_reflections';
   ```

4. **Check component is imported:**
   ```bash
   grep -n "NinetyDayReflectionCheckpoint" app/command-center/page.tsx
   ```

### Notifications not sent to users

1. **Check job ran:**
   ```sql
   SELECT * FROM job_runs WHERE job_key = 'reflection-reminder'
   ORDER BY last_run_at DESC LIMIT 1;
   ```

2. **Run job manually:**
   ```bash
   curl -X POST http://localhost:3000/api/cron/tick
   ```

3. **Check notifications created:**
   ```sql
   SELECT * FROM notifications
   WHERE type LIKE 'reflection%'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## Performance Tuning

### Database Query Optimization

The migration automatically creates indices on:
- `workspace_id, created_at` (for history queries)
- `user_id` (for user-scoped queries)

If you're running at scale, consider:
- Adding a `is_notified` boolean to avoid duplicate sends
- Partitioning by `workspace_id` if table grows > 10M rows
- Archiving old reflections after 2 years

### API Response Caching

Add caching headers to GET endpoint:

```typescript
return Response.json(data, {
  headers: {
    "Cache-Control": "max-age=300, private", // 5 minute cache
  },
});
```

### Rate Limiting

Add rate limiting to POST endpoint (example with tokens):

```typescript
import { rateLimit } from "@/lib/rate-limit";

const { success, limit, remaining } = await rateLimit(
  `reflection-checkpoint:${user.id}`,
  5 // 5 submissions per day
);

if (!success) {
  return new Response("Rate limit exceeded", { status: 429 });
}
```

---

## Deployment Checklist

- [ ] Database migration run: `npm run migrate up`
- [ ] Job registered in `lib/jobs.ts`
- [ ] Component added to dashboard/page
- [ ] Environment variables set (if using `.env` config)
- [ ] Tests passing: `npm run test`
- [ ] E2E tests passing: `npm run test:e2e`
- [ ] Notification settings configured (email/SMS if desired)
- [ ] Deployed to staging
- [ ] Tested in staging environment
- [ ] Deployed to production
- [ ] Monitored first job run (check `job_runs` and `notifications` tables)

---

## Next Steps

1. Copy integration code from this guide
2. Run database migration
3. Add job to registry
4. Deploy to staging
5. Test reflection flow
6. Deploy to production
7. Monitor first runs

For questions, refer to `docs/90DAY_REFLECTION_CHECKPOINT.md` (full reference).
