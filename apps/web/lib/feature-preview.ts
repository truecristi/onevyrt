/**
 * Feature Preview System
 * Replaces hard feature locks with interactive previews that tease locked features
 * and drive upgrades through clear value communication and progressive disclosure.
 */

export type FeatureTier = "free" | "pro" | "business" | "performance";

export interface FeatureLimit {
  free: number;
  pro: number;
  business: number;
  performance: number;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  minTier: FeatureTier;
  icon?: string;
  /** List of benefits this feature provides */
  benefits: string[];
  /** Current usage for user (if applicable) */
  currentUsage?: number;
  /** Limit for free plan */
  limit?: FeatureLimit;
  /** Category: analytics, automation, templates, team, integrations, lessons */
  category: "analytics" | "automation" | "templates" | "team" | "integrations" | "lessons" | "other";
}

export interface LockedFeatureAttempt {
  featureId: string;
  attemptedAt: string;
  count: number;
  lastAttemptedAt: string;
}

/**
 * Tier-specific feature entitlements.
 * A feature is accessible if the user's plan tier >= minTier
 */
export const FEATURE_CATALOG: Record<string, Feature> = {
  advanced_analytics: {
    id: "advanced_analytics",
    name: "Advanced Analytics",
    description: "Real-time traffic, conversion funnels, ROI by channel",
    minTier: "pro",
    benefits: ["Real-time visitor tracking", "Conversion funnel analysis", "ROI by channel", "Custom dashboards"],
    category: "analytics",
    limit: { free: 1, pro: 5, business: 20, performance: 999 },
  },
  automation_rules: {
    id: "automation_rules",
    name: "Automation Rules",
    description: "Triggered email sequences, form workflows, lead routing",
    minTier: "pro",
    benefits: [
      "Email automation sequences",
      "Conditional workflows",
      "Triggered actions",
      "Multi-step workflows",
    ],
    category: "automation",
    limit: { free: 0, pro: 10, business: 50, performance: 999 },
  },
  team_collaboration: {
    id: "team_collaboration",
    name: "Team Collaboration",
    description: "Invite team members, assign roles, track permissions",
    minTier: "business",
    benefits: ["Multi-user access", "Role-based permissions", "Activity logging", "Team chat"],
    category: "team",
    limit: { free: 1, pro: 1, business: 10, performance: 999 },
  },
  premium_templates: {
    id: "premium_templates",
    name: "Premium Templates",
    description: "50+ funnel, landing page, and email templates",
    minTier: "pro",
    benefits: [
      "Webinar funnel templates",
      "High-converting landing pages",
      "Email sequence templates",
      "Industry-specific templates",
    ],
    category: "templates",
    limit: { free: 5, pro: 50, business: 100, performance: 999 },
  },
  custom_integrations: {
    id: "custom_integrations",
    name: "Custom Integrations",
    description: "Stripe, Slack, Zapier, custom webhooks",
    minTier: "business",
    benefits: [
      "Native Stripe integration",
      "Slack notifications",
      "Zapier support",
      "Custom webhooks",
    ],
    category: "integrations",
    limit: { free: 1, pro: 5, business: 20, performance: 999 },
  },
  advanced_reporting: {
    id: "advanced_reporting",
    name: "Advanced Reporting",
    description: "Custom reports, data export, historical analysis",
    minTier: "pro",
    benefits: [
      "PDF reports",
      "Data export (CSV/Excel)",
      "Historical trend analysis",
      "Custom date ranges",
    ],
    category: "analytics",
    limit: { free: 0, pro: 5, business: 20, performance: 999 },
  },
  white_label: {
    id: "white_label",
    name: "White Label",
    description: "Branded funnel funnels, custom domain, branded emails",
    minTier: "performance",
    benefits: [
      "Custom domain",
      "Remove ONEVYRT branding",
      "Custom email domain",
      "Branded checkout",
    ],
    category: "other",
  },
  coaching_studio: {
    id: "coaching_studio",
    name: "Coaching Studio",
    description: "Create and run coaching programmes, cohort management",
    minTier: "business",
    benefits: [
      "Build custom curricula",
      "Manage student cohorts",
      "Track progress",
      "Review submissions",
    ],
    category: "lessons",
  },
};

