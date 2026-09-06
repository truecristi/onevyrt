/**
 * ONEVYRT Animated Metric Card — Displays a metric with animations.
 *
 * Features:
 * - Number counter animation (0 → target)
 * - Trend indicator with animated arrow
 * - Sparkline animation on hover (optional)
 * - Color transition based on health status
 * - Flip animation on data update
 * - Loading skeleton state
 * - Responsive to theme changes
 *
 * Usage:
 *   <AnimatedMetricCard
 *     title="Revenue"
 *     value={15250}
 *     trend={{ value: 12, direction: "up" }}
 *     status="strong"
 *     format={(n) => `$${n.toLocaleString()}`}
 *   />
 */

import { useEffect, useRef, useState } from "react";
import { animateCounter } from "@/lib/animations/celebrations";
import { STATUS_COLORS } from "@/lib/colors/chapter-tokens";

export type MetricStatus = "fragile" | "developing" | "strong" | "excellent";

export interface AnimatedMetricCardProps {
  /** Display title (e.g., "Revenue", "Conversion Rate") */
  title: string;

  /** Current metric value */
  value: number;

  /** Previous value for flip animation on change */
  previousValue?: number;

  /** Trend info: value (percentage) and direction */
  trend?: {
    value: number;
    direction: "up" | "down" | "flat";
  };

  /** Visual status indicator (affects color) */
  status?: MetricStatus;

  /** Optional format function for display (e.g., currency, percentage) */
  format?: (n: number) => string;

  /** Loading state */
  isLoading?: boolean;

  /** Comparison text (e.g., "vs last month") */
  comparison?: string;

  /** Optional icon (URL or emoji) */
  icon?: string;

  /** Optional description text */
  description?: string;

  /** Click handler */
  onClick?: () => void;

  /** CSS className */
  className?: string;
}

export function AnimatedMetricCard({
  title,
  value,
  previousValue,
  trend,
  status = "strong",
  format = (n: number) => String(n),
  isLoading = false,
  comparison,
  icon,
  description,
  onClick,
  className = "",
}: AnimatedMetricCardProps) {
  const valueRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);

  // Animate counter when value changes
  useEffect(() => {
    if (isLoading) return;

    const previousVal = previousValue ?? 0;

    // Trigger flip animation on significant change
    if (previousVal !== 0 && previousVal !== value) {
      setIsFlipping(true);
      setTimeout(() => setIsFlipping(false), 300);
    }

    if (valueRef.current) {
      animateCounter(
        valueRef.current,
        previousVal === 0 ? 0 : displayValue,
        value,
        500,
        format
      );
    }
    setDisplayValue(value);
  }, [value, previousValue, isLoading, displayValue, format]);

  const statusColor = STATUS_COLORS[status];

  return (
    <div
      onClick={onClick}
      className={[
        "ds-card p-4 sm:p-6 cursor-default transition-all duration-300",
        onClick ? "hover:shadow-md cursor-pointer" : "",
        isLoading ? "opacity-75" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderColor: statusColor,
        borderLeftWidth: "4px",
      }}
      role="article"
      aria-label={`Metric: ${title}`}
    >
      {/* Header: Title + Icon */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className="text-2xl"
              style={{ opacity: isLoading ? 0.5 : 1 }}
            >
              {icon}
            </div>
          )}
          <h3 className="text-sm font-medium text-ds-text-secondary">{title}</h3>
        </div>
      </div>

      {/* Value: Animated Number */}
      <div
        className="mb-3 transition-transform duration-300"
        style={{
          transform: isFlipping ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {isLoading ? (
          <div className="h-8 bg-ds-bg-subtle rounded animate-pulse mb-2" />
        ) : (
          <div
            ref={valueRef}
            className="text-3xl font-bold"
            style={{ color: statusColor }}
            aria-live="polite"
            aria-atomic="true"
          >
            {format(value)}
          </div>
        )}
      </div>

      {/* Trend: Arrow + Percentage */}
      {trend && !isLoading && (
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`transition-transform duration-300 ${
              trend.direction === "up" ? "" : "rotate-180"
            }`}
            style={{
              color: trend.direction === "up" ? "#16a34a" : "#dc2626",
              opacity: trend.direction === "flat" ? 0.4 : 1,
            }}
            aria-label={`Trend: ${trend.direction} ${trend.value}%`}
          >
            {trend.direction === "flat" ? "→" : "↑"}
          </div>
          <span
            className="text-sm font-medium"
            style={{
              color:
                trend.direction === "up"
                  ? "#16a34a"
                  : trend.direction === "down"
                    ? "#dc2626"
                    : "#64748b",
            }}
          >
            {Math.abs(trend.value)}%{" "}
            {trend.direction === "up"
              ? "increase"
              : trend.direction === "down"
                ? "decrease"
                : "stable"}
          </span>
        </div>
      )}

      {/* Comparison / Description */}
      {(comparison || description) && !isLoading && (
        <p className="text-xs text-ds-text-tertiary">
          {comparison || description}
        </p>
      )}

      {/* Status Indicator Dot */}
      <div className="mt-4 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{
            backgroundColor: statusColor,
            animationDuration: status === "strong" ? "2s" : "1s",
          }}
        />
        <span className="text-xs text-ds-text-tertiary capitalize">
          {status}
        </span>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for metric card.
 */
export function AnimatedMetricCardSkeleton() {
  return (
    <div className="ds-card p-4 sm:p-6">
      <div className="h-5 bg-ds-bg-subtle rounded animate-pulse mb-4" />
      <div className="h-8 bg-ds-bg-subtle rounded animate-pulse mb-3" />
      <div className="h-4 bg-ds-bg-subtle rounded animate-pulse w-32" />
    </div>
  );
}
