"use client";

/**
 * UpgradePrompt Component
 * Contextual upgrade messaging shown when users try to access locked features.
 * Shows clear path to upgrade with benefit highlights.
 */

import React from "react";
import type { FeatureTier } from "../../lib/feature-preview";
import { ArrowRightIcon, CheckIcon, LockClosedIcon as LockIcon, SparklesIcon, XMarkIcon as XIcon } from "@heroicons/react/24/outline";

export interface UpgradePromptProps {
  /** Feature that triggered the prompt */
  featureName: string;
  /** Current plan tier */
  currentTier: FeatureTier | undefined;
  /** Tier required to access */
  requiredTier: FeatureTier;
  /** Key benefits of upgrading */
  benefits: string[];
  /** Callback to close prompt */
  onClose?: () => void;
  /** Callback to start upgrade */
  onUpgrade?: () => void;
  /** Callback to start trial */
  onTrial?: () => void;
  /** Optional pricing info */
  price?: string;
  /** Show immediate action vs later option */
  showDismiss?: boolean;
}

export function UpgradePrompt({
  featureName,
  requiredTier,
  benefits,
  onClose,
  onUpgrade,
  onTrial,
  price,
  showDismiss = true,
}: UpgradePromptProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  const TIER_LABELS: Record<FeatureTier, string> = {
    free: "Free",
    pro: "Pro",
    business: "Business",
    performance: "Performance",
  };

  const TIER_COLORS: Record<FeatureTier, { light: string; dark: string }> = {
    free: { light: "#f3f4f6", dark: "#6b7280" },
    pro: { light: "#eff6ff", dark: "#1e40af" },
    business: { light: "#f5f3ff", dark: "#5b21b6" },
    performance: { light: "#fce7f3", dark: "#831843" },
  };

  if (isDismissed) return null;

  const tierColor = TIER_COLORS[requiredTier];

  return (
    <div className="upgrade-prompt" style={{ backgroundColor: tierColor.light }}>
      <div className="up-content">
        {/* Icon and main message */}
        <div className="up-main">
          <div className="up-icon-container">
            <div className="up-lock-icon">
              <LockIcon width={20} height={20} />
            </div>
          </div>
          <div className="up-message">
            <h3 className="up-title">
              <SparklesIcon width={18} height={18} />
              Unlock {featureName}
            </h3>
            <p className="up-subtitle">
              Upgrade to <strong>{TIER_LABELS[requiredTier]}</strong> to access this feature
            </p>
          </div>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={() => {
              setIsDismissed(true);
              onClose();
            }}
            className="up-close"
            aria-label="Close"
          >
            <XIcon width={18} height={18} />
          </button>
        )}
      </div>

      {/* Benefits list */}
      {benefits.length > 0 && (
        <ul className="up-benefits">
          {benefits.map((benefit, i) => (
            <li key={i}>
              <CheckIcon width={14} height={14} />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Pricing info */}
      {price && (
        <div className="up-pricing">
          <span className="up-price-label">Starting at</span>
          <span className="up-price" style={{ color: tierColor.dark }}>
            {price}
          </span>
        </div>
      )}

      {/* CTA buttons */}
      <div className="up-actions">
        <button onClick={onUpgrade} className="up-upgrade-btn" style={{ borderColor: tierColor.dark }}>
          <span>Upgrade Now</span>
          <ArrowRightIcon width={14} height={14} />
        </button>
        {onTrial && (
          <button onClick={onTrial} className="up-trial-btn">
            Try free for 7 days
          </button>
        )}
        {showDismiss && onClose && (
          <button
            onClick={() => {
              setIsDismissed(true);
              onClose();
            }}
            className="up-dismiss-btn"
          >
            Maybe later
          </button>
        )}
      </div>

      <style jsx>{`
        .upgrade-prompt {
          border: 2px solid;
          border-color: currentColor;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .up-content {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .up-main {
          display: flex;
          gap: 12px;
          flex: 1;
          align-items: flex-start;
        }

        .up-icon-container {
          flex-shrink: 0;
        }

        .up-lock-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text, #1f2937);
        }

        .up-message {
          flex: 1;
        }

        .up-title {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--text, #1f2937);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .up-title svg {
          color: var(--accent, #f59e0b);
        }

        .up-subtitle {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary, #6b7280);
          line-height: 1.4;
        }

        .up-close {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: var(--text-muted, #9ca3af);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .up-close:hover {
          background: rgba(0, 0, 0, 0.06);
          color: var(--text, #1f2937);
        }

        /* Benefits */
        .up-benefits {
          list-style: none;
          margin: 0;
          padding: 0 0 0 40px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .up-benefits li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text, #1f2937);
          line-height: 1.4;
        }

        .up-benefits svg {
          flex-shrink: 0;
          color: #10b981;
        }

        /* Pricing */
        .up-pricing {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.04);
          border-radius: 6px;
          margin-left: 40px;
        }

        .up-price-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #9ca3af);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .up-price {
          font-size: 14px;
          font-weight: 700;
        }

        /* Actions */
        .up-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-left: 40px;
        }

        .up-upgrade-btn,
        .up-trial-btn,
        .up-dismiss-btn {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .up-upgrade-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border: 2px solid;
        }

        .up-upgrade-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(245, 158, 11, 0.2);
        }

        .up-trial-btn {
          background: var(--surface, #fff);
          color: var(--text, #1f2937);
          border: 1px solid var(--border2, #e5e7eb);
        }

        .up-trial-btn:hover {
          background: var(--surface2, #f9fafb);
        }

        .up-dismiss-btn {
          background: transparent;
          color: var(--text-secondary, #6b7280);
          border: 1px solid var(--border2, #e5e7eb);
        }

        .up-dismiss-btn:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        @media (max-width: 640px) {
          .up-actions,
          .up-benefits,
          .up-pricing {
            margin-left: 0 !important;
          }

          .up-actions {
            flex-direction: column;
          }

          .up-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
