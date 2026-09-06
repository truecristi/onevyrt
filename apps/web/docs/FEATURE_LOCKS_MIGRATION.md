# Feature Locks Migration Guide

Step-by-step guide to replacing hard feature locks throughout ONEVYRT with interactive previews and upgrade paths.

## Phase 1: Foundation (Week 1-2)

### Tasks

#### 1.1 Enable Analytics Tables

Create missing database tables for feature attempt tracking:

```sql
-- Individual feature access attempts
CREATE TABLE IF NOT EXISTS feature_access_attempts (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id, feature_id, attempted_at)
);

CREATE INDEX idx_feature_attempts_workspace ON feature_access_attempts(workspace_id);
CREATE INDEX idx_feature_attempts_user ON feature_access_attempts(user_id);
CREATE INDEX idx_feature_attempts_feature ON feature_access_attempts(feature_id);

-- Batch summaries for email campaigns
CREATE TABLE IF NOT EXISTS feature_access_attempts_batch (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  attempts_json JSONB,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id),
  UNIQUE (workspace_id, user_id)
);
```

#### 1.2 Add Trial Access Support (Optional)

For 7-day trial feature access:

```sql
CREATE TABLE IF NOT EXISTS feature_trials (
  workspace_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  converted_to_tier TEXT,
  PRIMARY KEY (workspace_id, feature_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX idx_feature_trials_expires ON feature_trials(expires_at);
```

### Files Affected
- `lib/feature-preview.ts` — Feature catalog
- `lib/feature-access-tracking.ts` — Attempt tracking
- `components/features/*.tsx` — All preview components
- `app/api/analytics/*.ts` — Tracking endpoints

---

## Phase 2: Programme/Lessons (Week 2)

### Current State
- `components/ProgrammeJourney.tsx` — Shows locked lessons with "Locked" badge
- Lessons are gated by curriculum engine
- No preview shown for locked content

### Changes

#### 2.1 Update ProgrammeJourney Component

Replace hard lock icons with preview teaser:

**Before:**
```tsx
if (lesson.status === "locked") {
  return (
    <div className="pg-lesson-static">
      <LockIcon /> {lesson.title}
    </div>
  );
}
```

**After:**
```tsx
import { ProgressiveDisclosure } from "@/components/features";
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";

if (lesson.status === "locked") {
  const { attemptAccess } = useFeatureAccess(`lesson_${lesson.id}`, {
    userTier: workspace.plan,
    workspaceId: workspace.id,
  });

  return (
    <ProgressiveDisclosure
      featureId={`lesson_${lesson.id}`}
      title={lesson.title}
      teaser={
        <div>
          <h4>{lesson.title}</h4>
          <p className="text-sm text-muted">{lesson.summary}</p>
          {/* Show first bullet point of lesson content */}
          {lesson.keyPoints?.[0] && (
            <div className="mt-2 text-sm">
              Learn: {lesson.keyPoints[0]}
            </div>
          )}
        </div>
      }
      isLocked={true}
      onTryExpand={attemptAccess}
      onUpgrade={() => showUpgradeModal(lesson.requiredTier)}
      previewFraction={0.3}
    />
  );
}
```

#### 2.2 Add Lesson to Feature Catalog

Add each lesson gated behind a tier:

```typescript
// lib/feature-preview.ts
export const FEATURE_CATALOG: Record<string, Feature> = {
  // ... existing features
  lesson_chapter_2: {
    id: "lesson_chapter_2",
    name: "Chapter 2 - Business Systems",
    description: "Learn to build working business systems",
    minTier: "pro", // Or "business" depending on gating
    benefits: [
      "Working Business System template",
      "Process documentation",
      "Role assignments",
      "Tool recommendations",
    ],
    category: "lessons",
  },
};
```

#### 2.3 Update Chapter Gates

In chapter progress display, show preview of locked chapters:

