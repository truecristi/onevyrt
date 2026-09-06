"use client";

/**
 * TierComparisonOverlay Component
 * Shows side-by-side tier comparison matrix to drive upgrades.
 * Highlights current plan and next recommended tier.
 */

import React from "react";
import type { FeatureTier } from "../../lib/feature-preview";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, LockClosedIcon as LockIcon, XMarkIcon as X } from "@heroicons/react/24/outline";

export interface TierComparisonOverlayProps {
  /** User's current plan */
  userTier: FeatureTier | undefined;
  /** Recommended next tier (optional) */
  recommendedTier?: FeatureTier;
  /** Show which feature triggered the comparison */
  featureName?: string;
  /** Callback to close overlay */
  onClose?: () => void;
  /** Callback to select a tier for upgrade */
  onSelectTier?: (tier: FeatureTier) => void;
  /** Pricing information (optional) */
  pricing?: Record<FeatureTier, string>;
}

export function TierComparisonOverlay({
  userTier,
  recommendedTier,
  featureName,
  onClose,
  onSelectTier,
  pricing,
}: TierComparisonOverlayProps) {
  const [expandedFeature, setExpandedFeature] = React.useState<string | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);

  const TIER_ORDER: FeatureTier[] = ["free", "pro", "business", "performance"];
  const TIER_LABELS: Record<FeatureTier, string> = {
    free: "Free",
    pro: "Pro",
    business: "Business",
    performance: "Performance",
  };

  const TIER_DESCRIPTIONS: Record<FeatureTier, string> = {
    free: "Great for trying",
    pro: "Most popular",
    business: "For teams",
    performance: "Enterprise-grade",
  };

  const TIER_COLORS: Record<FeatureTier, { bg: string; border: string; text: string }> = {
    free: { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280" },
    pro: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
    business: { bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" },
    performance: { bg: "#fce7f3", border: "#fbcfe8", text: "#831843" },
  };

  const FEATURES: Array<{
    name: string;
    free: boolean | string;
    pro: boolean | string;
    business: boolean | string;
    performance: boolean | string;
  }> = [
    {
      name: "Projects",
      free: "3",
      pro: "Unlimited",
      business: "Unlimited",
      performance: "Unlimited",
    },
    {
      name: "Team members",
      free: "Just you",
      pro: "Just you",
      business: "Up to 10",
      performance: "Unlimited",
    },
    {
      name: "Templates",
      free: "5 basic",
      pro: "50+ premium",
      business: "100+",
      performance: "200+ + custom",
    },
    {
      name: "Analytics",
      free: false,
      pro: true,
      business: "Advanced",
      performance: "Enterprise",
    },
    {
      name: "Automation",
      free: false,
      pro: "10 workflows",
      business: "50 workflows",
      performance: "Unlimited",
    },
    {
      name: "Integrations",
      free: false,
      pro: "5 integrations",
      business: "20+ integrations",
      performance: "All + webhooks",
    },
    {
      name: "API access",
      free: false,
      pro: false,
      business: true,
      performance: true,
    },
    {
      name: "Support",
      free: "Community",
      pro: "Email",
      business: "Priority",
      performance: "Dedicated",
    },
  ];

  const FeatureValue = ({
    value,
    tier,
  }: {
    value: boolean | string;
    tier: FeatureTier;
  }) => {
    if (typeof value === "boolean") {
      return value ? (
        <CheckIcon width={18} height={18} color="#10b981" />
      ) : (
        <LockIcon width={16} height={16} color="#d1d5db" />
      );
    }
    return (
      <span className="tcp-feature-value" style={{ color: TIER_COLORS[tier].text }}>
        {value}
      </span>
    );
  };

  return (
    <div className="tier-comparison-overlay">
      {/* Header */}
      <div className="tcp-header">
        <div>
          <h2 className="tcp-title">
            {featureName
              ? `Unlock ${featureName}`
              : "Choose your plan"}
          </h2>
          <p className="tcp-subtitle">
            See what's included at each tier
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="tcp-close" aria-label="Close comparison">
            <X width={20} height={20} />
          </button>
        )}
      </div>

      {/* Tier cards (always visible on desktop, collapsible on mobile) */}
      <div className={`tcp-tiers ${isExpanded ? "expanded" : ""}`}>
        {TIER_ORDER.map((tier) => {
          const isCurrentPlan = tier === userTier;
          const isRecommended = tier === recommendedTier && tier !== userTier;
          const colors = TIER_COLORS[tier];

          return (
            <div
              key={tier}
              className={`tcp-tier-card ${isCurrentPlan ? "current" : ""} ${isRecommended ? "recommended" : ""}`}
              style={{
                background: colors.bg,
                borderColor: colors.border,
              }}
            >
              {isCurrentPlan && (
                <div className="tcp-current-badge">✓ Your plan</div>
              )}
              {isRecommended && (
                <div className="tcp-recommended-badge">Recommended</div>
              )}

              <div className="tcp-tier-name">{TIER_LABELS[tier]}</div>
              <div className="tcp-tier-description">{TIER_DESCRIPTIONS[tier]}</div>

              {pricing && pricing[tier] && (
                <div className="tcp-price">{pricing[tier]}</div>
              )}

              {!isCurrentPlan && (
                <button
                  onClick={() => onSelectTier?.(tier)}
                  className={`tcp-select-btn ${isRecommended ? "recommended" : ""}`}
                >
                  Upgrade to {TIER_LABELS[tier]} →
                </button>
              )}

              {isCurrentPlan && (
                <div className="tcp-current-btn">Currently active</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Features table */}
      <div className="tcp-features-section">
        <div className="tcp-features-header">
          <h3 className="tcp-features-title">Feature comparison</h3>
          <button
            className="tcp-expand-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon width={16} height={16} />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <ChevronDownIcon width={16} height={16} />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>

        <div className="tcp-features-table">
          <div className="tcp-table-header">
            <div className="tcp-feature-name">Feature</div>
            {TIER_ORDER.map((tier) => (
              <div key={tier} className="tcp-tier-column">
                {TIER_LABELS[tier]}
              </div>
            ))}
          </div>

          <div className="tcp-table-body">
            {FEATURES.map((feature) => (
              <div key={feature.name} className="tcp-table-row">
                <div className="tcp-feature-name">
                  <button
                    className="tcp-feature-toggle"
                    onClick={() =>
                      setExpandedFeature(
                        expandedFeature === feature.name ? null : feature.name
                      )
                    }
                  >
                    {feature.name}
                    {expandedFeature === feature.name && (
                      <ChevronUpIcon width={14} height={14} />
                    )}
                    {expandedFeature !== feature.name && (
                      <ChevronDownIcon width={14} height={14} />
                    )}
                  </button>
                </div>

                {TIER_ORDER.map((tier) => (
                  <div key={`${feature.name}-${tier}`} className="tcp-tier-column">
                    <FeatureValue value={feature[tier]} tier={tier} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="tcp-footer">
        <p className="tcp-footer-text">
          All plans include our core coaching curriculum and community access. Upgrade anytime.
        </p>
      </div>

      <style jsx>{`
        .tier-comparison-overlay {
          background: var(--surface, #fff);
          border-radius: 16px;
          padding: 28px;
          max-width: 1000px;
          margin: 0 auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        /* Header */
        .tcp-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
          gap: 16px;
        }

        .tcp-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: var(--text, #1f2937);
        }

        .tcp-subtitle {
          font-size: 14px;
          color: var(--text-secondary, #6b7280);
          margin: 0;
        }

        .tcp-close {
          background: var(--surface2, #f9fafb);
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .tcp-close:hover {
          background: var(--surface, #fff);
          border-color: var(--text-muted, #9ca3af);
        }

        /* Tier cards */
        .tcp-tiers {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }

        @media (max-width: 768px) {
          .tcp-tiers:not(.expanded) {
            grid-template-columns: 1fr 1fr;
          }
        }

        .tcp-tier-card {
          border: 2px solid;
          border-radius: 12px;
          padding: 16px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s ease;
        }

        .tcp-tier-card.current {
          border-width: 3px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .tcp-tier-card.recommended {
          border-width: 3px;
        }

        .tcp-current-badge,
        .tcp-recommended-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .tcp-current-badge {
          background: #d1fae5;
          color: #065f46;
        }

        .tcp-recommended-badge {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #78350f;
        }

        .tcp-tier-name {
          font-size: 16px;
          font-weight: 700;
          margin-top: 4px;
        }

        .tcp-tier-description {
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
          line-height: 1.4;
        }

        .tcp-price {
          font-size: 18px;
          font-weight: 700;
          margin: 4px 0;
        }

        .tcp-select-btn,
        .tcp-current-btn {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: auto;
        }

        .tcp-select-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }

        .tcp-select-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .tcp-select-btn.recommended {
          font-weight: 700;
        }

        .tcp-current-btn {
          background: var(--surface2, #f9fafb);
          color: var(--text-secondary, #6b7280);
          border: 1px solid var(--border2, #e5e7eb);
          cursor: default;
        }

        /* Features section */
        .tcp-features-section {
          border-top: 1px solid var(--border2, #e5e7eb);
          padding-top: 28px;
        }

        .tcp-features-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .tcp-features-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }

        .tcp-expand-toggle {
          background: var(--surface2, #f9fafb);
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .tcp-expand-toggle:hover {
          background: var(--surface, #fff);
          border-color: var(--text-muted, #9ca3af);
        }

        /* Table */
        .tcp-features-table {
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 8px;
          overflow: hidden;
        }

        .tcp-table-header,
        .tcp-table-row {
          display: grid;
          grid-template-columns: 160px repeat(4, 1fr);
          gap: 0;
          border-bottom: 1px solid var(--border2, #e5e7eb);
          font-size: 13px;
        }

        .tcp-table-row:last-child {
          border-bottom: none;
        }

        .tcp-table-header {
          background: var(--surface2, #f9fafb);
          font-weight: 700;
          position: sticky;
          top: 0;
        }

        .tcp-feature-name,
        .tcp-tier-column {
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tcp-table-header .tcp-feature-name {
          justify-content: flex-start;
          background: var(--surface2, #f9fafb);
        }

        .tcp-table-header .tcp-tier-column {
          background: var(--surface2, #f9fafb);
          font-weight: 700;
        }

        .tcp-feature-toggle {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text, #1f2937);
          font-size: 13px;
          font-weight: 600;
          justify-self: flex-start;
          padding: 0;
        }

        .tcp-feature-toggle:hover {
          text-decoration: underline;
        }

        .tcp-feature-value {
          font-weight: 600;
        }

        /* Footer */
        .tcp-footer {
          border-top: 1px solid var(--border2, #e5e7eb);
          padding-top: 20px;
          margin-top: 28px;
          text-align: center;
        }

        .tcp-footer-text {
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
          margin: 0;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .tier-comparison-overlay {
            padding: 20px;
          }

          .tcp-tiers {
            grid-template-columns: 1fr;
          }

          .tcp-features-table {
            overflow-x: auto;
          }

          .tcp-table-header,
          .tcp-table-row {
            grid-template-columns: 140px repeat(4, 100px);
          }
        }
      `}</style>
    </div>
  );
}
