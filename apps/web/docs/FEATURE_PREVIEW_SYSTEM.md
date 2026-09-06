# Feature Preview & Upsell System

Complete guide to replacing hard feature locks with interactive previews and upgrade paths.

## Overview

This system replaces "🔒 Feature Locked" messages with rich previews that:
- Show what users are missing with enticing previews
- Highlight clear value and benefits
- Provide frictionless paths to upgrade
- Track feature attempts for personalized upselling
- Support trial/limited access periods

## Architecture

### Core Components

#### 1. **FeaturePreview** (`components/features/FeaturePreview.tsx`)
High-level feature showcase with preview, benefits, and upgrade CTA.

```tsx
import { FeaturePreview } from "@/components/features";

<FeaturePreview
  featureId="advanced_analytics"
  name="Advanced Analytics"
  description="Real-time traffic, conversion funnels, ROI by channel"
  minTier="pro"
  userTier={workspace.plan}
  benefits={[
    "Real-time visitor tracking",
    "Conversion funnel analysis",
    "ROI by channel",
    "Custom dashboards",
  ]}
  preview={<AnalyticsDashboardTeaser />}
  planName="Pro"
  onUpgrade={() => navigate("/billing/upgrade?plan=pro")}
  showTrialOption={true}
  trialDays={7}
/>
```

#### 2. **LockedFeatureTeaser** (`components/features/LockedFeatureTeaser.tsx`)
Shows usage limits and upgrade path when user hits a quota.

```tsx
import { LockedFeatureTeaser } from "@/components/features";

<LockedFeatureTeaser
  featureName="Projects"
  userTier={workspace.plan}
  minTier="pro"
  currentUsage={projectCount}
  currentLimit={freePlanLimit}
  nextLimit={proPlanLimit}
  highlights={[
    "Unlimited projects",
    "Advanced templates",
    "Team collaboration",
  ]}
  benefits={[
    "5x more capacity",
    "Team access",
    "Priority support",
  ]}
  onUpgrade={() => navigate("/billing/upgrade?plan=pro")}
/>
```

#### 3. **TierComparisonOverlay** (`components/features/TierComparisonOverlay.tsx`)
Side-by-side tier matrix for informed upgrade decisions.

```tsx
import { TierComparisonOverlay } from "@/components/features";

<TierComparisonOverlay
  userTier={workspace.plan}
  recommendedTier="pro"
  featureName="Advanced Analytics"
  onSelectTier={(tier) => navigate(`/billing/upgrade?plan=${tier}`)}
  onClose={() => setShowComparison(false)}
  pricing={{
    free: "Free",
    pro: "$29/mo",
    business: "$79/mo",
    performance: "$199/mo",
  }}
/>
```

#### 4. **ProgressiveDisclosure** (`components/features/ProgressiveDisclosure.tsx`)
Partial preview that expands on click, revealing locked content on upgrade.

```tsx
import { ProgressiveDisclosure } from "@/components/features";

<ProgressiveDisclosure
  featureId="automation_rules"
  title="Email Automation"
  teaser={<div>First 2 triggers visible...</div>}
  fullContent={<div>Full automation rule editor...</div>}
  isLocked={!hasAccess}
  onTryExpand={() => showUpgradePrompt()}
  onUpgrade={() => navigate("/billing")}
  previewFraction={0.4}
  showHint={true}
/>
```

#### 5. **UpgradePrompt** (`components/features/UpgradePrompt.tsx`)
Contextual modal shown when user tries to access locked feature.

```tsx
import { UpgradePrompt } from "@/components/features";

{showUpgradePrompt && (
  <UpgradePrompt
    featureName="Advanced Analytics"
    currentTier={workspace.plan}
    requiredTier="pro"
    benefits={[
      "Real-time traffic analytics",
      "Conversion funnel tracking",
      "ROI by channel breakdown",
    ]}
    price="$29/mo"
    onUpgrade={() => navigate("/billing/upgrade?plan=pro")}
    onTrial={() => startTrial("advanced_analytics", 7)}
    onClose={() => setShowUpgradePrompt(false)}
  />
)}
```

### Utilities & Hooks

#### Feature Access Checks
```tsx
import {
  hasFeatureAccess,
  getFeatureMinTier,
  getUpgradeTierForFeature,
  getLockedFeatures,
  getAccessibleFeatures,
} from "@/lib/feature-preview";

// Check if user can access a feature
if (!hasFeatureAccess(workspace.plan, "advanced_analytics")) {
  return <UpgradePrompt />;
}

// Get minimum tier needed
const minTier = getFeatureMinTier("advanced_analytics"); // "pro"

// Get next tier that grants access
const upgradeTo = getUpgradeTierForFeature(workspace.plan, "advanced_analytics");

// Get all locked features
const locked = getLockedFeatures(workspace.plan);

// Get all accessible features
const accessible = getAccessibleFeatures(workspace.plan);
```