```tsx
function ChapterCard({ chapter, workspace }) {
  if (chapter.status === "locked") {
    return (
      <FeaturePreview
        featureId={`chapter_${chapter.number}`}
        name={`Chapter ${chapter.number} - ${chapter.title}`}
        description={chapter.description}
        minTier={getPlanRequirement(chapter.number)}
        userTier={workspace.plan}
        benefits={chapter.learningOutcomes}
        preview={
          <div className="chapter-preview">
            <h4 className="font-bold">{chapter.title}</h4>
            <ul className="text-sm">
              {chapter.learningOutcomes.slice(0, 2).map((o) => (
                <li key={o}>✓ {o}</li>
              ))}
            </ul>
          </div>
        }
        onUpgrade={() => navigate("/billing")}
      />
    );
  }

  return <ChapterCardUnlocked chapter={chapter} />;
}
```

### Files to Update
- `components/ProgrammeJourney.tsx` — Lesson/chapter display
- `app/programme/page.tsx` — Programme overview
- `app/programme/chapter-*/page.tsx` — Chapter gates
- `lib/feature-preview.ts` — Add lesson features

---

## Phase 3: Studio & Features (Week 3)

### Current State
- `funnel-studio.tsx` — Large component with plan checks
- Projects limited by plan tier
- Templates limited/gated by tier
- Analytics are free but basic

### Changes

#### 3.1 Project Limit Teaser

When user hits project limit:

```tsx
// In studio/projects list
import { LockedFeatureTeaser } from "@/components/features";
import { getWorkspace } from "@/lib/workspaces";

function ProjectsList({ workspace }) {
  const projectCount = workspace.projects.length;
  const planLimits = { free: 3, pro: 999, business: 999, performance: 999 };
  const currentLimit = planLimits[workspace.plan];

  if (projectCount >= currentLimit) {
    return (
      <>
        <ProjectsGrid projects={workspace.projects} />
        <LockedFeatureTeaser
          featureName="Projects"
          userTier={workspace.plan}
          minTier="pro"
          currentUsage={projectCount}
          currentLimit={currentLimit}
          nextLimit={999}
          highlights={[
            "Unlimited projects",
            "Team access",
            "Advanced analytics",
          ]}
          benefits={[
            "Build without limits",
            "Team collaboration",
            "Priority support",
          ]}
          onUpgrade={() => navigate("/billing")}
        />
      </>
    );
  }

  return (
    <>
      <ProjectsGrid projects={workspace.projects} />
      <CreateProjectButton />
    </>
  );
}
```

#### 3.2 Template Library Preview

Show premium templates as locked previews:

```tsx
// components/TemplateLibrary.tsx
import { FeaturePreview } from "@/components/features";

function TemplateLibrary({ workspace }) {
  const hasTemplateAccess = hasFeatureAccess(workspace.plan, "premium_templates");

  const templates = TEMPLATE_CATALOG.map((template) => {
    if (!hasTemplateAccess && template.tier === "pro") {
      return (
        <FeaturePreview
          key={template.id}
          featureId={`template_${template.id}`}
          name={template.name}
          description={template.description}
          minTier="pro"
          userTier={workspace.plan}
          benefits={template.highlights}
          preview={
            <div className="template-thumbnail">
              <img src={template.thumbnail} alt={template.name} />
              <div className="template-type">{template.type}</div>
            </div>
          }
          onUpgrade={() => navigate("/billing")}
        />
      );
    }

    return (
      <TemplateCard
        key={template.id}
        template={template}
        onClick={() => useTemplate(template)}
      />
    );
  });

  return <div className="template-grid">{templates}</div>;
}
```

#### 3.3 Analytics Dashboard Teaser

Show analytics preview when locked:

```tsx
// app/numbers/page.tsx or analytics section
import { LockedFeatureTeaser } from "@/components/features";

function AnalyticsDashboard({ workspace }) {
  if (!hasFeatureAccess(workspace.plan, "advanced_analytics")) {
    return (
      <LockedFeatureTeaser
        featureName="Analytics dashboards"
        userTier={workspace.plan}
        minTier="pro"
        currentUsage={0}
        currentLimit={0}
        nextLimit={5}
        highlights={[
          "Real-time visitor tracking",
          "Conversion funnel analysis",
          "ROI by channel",
          "Custom date ranges",
        ]}
        benefits={[
          "See what's really working",
          "Optimize top converting channels",
          "Track revenue impact",
          "Export for presentations",
        ]}
        onUpgrade={() => navigate("/billing")}
      />
    );
  }

  return <FullAnalyticsDashboard />;
}
```

