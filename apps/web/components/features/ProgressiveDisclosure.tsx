"use client";

/**
 * ProgressiveDisclosure Component
 * Shows partial previews of locked features, revealing more on hover/click.
 * Creates intrigue and drives users toward upgrade CTA.
 */

import { ReactNode, useState } from "react";
import { ChevronDownIcon, LockClosedIcon as LockIcon } from "@heroicons/react/24/outline";

export interface ProgressiveDisclosureProps {
  /** Unique identifier */
  featureId: string;
  /** Title of what's being shown */
  title: string;
  /** Teaser text (always visible) */
  teaser: ReactNode;
  /** Full content (shown on expand/unlock) */
  fullContent?: ReactNode;
  /** Whether this feature is locked */
  isLocked: boolean;
  /** Callback when user tries to expand locked content */
  onTryExpand?: () => void;
  /** Callback to trigger upgrade */
  onUpgrade?: () => void;
  /** Visible preview fraction (0-1) when locked */
  previewFraction?: number;
  /** Show "hint" text on hover */
  showHint?: boolean;
  /** Custom CTA text */
  ctaText?: string;
}

export function ProgressiveDisclosure({
  title,
  teaser,
  fullContent,
  isLocked,
  onTryExpand,
  onUpgrade,
  previewFraction = 0.4,
  showHint = true,
  ctaText = "Unlock to see more",
}: ProgressiveDisclosureProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleExpandClick = () => {
    if (isLocked) {
      onTryExpand?.();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const teaserHeight = isLocked && previewFraction ? `${previewFraction * 200}px` : "auto";

  return (
    <div className={`progressive-disclosure ${isLocked ? "locked" : "unlocked"}`}>
      {/* Header */}
      <div className="pd-header">
        <h3 className="pd-title">{title}</h3>
        {isLocked && <LockIcon width={16} height={16} className="pd-lock-icon" />}
      </div>

      {/* Teaser content */}
      <div
        className={`pd-teaser ${isExpanded ? "expanded" : ""}`}
        style={{
          maxHeight: !isExpanded && isLocked ? teaserHeight : "none",
          overflow: "hidden",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {teaser}

        {/* Overlay when locked and not expanded */}
        {isLocked && !isExpanded && (
          <div className={`pd-overlay ${isHovered ? "hovered" : ""}`}>
            <div className="pd-overlay-content">
              {showHint && <div className="pd-hint">↓ Scroll to see more</div>}
            </div>
          </div>
        )}
      </div>

      {/* Full content (if provided) */}
      {fullContent && !isLocked && isExpanded && (
        <div className="pd-full-content">{fullContent}</div>
      )}

      {/* Expand/Unlock button */}
      <div className="pd-actions">
        {!isLocked && fullContent && (
          <button onClick={handleExpandClick} className="pd-expand-btn">
            <span>{isExpanded ? "Show less" : "Show more"}</span>
            <ChevronDownIcon
              width={16}
              height={16}
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>
        )}

        {isLocked && (
          <>
            <button onClick={onUpgrade} className="pd-unlock-btn">
              <LockIcon width={14} height={14} />
              <span>Unlock now</span>
            </button>
            <div className="pd-cta-text">{ctaText}</div>
          </>
        )}
      </div>

      <style jsx>{`
        .progressive-disclosure {
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 10px;
          background: var(--surface, #fff);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .progressive-disclosure.locked {
          background: var(--surface-muted, #fafbfc);
          border-color: var(--border-muted, #f3f4f6);
        }

        .pd-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border2, #e5e7eb);
        }

        .pd-title {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
          color: var(--text, #1f2937);
        }

        .pd-lock-icon {
          color: var(--text-muted, #9ca3af);
          margin-left: auto;
        }

        .pd-teaser {
          padding: 14px 16px;
          position: relative;
          transition: max-height 0.3s ease;
        }

        .pd-teaser.expanded {
          max-height: none !important;
        }

        /* Overlay gradient when content is truncated */
        .pd-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(to top, var(--surface-muted, #fafbfc), rgba(250, 251, 252, 0.3));
          display: flex;
          align-items: flex-end;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .pd-overlay.hovered {
          background: linear-gradient(to top, var(--surface-muted, #fafbfc) 0%, rgba(250, 251, 252, 0.6) 100%);
        }

        .pd-overlay-content {
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .pd-hint {
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
          font-weight: 500;
          animation: bounce 1.5s infinite;
        }

        @keyframes bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }

        /* Full content */
        .pd-full-content {
          padding: 14px 16px;
          border-top: 1px solid var(--border2, #e5e7eb);
          background: var(--surface2, #f9fafb);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text, #1f2937);
        }

        /* Actions */
        .pd-actions {
          padding: 12px 16px;
          border-top: 1px solid var(--border2, #e5e7eb);
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface2, #f9fafb);
        }

        .pd-expand-btn,
        .pd-unlock-btn {
          background: none;
          border: 1px solid var(--border2, #e5e7eb);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text, #1f2937);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .pd-expand-btn:hover,
        .pd-unlock-btn:hover {
          background: var(--surface, #fff);
          border-color: var(--text-muted, #9ca3af);
        }

        .pd-unlock-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: none;
          color: white;
          font-weight: 600;
        }

        .pd-unlock-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(245, 158, 11, 0.2);
        }

        .pd-cta-text {
          font-size: 11px;
          color: var(--text-muted, #9ca3af);
          margin-left: auto;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
