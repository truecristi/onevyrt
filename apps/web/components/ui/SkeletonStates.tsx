/**
 * ONEVYRT Skeleton States — Loading placeholders with pulse animations.
 *
 * Features:
 * - Skeleton screen for major sections
 * - Pulse animation on loading state
 * - Smooth fade to content on load
 * - Accessible loading indicators
 * - Loading text animations
 * - Configurable skeleton shapes
 *
 * Usage:
 *   <SkeletonLoader isLoading={loading}>
 *     <YourContent />
 *   </SkeletonLoader>
 */

import { ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/animations/micro-interactions";

export interface SkeletonLoaderProps {
  /** Whether to show skeleton (true) or content (false) */
  isLoading: boolean;

  /** Content to show when not loading */
  children: ReactNode;

  /** Skeleton to show while loading */
  skeleton?: ReactNode;

  /** Animation duration (ms) */
  duration?: number;

  /** CSS className */
  className?: string;
}

/**
 * Skeleton Loader — Wrapper that shows skeleton while loading, then fades in content.
 */
export function SkeletonLoader({
  isLoading,
  children,
  skeleton,
  duration = 300,
  className = "",
}: SkeletonLoaderProps) {
  return (
    <div
      className={className}
      style={{
        opacity: isLoading ? 1 : 1,
        transition: prefersReducedMotion()
          ? "none"
          : `opacity ${duration}ms ease-in-out`,
      }}
    >
      {isLoading ? (
        skeleton || <CardSkeleton />
      ) : (
        <div
          style={{
            animation: prefersReducedMotion() ? "none" : `fadeIn ${duration}ms ease-in-out`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Card Skeleton — Loading placeholder for a card component.
 */
export function CardSkeleton() {
  return (
    <div className="ds-card p-4 sm:p-6 space-y-4">
      <div className="h-6 bg-ds-bg-subtle rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 bg-ds-bg-subtle rounded animate-pulse w-3/4" />
        <div className="h-4 bg-ds-bg-subtle rounded animate-pulse w-1/2" />
      </div>
      <div className="h-32 bg-ds-bg-subtle rounded animate-pulse" />
    </div>
  );
}

/**
 * List Skeleton — Loading placeholder for a list of items.
 */
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 bg-ds-bg-subtle rounded animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Text Skeleton — Loading placeholder for text content.
 */
export function TextSkeleton({ lines = 3, maxWidth = "100%" }: { lines?: number; maxWidth?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-ds-bg-subtle rounded animate-pulse"
          style={{
            width: i === lines - 1 ? "60%" : maxWidth,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Image Skeleton — Loading placeholder for images.
 */
export function ImageSkeleton({ width = "100%", height = "300px" }: { width?: string; height?: string }) {
  return (
    <div
      className="bg-ds-bg-subtle rounded animate-pulse"
      style={{
        width,
        height,
      }}
    />
  );
}

/**
 * Table Skeleton — Loading placeholder for data tables.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-ds-border-subtle">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 bg-ds-bg-subtle rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-ds-border-subtle">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <div className="h-4 bg-ds-bg-subtle rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Dashboard Skeleton — Loading placeholder for dashboard-like layouts.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="h-8 bg-ds-bg-subtle rounded animate-pulse w-1/3" />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ds-card p-6 space-y-3">
            <div className="h-4 bg-ds-bg-subtle rounded animate-pulse w-20" />
            <div className="h-8 bg-ds-bg-subtle rounded animate-pulse w-1/2" />
            <div className="h-3 bg-ds-bg-subtle rounded animate-pulse w-2/3" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="ds-card p-6">
        <div className="h-5 bg-ds-bg-subtle rounded animate-pulse mb-4 w-1/4" />
        <div className="h-64 bg-ds-bg-subtle rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Form Skeleton — Loading placeholder for form layouts.
 */
export function FormSkeleton({ fieldCount = 4 }: { fieldCount?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-ds-bg-subtle rounded animate-pulse w-20" />
          <div className="h-10 bg-ds-bg-subtle rounded animate-pulse w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Circular Avatar Skeleton — Loading placeholder for avatars.
 */
export function AvatarSkeleton({ size = 40 }: { size?: number }) {
  return (
    <div
      className="bg-ds-bg-subtle rounded-full animate-pulse"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

/**
 * Badge Skeleton — Loading placeholder for badge/tag elements.
 */
export function BadgeSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-6 bg-ds-bg-subtle rounded-full animate-pulse w-24"
        />
      ))}
    </div>
  );
}

/**
 * Loading Dots — Animated loading indicator (3 dots animation).
 */
export function LoadingDots({
  text = "Loading",
  size = "md",
}: {
  text?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3",
  };

  return (
    <div className={`flex items-center gap-1 ${sizeClasses[size]}`}>
      <span className="text-ds-text-secondary">{text}</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`${dotSizes[size]} rounded-full bg-ds-text-secondary animate-pulse`}
          style={{
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Spinner — Rotating loading spinner.
 */
export function Spinner({
  size = "md",
  color = "#088057",
}: {
  size?: "sm" | "md" | "lg";
  color?: string;
}) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full animate-spin`}
      style={{
        borderColor: `${color}40`,
        borderTopColor: color,
      }}
    />
  );
}

/**
 * Progress Skeleton — Loading placeholder for progress bars.
 */
export function ProgressSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 bg-ds-bg-subtle rounded-full animate-pulse" />
      <div className="h-4 bg-ds-bg-subtle rounded animate-pulse w-12" />
    </div>
  );
}

/**
 * Skeleton - Generic configurable skeleton builder.
 */
export interface SkeletonProps {
  /** Width (CSS value) */
  width?: string;

  /** Height (CSS value) */
  height?: string;

  /** Border radius */
  rounded?: "none" | "sm" | "md" | "lg" | "full";

  /** Pulse animation */
  pulse?: boolean;

  /** CSS className */
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "20px",
  rounded = "md",
  pulse = true,
  className = "",
}: SkeletonProps) {
  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };

  return (
    <div
      className={[
        "bg-ds-bg-subtle",
        roundedClasses[rounded],
        pulse ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width,
        height,
      }}
    />
  );
}