#### 3.4 Automation Rules Preview

Progressive disclosure for automation workflows:

```tsx
// components/studio/AutomationRules.tsx
import { ProgressiveDisclosure } from "@/components/features";

function AutomationRulesEditor({ workspace }) {
  const hasAccess = hasFeatureAccess(workspace.plan, "automation_rules");
  const rules = workspace.automationRules || [];

  return (
    <div>
      <h2>Automation Rules</h2>

      {!hasAccess && (
        <ProgressiveDisclosure
          featureId="automation_rules"
          title="Email Automation Sequences"
          teaser={
            <div>
              <h4 className="font-bold">What you can do:</h4>
              <ul className="text-sm space-y-1">
                <li>✓ Send welcome email sequences</li>
                <li>✓ Triggered messages on actions</li>
                <li>✗ Advanced workflows (locked)</li>
                <li>✗ Conditional logic (locked)</li>
              </ul>
            </div>
          }
          isLocked={true}
          onUpgrade={() => navigate("/billing")}
        />
      )}

      {hasAccess && (
        <RulesEditor rules={rules} />
      )}
    </div>
  );
}
```

### Files to Update
- `funnel-studio.tsx` — Add feature preview checks
- `components/studio/TemplateSelector.tsx` — Template teasers
- `app/numbers/page.tsx` — Analytics preview
- `components/studio/AutomationRules.tsx` — Automation preview
- `lib/feature-preview.ts` — Add templates, analytics, automation features

---

## Phase 4: Team & Collaboration (Week 4)

### Current State
- Team features behind "business" plan
- Error message when adding users on free/pro
- No preview of what team features enable

### Changes

#### 4.1 Team Collaboration Preview

When user tries to add team member on free/pro:

```tsx
// components/TeamSettings.tsx
import { UpgradePrompt } from "@/components/features";

function TeamSettingsPage({ workspace }) {
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const canAddMembers = hasFeatureAccess(workspace.plan, "team_collaboration");

  const handleAddMember = () => {
    if (!canAddMembers) {
      recordFeatureAttempt("team_collaboration");
      setShowUpgradePrompt(true);
      return;
    }

    // Show add member dialog
  };

  return (
    <div>
      <h2>Team & Collaboration</h2>

      {!canAddMembers && (
        <UpgradePrompt
          featureName="Team Collaboration"
          currentTier={workspace.plan}
          requiredTier="business"
          benefits={[
            "Add up to 10 team members",
            "Assign roles & permissions",
            "Track activity logs",
            "Delegate work to team",
          ]}
          price="$79/mo"
          onUpgrade={() => navigate("/billing")}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}

      {canAddMembers && (
        <TeamMembersList members={workspace.members} />
      )}

      <button onClick={handleAddMember}>
        {canAddMembers ? "Add team member" : "🔒 Add team member (Business)"}
      </button>
    </div>
  );
}
```

#### 4.2 Permissions Matrix Preview

Show what team members can do:

```tsx
// components/TeamSettingsPreview.tsx
function TeamCapabilitiesPreview() {
  return (
    <div className="capabilities-grid">
      <h4>Team member permissions:</h4>
      <table className="text-sm">
        <tr>
          <td>View projects</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Edit funnels</td>
          <td>✓</td>
        </tr>
        <tr className="text-muted">
          <td>Manage team</td>
          <td>✗ Business only</td>
        </tr>
        <tr className="text-muted">
          <td>View analytics</td>
          <td>✗ Business only</td>
        </tr>
      </table>
    </div>
  );
}
```

### Files to Update
- `components/TeamSettings.tsx` — Team UI
- `app/account/team/page.tsx` — Team management
- `lib/feature-preview.ts` — Add team features

---

## Phase 5: Integrations (Week 4)

