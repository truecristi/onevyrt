/**
 * ONEVYRT Animated Progress Bar — Smooth progress visualization with animations.
 *
 * Features:
 * - Smooth width animation as percentage changes
 * - Gradient colors matching ONEVYRT palette
 * - Segment breakdown (multi-stage progress)
 * - Label display (current/target)
 * - Milestone markers at key percentages
 * - Celebration animation at 100%
 * - RTL support
 *
 * Usage:
 *   <AnimatedProgressBar
 *     value={65}
 *     max={100}
 *     chapter="implement"
 *     showLabel
 *     showMilestones
 *   />
 */

import { useEffect, useState, useRef } from "react";
import { getChapterColor, CHAPTER_COLORS_DARK } from "@/lib/colors/chapter-tokens";
import { triggerCelebration } from "@/lib/animations/celebrations";
import { prefersReducedMotion } from "@/lib/animations/micro-interactions";

export type ChapterKey = "define" | "implement" | "control" | "improve" | "finish" | "start";

export interface AnimatedProgressBarProps {
  /** Current progress value */
  value: number;

  /** Maximum value (default: 100) */
  max?: number;

  /** Chapter color scheme (default: implement) */
  chapter?: ChapterKey;

  /** Custom color (overrides chapter) */
  color?: string;

  /** Show percentage label */
  showLabel?: boolean;

  /** Show milestone markers (25%, 50%, 75%, 100%) */
  showMilestones?: boolean;

  /** Show segment breakdown */
  segments?: Array<{
    name: string;
    value: number;
    color?: string;
  }>;

  /** Animation duration in ms */
  duration?: number;

  /** Trigger celebration at 100% */
  celebrate?: boolean;

  /** Height variant */
  height?: "xs" | "sm" | "md" | "lg";

  /** Border radius */
  rounded?: "none" | "sm" | "md" | "lg" | "full";

  /** Show indeterminate animation */
  indeterminate?: boolean;

  /** Custom label text */
  label?: string;

  /** CSS className */
  className?: string;

  /** RTL support */
  rtl?: boolean;
}

