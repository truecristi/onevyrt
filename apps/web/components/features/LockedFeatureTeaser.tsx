"use client";

/**
 * LockedFeatureTeaser Component
 * Shows usage limits and what features are locked behind a tier upgrade.
 * Displays current usage vs plan limit and highlights value proposition.
 */

import type { FeatureTier } from "../../lib/feature-preview";
import { ExclamationCircleIcon as AlertCircleIcon, CheckIcon, ChevronRightIcon, ArrowTrendingUpIcon as TrendingUpIcon } from "@heroicons/react/24/outline";

export interface LockedFeatureTeaserProps {
  /** Feature name being shown */
  featureName: string;
  /** Current plan the user has */
  userTier: FeatureTier | undefined;
  /** Minimum tier to unlock full feature */
  minTier: FeatureTier;
  /** Current usage (e.g., projects used) */
  currentUsage: number;
  /** Limit for current plan */
  currentLimit: number;
  /** Limit for next tier */
  nextLimit: number;
  /** Highlights of what's available */
  highlights: string[];
  /** What user gains by upgrading */
  benefits: string[];
  /** Callback to trigger upgrade flow */
  onUpgrade?: () => void;
  /** Callback to start trial */
  onTrial?: () => void;
  /** Show detailed comparison */
  showComparison?: boolean;
  /** Custom CTA text */
  ctaText?: string;
}