### Current State
- Integrations (Stripe, Slack, Zapier) available at different tiers
- Basic error when unavailable
- No indication of what's possible

### Changes

#### 5.1 Integration Preview Cards

```tsx
// components/Integrations.tsx
import { FeaturePreview } from "@/components/features";

const INTEGRATIONS = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept payments & subscriptions",
    minTier: "pro",
    icon: StripeIcon,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Notifications in your Slack workspace",
    minTier: "business",
    icon: SlackIcon,
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to 5000+ apps",
    minTier: "business",
    icon: ZapierIcon,
  },
];

function IntegrationsPage({ workspace }) {
  return (
    <div className="integrations-grid">
      {INTEGRATIONS.map((integration) => {
        const hasAccess = hasFeatureAccess(
          workspace.plan,
          `integration_${integration.id}`
        );

        if (!hasAccess) {
          return (
            <FeaturePreview
              key={integration.id}
              featureId={`integration_${integration.id}`}
              name={integration.name}
              description={integration.description}
              minTier={integration.minTier}
              userTier={workspace.plan}
              preview={
                <div className="integration-preview">
                  <integration.icon size={40} />
                  <h4>{integration.name}</h4>
                </div>
              }
              benefits={[
                `Connect ${integration.name} to your workspace`,
                `Automate workflows with ${integration.name}`,
                `Real-time ${integration.name} notifications`,
              ]}
              onUpgrade={() => navigate("/billing")}
            />
          );
        }

        return (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            isConnected={isConnected(integration.id)}
          />
        );
      })}
    </div>
  );
}
```

### Files to Update
- `components/Integrations.tsx` — Integration directory
- `app/integrations/page.tsx` — Integrations page
- `lib/feature-preview.ts` — Add integration features

---

## Phase 6: Tier Comparison & Upsell (Week 5)

### Changes

#### 6.1 Billing Page Enhancement

When user visits pricing page, show recommended tier based on attempts:

```tsx
// app/billing/page.tsx
import { TierComparisonOverlay } from "@/components/features";
import {
  getRecommendedUpgradeTier,
  getNextTierUnlocks,
} from "@/lib/feature-preview";
import { getTopAttemptedFeatures } from "@/lib/feature-access-tracking";

function BillingPage({ workspace, userId }) {
  const attempts = getTopAttemptedFeatures(5);
  const recommendedTier = getRecommendedUpgradeTier(attempts);

  return (
    <div>
      <h1>Plans & Pricing</h1>

      {recommendedTier && (
        <div className="recommended-banner">
          <h3>Recommended for you: {TIER_LABELS[recommendedTier]}</h3>
          <p>
            Based on the {attempts[0].name} you tried,
            upgrade to {TIER_LABELS[recommendedTier]} to unlock {attempts.length} features.
          </p>
        </div>
      )}

      <TierComparisonOverlay
        userTier={workspace.plan}
        recommendedTier={recommendedTier}
        onSelectTier={(tier) => startCheckout(tier)}
        pricing={{
          free: "Free forever",
          pro: "$29/mo",
          business: "$79/mo",
          performance: "$199/mo",
        }}
      />
    </div>
  );
}
```

#### 6.2 Upgrade Path Consistency

Ensure all upgrade CTAs point to same place with params:

```tsx
// Consistent upgrade flow
const UPGRADE_HREF = (tier?: FeatureTier, feature?: string) => {
  const params = new URLSearchParams();
  if (tier) params.append("plan", tier);
  if (feature) params.append("feature", feature);
  return `/billing?${params.toString()}`;
};

// Usage
<button onClick={() => navigate(UPGRADE_HREF("pro", "advanced_analytics"))}>
  Upgrade to Pro
</button>
```

### Files to Update
- `app/billing/page.tsx` — Pricing page
- `app/billing/checkout/page.tsx` — Checkout flow
- All components with upgrade CTAs — Use consistent href

---

## Phase 7: Email & Personalization (Week 5-6)

### Changes

#### 7.1 Upsell Email Template

Use tracked attempts to personalize upgrade emails:

