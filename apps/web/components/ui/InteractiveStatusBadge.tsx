/**
 * ONEVYRT Interactive Status Badge — Clickable status indicators with tooltips.
 *
 * Features:
 * - Clickable status indicators
 * - Status explanation tooltip on hover
 * - Color-coded by status (approved/awaiting/rejected/locked)
 * - Animated state transitions
 * - Pulse animation for "awaiting" state
 * - Accessibility: proper contrast, focus states, ARIA labels
 *
 * Usage:
 *   <InteractiveStatusBadge
 *     status="approved"
 *     label="Chapter 1 Complete"
 *     explanation="You've defined your business blueprint."
 *     onClick={() => navigate('/chapter-1')}
 *   />
 */

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { STATUS_COLORS } from "@/lib/colors/chapter-tokens";

// CSSProperties has no index signature for custom properties (see the type's
// own doc comment) — extend it locally so the dynamic Tailwind ring color
// below is still fully typed rather than escaping to `any`.
interface BadgeButtonStyle extends CSSProperties {
  "--tw-ring-color"?: string;
}

export type BadgeStatus = "approved" | "awaiting" | "rejected" | "locked" | "inProgress" | "skipped";

// STATUS_COLORS (lib/colors/chapter-tokens.ts) doesn't track "locked"/"skipped" —
// those are badge-only states, not review/readiness states — so this maps every
// BadgeStatus to a color, borrowing from STATUS_COLORS where it overlaps.
const BADGE_STATUS_COLORS: Record<BadgeStatus, string> = {
  approved: STATUS_COLORS.approved,
  awaiting: STATUS_COLORS.awaiting,
  rejected: STATUS_COLORS.rejected,
  inProgress: STATUS_COLORS.inProgress,
  locked: "#64748b", // Slate — neutral, prerequisites not met
  skipped: STATUS_COLORS.notStarted, // Gray — not applicable
};

export interface InteractiveStatusBadgeProps {
  /** Status type */
  status: BadgeStatus;

  /** Display label */
  label?: string;

  /** Explanation text for tooltip */
  explanation?: string;

  /** Optional icon/emoji */
  icon?: string;

  /** Click handler */
  onClick?: () => void;

  /** Size variant */
  size?: "sm" | "md" | "lg";

  /** Whether to show pulse animation */
  pulse?: boolean;

  /** CSS className */
  className?: string;

  /** Aria label */
  ariaLabel?: string;
}

export function InteractiveStatusBadge({
  status,
  label,
  explanation,
  icon,
  onClick,
  size = "md",
  pulse = status === "awaiting",
  className = "",
  ariaLabel = `Status: ${status}`,
}: InteractiveStatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const statusColor = BADGE_STATUS_COLORS[status];
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  };

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTooltip]);

  const getStatusIcon = () => {
    if (icon) return icon;
    switch (status) {
      case "approved":
        return "✓";
      case "awaiting":
        return "⏱";
      case "rejected":
        return "✕";
      case "locked":
        return "🔒";
      case "inProgress":
        return "⚙";
      case "skipped":
        return "─";
      default:
        return "◉";
    }
  };

  return (
    <>
      <button
        ref={badgeRef}
        onClick={() => {
          if (onClick) onClick();
          if (explanation) setShowTooltip(!showTooltip);
        }}
        className={[
          sizeClasses[size],
          "rounded-full font-semibold transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "hover:shadow-md",
          onClick ? "cursor-pointer" : "cursor-default",
          pulse && status === "awaiting" ? "animate-pulse" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backgroundColor: `${statusColor}20`,
          color: statusColor,
          borderWidth: "1.5px",
          borderColor: statusColor,
          "--tw-ring-color": statusColor,
        } as BadgeButtonStyle}
        aria-label={ariaLabel}
        aria-pressed={showTooltip}
        aria-describedby={showTooltip ? `tooltip-${status}` : undefined}
      >
        <span className="inline-flex items-center gap-1">
          <span className="text-lg" role="img">
            {getStatusIcon()}
          </span>
          {label && <span className="font-medium">{label}</span>}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && explanation && (
        <div
          ref={tooltipRef}
          id={`tooltip-${status}`}
          className="absolute z-50 mt-2 p-3 bg-ds-surface rounded-lg shadow-lg border border-ds-border-default max-w-xs"
          role="tooltip"
          style={{
            backgroundColor: "var(--ds-surface)",
            borderColor: "var(--ds-border-default)",
            animation: "slideUp 200ms cubic-bezier(0.2, 0.7, 0.3, 1)",
          }}
        >
          <p className="text-sm text-ds-text-secondary m-0">{explanation}</p>
          {/* Tooltip arrow */}
          <div
            className="absolute w-2 h-2 transform rotate-45"
            style={{
              top: "-4px",
              left: "12px",
              backgroundColor: "var(--ds-surface)",
              borderTop: "1px solid var(--ds-border-default)",
              borderLeft: "1px solid var(--ds-border-default)",
            }}
          />
        </div>
      )}
    </>
  );
}

/**
 * Status Badge Group — Display multiple status badges together.
 */
export interface StatusBadgeGroupProps {
  /** Array of badge items */
  items: Array<{
    id: string;
    status: BadgeStatus;
    label?: string;
    explanation?: string;
    onClick?: () => void;
  }>;

  /** Layout direction */
  direction?: "row" | "column";

  /** Gap between badges */
  gap?: "sm" | "md" | "lg";

  /** CSS className */
  className?: string;
}

export function StatusBadgeGroup({
  items,
  direction = "row",
  gap = "md",
  className = "",
}: StatusBadgeGroupProps) {
  const gapClasses = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  };

  return (
    <div
      className={[
        "flex",
        direction === "row" ? "flex-row flex-wrap" : "flex-col",
        gapClasses[gap],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Status indicators"
    >
      {items.map((item) => (
        <div key={item.id} className="relative inline-block">
          <InteractiveStatusBadge
            status={item.status}
            label={item.label}
            explanation={item.explanation}
            onClick={item.onClick}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Animated Status Transition — Smoothly transition from one status to another.
 * Useful for showing progress (locked → awaiting → approved).
 */
export function AnimatedStatusTransition({
  from,
  to,
  duration = 600,
  onComplete,
}: {
  from: BadgeStatus;
  to: BadgeStatus;
  duration?: number;
  onComplete?: () => void;
}) {
  const [current, setCurrent] = useState<BadgeStatus>(from);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (current === to) {
      onComplete?.();
      return;
    }

    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setCurrent(to);
      setIsTransitioning(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [to, current, duration, onComplete]);

  return (
    <div
      style={{
        opacity: isTransitioning ? 0.5 : 1,
        transition: `opacity ${duration}ms ease-in-out`,
      }}
    >
      <InteractiveStatusBadge
        status={current}
        label={current}
        size="lg"
      />
    </div>
  );
}