export function LockedFeatureTeaser({
  featureName,
  minTier,
  currentUsage,
  currentLimit,
  nextLimit,
  highlights,
  benefits,
  onUpgrade,
  onTrial,
  showComparison = true,
  ctaText = "Upgrade Now",
}: LockedFeatureTeaserProps) {
  const TIER_LABELS: Record<FeatureTier, string> = {
    free: "Free",
    pro: "Pro",
    business: "Business",
    performance: "Performance",
  };

  const TIER_COLORS: Record<FeatureTier, string> = {
    free: "#6b7280",
    pro: "#3b82f6",
    business: "#8b5cf6",
    performance: "#ec4899",
  };

  const isAtLimit = currentUsage >= currentLimit;
  const nextTierColor = TIER_COLORS[minTier];

  return (
    <div className="locked-feature-teaser">
      {/* Top alert if at limit */}
      {isAtLimit && (
        <div className="lft-alert">
          <AlertCircleIcon width={18} height={18} />
          <div>
            <div className="lft-alert-title">You've hit your limit</div>
            <div className="lft-alert-message">
              You're using {currentUsage}/{currentLimit} {featureName.toLowerCase()}. Upgrade to {TIER_LABELS[minTier]} for more.
            </div>
          </div>
        </div>
      )}

      {/* Usage indicator */}
      <div className="lft-usage-section">
        <div className="lft-usage-header">
          <div>
            <div className="lft-usage-label">Current usage</div>
            <div className="lft-usage-stats">
              <span className="lft-usage-current">{currentUsage}</span>
              <span className="lft-usage-separator">/</span>
              <span className="lft-usage-limit">{currentLimit}</span>
              <span className="lft-usage-name">{featureName}</span>
            </div>
          </div>
          <div className="lft-progress-container">
            <div className="lft-progress-bar">
              <div
                className="lft-progress-fill"
                style={{
                  width: `${Math.min((currentUsage / currentLimit) * 100, 100)}%`,
                  backgroundColor: isAtLimit ? "#ef4444" : "#3b82f6",
                }}
              />
            </div>
            <div className="lft-progress-label">
              {Math.round((currentUsage / currentLimit) * 100)}%
            </div>
          </div>
        </div>

        {/* Next tier upgrade offer */}
        <div className="lft-upgrade-offer" style={{ borderLeftColor: nextTierColor }}>
          <div className="lft-offer-content">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUpIcon width={18} height={18} style={{ color: nextTierColor }} />
              <div>
                <div className="lft-offer-title">Upgrade to {TIER_LABELS[minTier]}</div>
                <div className="lft-offer-subtitle">
                  Get {nextLimit === 999 ? "unlimited" : nextLimit} {featureName.toLowerCase()}
                  {nextLimit !== 999 && ` (+${nextLimit - currentLimit})`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="lft-highlights">
          <div className="lft-section-label">What you're missing:</div>
          <div className="lft-highlights-grid">
            {highlights.map((highlight, i) => (
              <div key={i} className="lft-highlight-item">
                <div className="lft-highlight-lock">🔒</div>
                <div className="lft-highlight-text">{highlight}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benefits of upgrading */}
      {benefits.length > 0 && (
        <div className="lft-benefits">
          <div className="lft-section-label">You'll also get:</div>
          <ul className="lft-benefits-list">
            {benefits.map((benefit, i) => (
              <li key={i}>
                <CheckIcon width={16} height={16} />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Comparison table (optional) */}
      {showComparison && (
        <div className="lft-comparison">
          <div className="lft-section-label">Plan comparison</div>
          <div className="lft-comparison-table">
            <div className="lft-comparison-row">
              <div className="lft-comparison-feature">Capacity</div>
              <div className="lft-comparison-cell">
                <span className="lft-current-plan">{currentLimit}</span>
              </div>
              <div className="lft-comparison-cell lft-comparison-next">
                <span className="lft-next-plan">
                  {nextLimit === 999 ? "Unlimited" : nextLimit}
                </span>
              </div>
            </div>
            {/* Add more comparison rows as needed */}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <div className="lft-cta-group">
        <button onClick={onUpgrade} className="lft-upgrade-btn">
          <span>{ctaText}</span>
          <ChevronRightIcon width={16} height={16} />
        </button>
        {onTrial && (
          <button onClick={onTrial} className="lft-trial-btn">
            Try free for 7 days
          </button>
        )}
      </div>

      <style jsx>{`
        .locked-feature-teaser {
          background: var(--surface, #fff);
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        /* Alert */
        .lft-alert {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #7f1d1d;
        }

        .lft-alert svg {
          flex-shrink: 0;
          color: #ef4444;
          margin-top: 2px;
        }

        .lft-alert-title {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 2px;
        }

        .lft-alert-message {
          font-size: 12px;
          line-height: 1.5;
        }

        /* Usage Section */
        .lft-usage-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .lft-usage-header {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .lft-usage-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted, #9ca3af);
          margin-bottom: 4px;
        }

        .lft-usage-stats {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-size: 14px;
        }

        .lft-usage-current {
          font-size: 20px;
          font-weight: 700;
          color: var(--text, #1f2937);
        }

        .lft-usage-separator {
          color: var(--text-muted, #9ca3af);
        }

        .lft-usage-limit {
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
        }

        .lft-usage-name {
          color: var(--text-muted, #9ca3af);
          margin-left: 4px;
        }

        .lft-progress-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          justify-content: center;
        }

        .lft-progress-bar {
          height: 6px;
          background: var(--surface2, #f9fafb);
          border-radius: 999px;
          overflow: hidden;
          flex: 1;
        }

        .lft-progress-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 999px;
        }

        .lft-progress-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #9ca3af);
        }

        /* Upgrade Offer */
        .lft-upgrade-offer {
          padding: 12px;
          background: var(--surface2, #f9fafb);
          border-radius: 8px;
          border-left: 4px solid;
        }

        .lft-offer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .lft-offer-title {
          font-weight: 600;
          font-size: 13px;
          color: var(--text, #1f2937);
          margin-bottom: 2px;
        }

        .lft-offer-subtitle {
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
        }

        /* Highlights */
        .lft-highlights {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lft-section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted, #9ca3af);
        }

        .lft-highlights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }

        .lft-highlight-item {
          padding: 10px;
          background: var(--surface2, #f9fafb);
          border-radius: 6px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .lft-highlight-lock {
          flex-shrink: 0;
          font-size: 14px;
        }

        .lft-highlight-text {
          font-size: 12px;
          color: var(--text, #1f2937);
          line-height: 1.4;
        }

        /* Benefits */
        .lft-benefits {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lft-benefits-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lft-benefits-list li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 13px;
          color: var(--text, #1f2937);
          line-height: 1.5;
        }

        .lft-benefits-list svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: #10b981;
        }

        /* Comparison */
        .lft-comparison {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lft-comparison-table {
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 8px;
          overflow: hidden;
        }

        .lft-comparison-row {
          display: grid;
          grid-template-columns: 1fr 100px 100px;
          padding: 12px;
          border-bottom: 1px solid var(--border2, #e5e7eb);
          font-size: 13px;
        }

        .lft-comparison-row:last-child {
          border-bottom: none;
        }

        .lft-comparison-feature {
          font-weight: 600;
          color: var(--text, #1f2937);
        }

        .lft-comparison-cell {
          text-align: center;
          color: var(--text-secondary, #6b7280);
        }

        .lft-comparison-next {
          background: var(--surface2, #f9fafb);
        }

        .lft-current-plan,
        .lft-next-plan {
          font-weight: 600;
        }

        .lft-next-plan {
          color: var(--accent, #f59e0b);
        }

        /* CTA Group */
        .lft-cta-group {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .lft-upgrade-btn,
        .lft-trial-btn {
          flex: 1;
          min-width: 140px;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .lft-upgrade-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }

        .lft-upgrade-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);
        }

        .lft-trial-btn {
          background: var(--surface2, #f9fafb);
          color: var(--text, #1f2937);
          border: 1px solid var(--border2, #e5e7eb);
        }

        .lft-trial-btn:hover {
          background: var(--surface, #fff);
          border-color: var(--text-muted, #9ca3af);
        }
      `}</style>
    </div>
  );
}