#### Feature Access Hook
```tsx
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";

function AnalyticsComponent({ workspace, userId }) {
  const { isLocked, attemptAccess, startTrial, feature } = useFeatureAccess(
    "advanced_analytics",
    {
      userTier: workspace.plan,
      workspaceId: workspace.id,
      userId,
    }
  );

  if (isLocked) {
    return (
      <UpgradePrompt
        featureName={feature?.name || "Feature"}
        onUpgrade={() => {
          attemptAccess(); // Track attempt
          navigate("/billing");
        }}
      />
    );
  }

  return <Analytics />;
}
```

#### Attempt Tracking
```tsx
import {
  recordFeatureAttempt,
  getFeatureAttemptCount,
  getTopAttemptedFeatures,
  trackFeatureAttemptServer,
} from "@/lib/feature-access-tracking";

// Record an attempt (stored in localStorage)
recordFeatureAttempt("advanced_analytics");

// Get attempt count for a feature
const attempts = getFeatureAttemptCount("advanced_analytics");

// Get top attempted features (for personalized upsell)
const topAttempts = getTopAttemptedFeatures(5);

// Send to server for analytics/email campaigns
await trackFeatureAttemptServer("advanced_analytics", workspace.id);
```

### Feature Catalog

Features are defined in `lib/feature-preview.ts`:

```typescript
export const FEATURE_CATALOG: Record<string, Feature> = {
  advanced_analytics: {
    id: "advanced_analytics",
    name: "Advanced Analytics",
    description: "Real-time traffic, conversion funnels, ROI by channel",
    minTier: "pro",
    benefits: ["Real-time visitor tracking", "Conversion funnel analysis", ...],
    category: "analytics",
    limit: { free: 1, pro: 5, business: 20, performance: 999 },
  },
  // ... more features
};
```

### Plan Tiers

Current tier hierarchy (in `lib/workspaces.ts`):
- `free` — Single user, limited features
- `pro` — Professional features, single user
- `business` — Team collaboration up to 10 users
- `performance` — Enterprise, unlimited everything

## Implementation Guide

### Step 1: Check Feature Access

Before showing a locked feature, check access:

```tsx
import { hasFeatureAccess } from "@/lib/feature-preview";

function MyFeature({ workspace }) {
  const hasAccess = hasFeatureAccess(workspace.plan, "advanced_analytics");

  if (!hasAccess) {
    return <UpgradePrompt />;
  }

  return <FullFeature />;
}
```

### Step 2: Show Progressive Preview

For complex features, use progressive disclosure:

```tsx
function AnalyticsPage({ workspace }) {
  const hasAccess = hasFeatureAccess(workspace.plan, "advanced_analytics");

  return (
    <ProgressiveDisclosure
      featureId="advanced_analytics"
      title="Advanced Analytics Dashboard"
      teaser={
        <div>
          <h4>Your top traffic sources</h4>
          <div className="blurred">
            <StatCard label="Traffic" value="2,341" />
          </div>
        </div>
      }
      fullContent={hasAccess ? <FullAnalyticsDashboard /> : null}
      isLocked={!hasAccess}
      onUpgrade={() => navigate("/billing")}
    />
  );
}
```

### Step 3: Track Attempts & Show Recommendations

Track when users try locked features:

```tsx
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";

function LockedFeatureButton({ workspace, userId }) {
  const { isLocked, attemptAccess } = useFeatureAccess("automation_rules", {
    userTier: workspace.plan,
    workspaceId: workspace.id,
    userId,
  });

  const handleClick = async () => {
    if (isLocked) {
      attemptAccess(); // Records attempt locally and sends to server
    }
  };

  return (
    <button onClick={handleClick} disabled={isLocked}>
      {isLocked ? "🔒 Automation (Pro)" : "Create Workflow"}
    </button>
  );
}
```

### Step 4: Show Tier Comparison

When user wants to upgrade, show what they gain:

```tsx
function UpgradeFlow({ workspace }) {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <>
      <button onClick={() => setShowComparison(true)}>
        See all plans
      </button>
      {showComparison && (
        <TierComparisonOverlay
          userTier={workspace.plan}
          recommendedTier={getRecommendedUpgradeTier(attemptedFeatures)}
          onSelectTier={(tier) => {
            sendEvent("upgrade_started", { tier });
            navigate(`/billing/upgrade?plan=${tier}`);
          }}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}
```

## Database Schema

Two analytics tables track feature usage:

```sql
-- Individual attempts (high volume)
CREATE TABLE feature_access_attempts (
  workspace_id TEXT,
  user_id TEXT,
  feature_id TEXT,
  attempted_at TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id, feature_id, attempted_at)
);

-- Batch summaries (for campaigns)
CREATE TABLE feature_access_attempts_batch (
  workspace_id TEXT PRIMARY KEY,
  user_id TEXT,
  attempts_json JSONB,
  recorded_at TIMESTAMP,
  UNIQUE (workspace_id, user_id)
);
```

## Usage in Existing Components

### ProgrammeJourney (Lessons)
Replace lesson lock icons with interactive previews:

