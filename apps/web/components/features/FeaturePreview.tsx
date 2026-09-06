"use client";

/**
 * FeaturePreview Component
 * Teases locked features with partial previews and clear upgrade paths.
 * Shows what users are missing and exactly what they gain by upgrading.
 */

import { ReactNode } from "react";
import type { FeatureTier } from "../../lib/feature-preview";
import { ChevronRightIcon, LockClosedIcon as LockIcon, StarIcon } from "@heroicons/react/24/outline";

export interface FeaturePreviewProps {
  /** Unique feature identifier */
  featureId: string;
  /** Display name of the feature */
  name: string;
  /** Short description of what this feature does */
  description: string;
  /** Minimum tier required to access */
  minTier: FeatureTier;
  /** User's current plan tier */
  userTier: FeatureTier | undefined;
  /** Preview content (dimmed/blurred when locked) */
  preview?: ReactNode;
  /** Key benefits this feature provides */
  benefits: string[];
  /** Display price/plan name */
  planName?: string;
  /** Callback when user clicks upgrade */
  onUpgrade?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Show trial access option */
  showTrialOption?: boolean;
  /** Trial duration in days */
  trialDays?: number;
}

export function FeaturePreview({
  featureId,
  name,
  description,
  minTier,
  userTier,
  preview,
  benefits,
  planName = "Pro",
  onUpgrade,
  className = "",
  showTrialOption = false,
  trialDays = 7,
}: FeaturePreviewProps) {
  const TIER_HIERARCHY = { free: 0, pro: 1, business: 2, performance: 3 };
  const userTierValue = TIER_HIERARCHY[userTier ?? "free"];
  const requiredTierValue = TIER_HIERARCHY[minTier];
  const isLocked = userTierValue < requiredTierValue;

  return (
    <div
      className={`feature-preview ${isLocked ? "locked" : "unlocked"} ${className}`}
      data-feature={featureId}
    >
      {/* Header with lock badge */}
      <div className="fp-header">
        <div className="fp-title-area">
          <div className="fp-title-row">
            <h3 className="fp-name">{name}</h3>
            {isLocked && <div className="fp-lock-badge">🔒 {minTier}</div>}
            {!isLocked && <div className="fp-unlocked-badge">✓ Unlocked</div>}
          </div>
          <p className="fp-description">{description}</p>
        </div>
      </div>

      {/* Preview area - dimmed when locked */}
      {preview && (
        <div className={`fp-preview ${isLocked ? "fp-preview-locked" : ""}`}>
          {isLocked && <div className="fp-preview-overlay" />}
          <div className="fp-preview-content">{preview}</div>
          {isLocked && (
            <div className="fp-preview-cta">
              <LockIcon width={20} height={20} />
              <span>Upgrade to unlock this preview</span>
            </div>
          )}
        </div>
      )}

      {/* Benefits list */}
      <div className="fp-benefits">
        <div className="fp-benefits-label">What you get:</div>
        <ul className="fp-benefits-list">
          {benefits.map((benefit, i) => (
            <li key={i} className="fp-benefit-item">
              <StarIcon width={16} height={16} className="fp-benefit-icon" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA area */}
      {isLocked && (
        <div className="fp-cta-area">
          <button onClick={onUpgrade} className="fp-upgrade-btn">
            <span>Upgrade to {planName}</span>
            <ChevronRightIcon width={16} height={16} />
          </button>
          {showTrialOption && (
            <button className="fp-trial-btn">
              Try free for {trialDays} days
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .feature-preview {
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 12px;
          background: var(--surface, #fff);
          overflow: hidden;
          transition: all 0.3s ease;
          padding: 0;
        }

        .feature-preview.locked {
          border-color: var(--border-muted, #f3f4f6);
          background: var(--surface-muted, #fafbfc);
        }

        .fp-header {
          padding: 18px 20px;
          border-bottom: 1px solid var(--border2, #e5e7eb);
        }

        .fp-title-area {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fp-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .fp-name {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: var(--text, #1f2937);
        }

        .fp-lock-badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #78350f;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .fp-unlocked-badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          background: #d1fae5;
          color: #065f46;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .fp-description {
          font-size: 13px;
          color: var(--text-secondary, #6b7280);
          margin: 0;
          line-height: 1.5;
        }

        .fp-preview {
          position: relative;
          background: var(--surface2, #f9fafb);
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          border-bottom: 1px solid var(--border2, #e5e7eb);
        }

        .fp-preview-locked {
          position: relative;
        }

        .fp-preview-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%);
          backdrop-filter: blur(2px);
          z-index: 1;
        }

        .fp-preview-content {
          width: 100%;
          opacity: 0.5;
          filter: blur(1px);
        }

        .fp-preview-locked .fp-preview-content {
          opacity: 0.35;
          filter: blur(3px) grayscale(0.8);
        }

        .fp-preview-cta {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-secondary, #6b7280);
          font-size: 13px;
          font-weight: 500;
          z-index: 2;
        }

        .fp-preview-cta svg {
          color: var(--text-muted, #9ca3af);
        }

        .fp-benefits {
          padding: 18px 20px;
          border-bottom: 1px solid var(--border2, #e5e7eb);
        }

        .fp-benefits-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: var(--text-muted, #9ca3af);
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .fp-benefits-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fp-benefit-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
          color: var(--text, #1f2937);
          line-height: 1.5;
        }

        .fp-benefit-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--accent, #f59e0b);
        }

        .fp-cta-area {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .fp-upgrade-btn,
        .fp-trial-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .fp-upgrade-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }

        .fp-upgrade-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);
        }

        .fp-trial-btn {
          background: var(--surface2, #f9fafb);
          color: var(--text, #1f2937);
          border: 1px solid var(--border2, #e5e7eb);
        }

        .fp-trial-btn:hover {
          background: var(--surface, #fff);
          border-color: var(--text-muted, #9ca3af);
        }
      `}</style>
    </div>
  );
}