```tsx
// lib/email/upsell-email.ts
import { getTopAttemptedFeatures } from "@/lib/feature-access-tracking";

async function generateUpsellEmail(userId: string, workspaceId: string) {
  const attempts = await getTopAttemptedFeatures(3);

  if (attempts.length === 0) return null;

  const topFeature = attempts[0];
  const minTier = getFeatureMinTier(topFeature.featureId);

  return {
    subject: `Unlock ${topFeature.name} → We noticed you tried it ${topFeature.count} times`,
    body: `
      Hi there,

      We noticed you tried to use ${topFeature.name} ${topFeature.count} times this week.
      That tells us you're ready for the next level.

      Upgrade to ${TIER_LABELS[minTier!]} to unlock:
      - ${topFeature.name}
      - And ${NEXT_TIER_UNLOCKS[minTier!].length - 1} other powerful features

      [Upgrade Now] →
    `,
  };
}
```

#### 7.2 Weekly Summary Email

Include feature usage in weekly digest:

```tsx
// Send list of attempted features in weekly email
async function weeklyDigest(userId: string) {
  const attempts = getRecentAttempts(7);

  if (attempts.length > 0) {
    return {
      section: "Features you tried",
      items: attempts.map((a) => ({
        feature: a.featureId,
        times: a.count,
        tier: getFeatureMinTier(a.featureId),
      })),
    };
  }

  return null;
}
```

### Files to Update
- `lib/email/templates/*.ts` — Email templates
- `lib/coach/digest-run.ts` — Weekly digest

---

## Phase 8: Testing & QA (Week 6)

### Test Cases

```tsx
// test/feature-preview.test.ts
describe("Feature Access", () => {
  test("free plan cannot access pro features", () => {
    expect(hasFeatureAccess("free", "advanced_analytics")).toBe(false);
  });

  test("pro plan can access pro features", () => {
    expect(hasFeatureAccess("pro", "advanced_analytics")).toBe(true);
  });

  test("records feature attempts", () => {
    recordFeatureAttempt("advanced_analytics");
    expect(getFeatureAttemptCount("advanced_analytics")).toBe(1);
  });

  test("returns recommended tier based on attempts", () => {
    recordFeatureAttempt("advanced_analytics");
    recordFeatureAttempt("advanced_analytics");
    recordFeatureAttempt("automation_rules");
    const recommended = getRecommendedUpgradeTier(
      loadFeatureAttempts()
    );
    expect(recommended).toBe("pro");
  });
});
```

### Manual QA Checklist

- [ ] Free plan user sees previews for all locked features
- [ ] Pro plan user sees unlocked analytics
- [ ] Business plan user can add team members
- [ ] All upgrade CTAs navigate to correct billing page
- [ ] Feature attempts are tracked in localStorage
- [ ] Tier comparison shows current plan marker
- [ ] Trial button works (if enabled)
- [ ] All links use consistent styling
- [ ] Mobile responsive on all components
- [ ] Keyboard navigation works

---

## Rollout Plan

1. **Day 1-2:** Deploy Phase 1 (infrastructure)
2. **Day 3-4:** Deploy Phase 2 (lessons)
3. **Day 5-6:** Deploy Phase 3 (studio features)
4. **Day 7:** Deploy Phase 4 (team) & Phase 5 (integrations)
5. **Day 8-9:** Deploy Phase 6 (billing)
6. **Day 10+:** Deploy Phase 7-8 (email, testing)

Monitor analytics for:
- Feature preview click-through rates
- Upgrade initiation rates
- Trial conversions
- Revenue impact

## Success Metrics

- **Preview CTR:** 20%+ click-through on upgrade buttons
- **Conversion:** 5-10% of preview viewers upgrade
- **Engagement:** Users attempt locked features 2+ times/week
- **Revenue:** 15%+ uplift in MRR from upgrade conversion
- **Satisfaction:** No reduction in user satisfaction scores

## Rollback Plan

If issues found:
1. Disable feature tracking (don't show prompts)
2. Revert to hard locks (show simpler UI)
3. Investigate root cause
4. Re-enable incrementally by feature

All changes are additive and non-breaking, so rollback is safe.