```tsx
import { ProgressiveDisclosure } from "@/components/features";

if (lesson.status === "locked") {
  return (
    <ProgressiveDisclosure
      featureId={`lesson_${lesson.id}`}
      title={lesson.title}
      teaser={<LessonPreview lesson={lesson} />}
      fullContent={<FullLesson lesson={lesson} />}
      isLocked={true}
      onUpgrade={() => navigate("/billing")}
    />
  );
}
```

### Studio (Templates)
Show template previews with "Unlock" CTAs:

```tsx
import { FeaturePreview } from "@/components/features";

<FeaturePreview
  featureId="premium_templates"
  name="Premium Template Library"
  description="50+ industry-specific funnel templates"
  minTier="pro"
  userTier={workspace.plan}
  preview={<TemplateGalleryPreview />}
  benefits={["50+ templates", "Industry-specific", "Conversion-optimized"]}
  onUpgrade={() => navigate("/billing")}
/>
```

### Analytics
Show analytics dashboard teaser when locked:

```tsx
import { LockedFeatureTeaser } from "@/components/features";

if (!hasFeatureAccess(workspace.plan, "advanced_analytics")) {
  return (
    <LockedFeatureTeaser
      featureName="Analytics dashboards"
      userTier={workspace.plan}
      minTier="pro"
      currentUsage={0}
      currentLimit={0}
      nextLimit={5}
      highlights={["Real-time tracking", "Funnel analysis"]}
    />
  );
}
```

## Styling & Theming

Components use CSS-in-JS with design tokens:

```tsx
// Colors
--surface: #fff
--surface2: #f9fafb
--surface-muted: #fafbfc
--border2: #e5e7eb
--text: #1f2937
--text-secondary: #6b7280
--text-muted: #9ca3af
--accent: #f59e0b
```

Customize via `design-system.css` or override in component `<style jsx>` blocks.

## Trial Access

Enable 7-day trial for high-value features:

```tsx
import { startTrialAccess, isTrialing } from "@/lib/trial-access";

function AnalyticsPage({ workspace, userId }) {
  const [trialActive, setTrialActive] = useState(false);

  const handleStartTrial = async () => {
    await startTrialAccess(userId, "advanced_analytics", 7);
    setTrialActive(true);
  };

  if (!hasAccess && !trialActive) {
    return <UpgradePrompt onTrial={handleStartTrial} />;
  }

  return <Analytics />;
}
```

## Email Campaign Integration

Use tracked attempts to personalize upgrade emails:

```tsx
// Get user's attempted features
const attempts = await getFeatureAttempts(userId);
const topAttempted = getTopAttemptedFeatures(5);

// Compose personalized email
const email = {
  subject: `You tried ${topAttempted[0].name} — here's how to unlock it`,
  body: `We noticed you tried ${topAttempted[0].name} ${topAttempted[0].count} times this week...`,
};
```

## Analytics Events

Track key upsell events:

```tsx
// Feature attempt
trackEvent("feature_attempted", { featureId, userTier, workspace });

// Upgrade started
trackEvent("upgrade_started", { from: userTier, to: selectedTier });

// Trial started
trackEvent("trial_started", { featureId, days: 7 });

// Trial converted
trackEvent("trial_converted", { featureId, newTier });
```

## Accessibility

All components follow WCAG 2.1 AA:
- Keyboard navigation
- ARIA labels
- Color contrast
- Focus management
- Screen reader friendly

## Testing

Example test cases:

```tsx
// Feature access check
expect(hasFeatureAccess("free", "advanced_analytics")).toBe(false);
expect(hasFeatureAccess("pro", "advanced_analytics")).toBe(true);

// Attempt tracking
recordFeatureAttempt("advanced_analytics");
expect(getFeatureAttemptCount("advanced_analytics")).toBe(1);

// Component rendering
render(
  <FeaturePreview
    featureId="test"
    name="Test"
    minTier="pro"
    userTier="free"
  />
);
expect(screen.getByText(/unlock/i)).toBeInTheDocument();
```

## Migration Path

To replace existing hard locks:

1. **Inventory** — Find all "🔒 Locked" UI in codebase
2. **Catalog** — Add feature to FEATURE_CATALOG if not present
3. **Component** — Replace lock UI with FeaturePreview/ProgressiveDisclosure
4. **Track** — Add attemptAccess() calls to track usage
5. **Test** — Verify access control at both component and API levels
6. **Monitor** — Watch analytics to inform upsell strategy

## Performance Notes

- **localStorage** — Attempt tracking uses browser localStorage (non-blocking)
- **API calls** — Server tracking is fire-and-forget (no blocking)
- **Hydration** — Avoid accessing window/localStorage during SSR
- **Bundle size** — All components are tree-shakeable

## Support & Questions

For questions or feature requests:
1. Check existing FEATURE_CATALOG entries
2. Review component examples above
3. See component JSDoc comments
4. Check tests in corresponding .test.ts files