/** Tier comparison matrix for upsell overlays */
export const TIER_FEATURES: Record<FeatureTier, Record<string, boolean | string>> = {
  free: {
    projects: "3",
    users: "Just you",
    templates: "5 basics",
    analytics: "Basic only",
    automation: "None",
    team: "Not included",
    integrations: "None",
    support: "Community",
  },
  pro: {
    projects: "Unlimited",
    users: "Just you",
    templates: "50+ premium",
    analytics: "Full analytics",
    automation: "10 workflows",
    team: "Not included",
    integrations: "5 integrations",
    support: "Email support",
  },
  business: {
    projects: "Unlimited",
    users: "Up to 10",
    templates: "100+ templates",
    analytics: "Advanced",
    automation: "50 workflows",
    team: "Full collaboration",
    integrations: "20+ integrations",
    support: "Priority support",
  },
  performance: {
    projects: "Unlimited",
    users: "Unlimited",
    templates: "200+ templates + custom",
    analytics: "Enterprise analytics",
    automation: "Unlimited",
    team: "Advanced collaboration",
    integrations: "All + custom webhooks",
    support: "Dedicated account manager",
  },
};

/** Current plan hierarchy for feature access checks */
const TIER_HIERARCHY: Record<FeatureTier, number> = {
  free: 0,
  pro: 1,
  business: 2,
  performance: 3,
};

/**
 * Check if a user's plan has access to a feature
 * @param userPlan - User's current plan tier
 * @param featureId - Feature to check access for
 * @returns true if user can access the feature
 */
export function hasFeatureAccess(userPlan: FeatureTier | undefined, featureId: string): boolean {
  const feature = FEATURE_CATALOG[featureId];
  if (!feature) return false;
  const userTier = TIER_HIERARCHY[userPlan ?? "free"];
  const requiredTier = TIER_HIERARCHY[feature.minTier];
  return userTier >= requiredTier;
}

/**
 * Get the minimum plan required to access a feature
 * @param featureId - Feature to check
 * @returns Minimum tier needed, or null if feature doesn't exist
 */
export function getFeatureMinTier(featureId: string): FeatureTier | null {
  return FEATURE_CATALOG[featureId]?.minTier ?? null;
}

/**
 * Get next tier that grants access to a feature (for upsell copy)
 * @param userPlan - User's current plan
 * @param featureId - Feature to check
 * @returns Next tier that grants access, or null if already has access
 */
export function getUpgradeTierForFeature(
  userPlan: FeatureTier | undefined,
  featureId: string,
): FeatureTier | null {
  if (hasFeatureAccess(userPlan, featureId)) return null;
  const feature = FEATURE_CATALOG[featureId];
  if (!feature) return null;
  return feature.minTier;
}

/**
 * Get all locked features for a given plan
 * @param userPlan - User's current plan
 * @returns Features not accessible at this plan level
 */
export function getLockedFeatures(userPlan: FeatureTier | undefined): Feature[] {
  return Object.values(FEATURE_CATALOG).filter((f) => !hasFeatureAccess(userPlan, f.id));
}

/**
 * Get all accessible features for a given plan
 * @param userPlan - User's current plan
 * @returns Features accessible at this plan level
 */
export function getAccessibleFeatures(userPlan: FeatureTier | undefined): Feature[] {
  return Object.values(FEATURE_CATALOG).filter((f) => hasFeatureAccess(userPlan, f.id));
}

/**
 * Get features that become available at the next tier
 * @param userPlan - User's current plan
 * @returns New features unlocked by upgrading
 */
export function getNextTierUnlocks(userPlan: FeatureTier | undefined): Feature[] {
  const tiers: FeatureTier[] = ["free", "pro", "business", "performance"];
  const currentTierIndex = tiers.indexOf(userPlan ?? "free");
  if (currentTierIndex >= tiers.length - 1) return []; // Already at max

  const nextTier = tiers[currentTierIndex + 1]!;
  const nextTierHierarchy = TIER_HIERARCHY[nextTier];

  return Object.values(FEATURE_CATALOG).filter((f) => {
    const featureTierHierarchy = TIER_HIERARCHY[f.minTier];
    return featureTierHierarchy === nextTierHierarchy;
  });
}

/**
 * Get upgrade recommendations based on attempted feature access
 * @param attempts - Tracked feature access attempts
 * @returns Recommended tier to upgrade to
 */
export function getRecommendedUpgradeTier(attempts: LockedFeatureAttempt[]): FeatureTier | null {
  if (attempts.length === 0) return null;

  const tiers: FeatureTier[] = ["pro", "business", "performance"];
  const tierCounts: Record<FeatureTier, number> = { free: 0, pro: 0, business: 0, performance: 0 };

  for (const attempt of attempts) {
    const minTier = getFeatureMinTier(attempt.featureId);
    if (minTier && minTier !== "free") {
      tierCounts[minTier] = (tierCounts[minTier] || 0) + attempt.count;
    }
  }

  // Find tier with most attempts
  let maxCount = 0;
  let recommended: FeatureTier | null = null;
  for (const tier of tiers) {
    if (tierCounts[tier] > maxCount) {
      maxCount = tierCounts[tier];
      recommended = tier;
    }
  }

  return recommended;
}