export function AnimatedProgressBar({
  value,
  max = 100,
  chapter = "implement",
  color,
  showLabel = false,
  showMilestones = false,
  segments,
  duration = 600,
  celebrate = false,
  height = "md",
  rounded = "full",
  indeterminate = false,
  label,
  className = "",
}: AnimatedProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const percentage = Math.min((value / max) * 100, 100);
  const chapterColor = color || getChapterColor(chapter);

  // Animate progress bar
  useEffect(() => {
    if (indeterminate) {
      setDisplayValue(100);
      return;
    }

    const startTime = Date.now();
    const startValue = displayValue;
    const diff = percentage - startValue;

    const animate = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: ease-out-cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(percentage);

        // Trigger celebration at 100%
        if (percentage >= 100 && celebrate && !hasCompleted && !prefersReducedMotion()) {
          setHasCompleted(true);
          triggerCelebration({
            title: "Milestone Reached!",
            subtitle: label || "Progress Complete",
            showConfetti: true,
            showBadge: true,
          });
        }
      }
    };

    animate();
  }, [percentage, duration, celebrate, hasCompleted, displayValue, label]);

  const heightClasses = {
    xs: "h-1",
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };

  const barWidth = indeterminate ? 40 : displayValue;

  return (
    <div className={className}>
      {/* Label */}
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ds-text-secondary">
            {label || `Progress`}
          </span>
          {showLabel && (
            <span
              className="text-sm font-semibold"
              style={{ color: chapterColor }}
              aria-live="polite"
              aria-atomic="true"
            >
              {Math.round(displayValue)}%
            </span>
          )}
        </div>
      )}

      {/* Container */}
      <div
        ref={containerRef}
        className={`${heightClasses[height]} bg-ds-bg-subtle overflow-hidden ${roundedClasses[rounded]} relative`}
        role="progressbar"
        aria-valuenow={Math.round(displayValue)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || "Progress"}
      >
        {/* Segments (if provided) */}
        {segments && segments.length > 0 ? (
          <div className="flex h-full">
            {segments.map((segment, idx) => {
              const segmentPercentage = (segment.value / max) * 100;
              const segmentProgress = Math.min(
                (displayValue / 100) * segmentPercentage,
                segmentPercentage
              );

              return (
                <div
                  key={segment.name || idx}
                  className={`transition-all ${roundedClasses[rounded]}`}
                  style={{
                    width: `${segmentPercentage}%`,
                    backgroundColor: segment.color || chapterColor,
                    opacity: segmentProgress > 0 ? 1 : 0.2,
                    transition: prefersReducedMotion()
                      ? "none"
                      : `opacity ${duration}ms ease-out, background-color 200ms ease-in-out`,
                  }}
                  title={segment.name}
                />
              );
            })}
          </div>
        ) : (
          <>
            {/* Main progress bar */}
            <div
              ref={barRef}
              className={`h-full transition-all ${roundedClasses[rounded]}`}
              style={{
                width: `${barWidth}%`,
                backgroundColor: chapterColor,
                backgroundImage: `linear-gradient(90deg, ${chapterColor}, ${CHAPTER_COLORS_DARK[chapter]})`,
                transition: prefersReducedMotion()
                  ? "none"
                  : `width ${indeterminate ? "1.5s" : `${duration}ms`} ease-out`,
                animation: indeterminate
                  ? `shimmer 2s infinite`
                  : `none`,
              }}
            />

            {/* Shimmer effect for indeterminate state */}
            {indeterminate && (
              <div
                className="absolute inset-0 shimmer-gradient"
                style={{
                  animation: "shimmer 2s infinite",
                }}
              />
            )}
          </>
        )}

        {/* Milestone markers */}
        {showMilestones && !segments && (
          <>
            {[25, 50, 75, 100].map((milestone) => (
              <div
                key={milestone}
                className="absolute top-0 bottom-0 w-px bg-white opacity-20"
                style={{
                  left: `${milestone}%`,
                  transform: "translateX(-50%)",
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Milestone labels */}
      {showMilestones && (
        <div className="flex justify-between text-xs text-ds-text-tertiary mt-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      )}

      {/* Inline styles for animations */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .shimmer-gradient {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Stacked Progress Bar — Multiple progress bars stacked vertically.
 */
export interface StackedProgressBarProps {
  items: Array<{
    id: string;
    label: string;
    value: number;
    max?: number;
    color?: string;
    chapter?: ChapterKey;
  }>;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function StackedProgressBar({
  items,
  gap = "md",
  className = "",
}: StackedProgressBarProps) {
  const gapClasses = {
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  };

  return (
    <div className={`flex flex-col ${gapClasses[gap]} ${className}`}>
      {items.map((item) => (
        <div key={item.id}>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-ds-text-secondary">
              {item.label}
            </span>
            <span className="text-sm font-semibold text-ds-text-secondary">
              {Math.round((item.value / (item.max || 100)) * 100)}%
            </span>
          </div>
          <AnimatedProgressBar
            value={item.value}
            max={item.max}
            chapter={item.chapter}
            color={item.color}
            height="sm"
            duration={600}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Multi-stage Progress Indicator — Shows progress through multiple stages.
 */
export interface MultiStageProgressProps {
  stages: Array<{
    id: string;
    name: string;
    status: "completed" | "current" | "upcoming";
    color?: string;
  }>;
  className?: string;
}

export function MultiStageProgress({
  stages,
  className = "",
}: MultiStageProgressProps) {
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progressPercentage = (completedCount / stages.length) * 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-ds-text-secondary">
          Progress
        </span>
        <span className="text-sm font-semibold text-ds-text-secondary">
          {completedCount} of {stages.length}
        </span>
      </div>

      <div className="space-y-4">
        {/* Stage progress line */}
        <AnimatedProgressBar
          value={progressPercentage}
          max={100}
          height="sm"
          showMilestones={false}
          chapter="implement"
        />

        {/* Stage indicators */}
        <div className="flex justify-between">
          {stages.map((stage, idx) => {
            const isCompleted = stage.status === "completed";
            const isCurrent = stage.status === "current";

            return (
              <div
                key={stage.id}
                className="flex flex-col items-center"
                role="listitem"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-100 text-green-700"
                      : isCurrent
                        ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <span className="text-xs text-ds-text-secondary mt-2 text-center max-w-20">
                  {stage.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
