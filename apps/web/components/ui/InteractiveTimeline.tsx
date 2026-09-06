/**
 * ONEVYRT Interactive Timeline — Vertical/horizontal timeline with animated interactions.
 *
 * Features:
 * - Vertical or horizontal layout
 * - Clickable timeline nodes/events
 * - Smooth scroll to selected event
 * - Animated connection lines
 * - Event detail cards on hover/click
 * - Current position indicator
 * - Responsive: adapts to mobile vertical view
 * - Accessibility: keyboard navigation, ARIA labels
 *
 * Usage:
 *   <InteractiveTimeline
 *     events={events}
 *     currentIndex={2}
 *     orientation="vertical"
 *   />
 */

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { getChapterColor } from "@/lib/colors/chapter-tokens";

// CSSProperties has no index signature for custom properties — extend it
// locally so the dynamic per-event Tailwind ring color below is still fully
// typed rather than escaping to `any` (same pattern as InteractiveStatusBadge.tsx).
interface RingStyle extends CSSProperties {
  "--tw-ring-color"?: string;
}

export type TimelineOrientation = "vertical" | "horizontal";

export interface TimelineEvent {
  id: string;
  name: string;
  description?: string;
  timestamp?: string;
  color?: string;
  icon?: string;
  details?: string;
  status?: "completed" | "current" | "upcoming";
}

export interface InteractiveTimelineProps {
  /** Array of timeline events */
  events: TimelineEvent[];

  /** Current event index (0-based) */
  currentIndex?: number;

  /** Timeline orientation */
  orientation?: TimelineOrientation;

  /** Show event details on interaction */
  showDetails?: boolean;

  /** Custom color for timeline */
  color?: string;

  /** Chapter-based color (overrides color prop) */
  chapter?: string;

  /** Click handler for events */
  onEventClick?: (event: TimelineEvent, index: number) => void;

  /** CSS className */
  className?: string;
}

export function InteractiveTimeline({
  events,
  currentIndex = 0,
  orientation = "vertical",
  showDetails = true,
  color,
  chapter = "implement",
  onEventClick,
  className = "",
}: InteractiveTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [showDetail, setShowDetail] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const timelineColor = color || getChapterColor(chapter);

  // Scroll to selected event
  useEffect(() => {
    if (orientation === "horizontal" && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedIndex, orientation]);

  const handleEventClick = (event: TimelineEvent, index: number) => {
    setSelectedIndex(index);
    setShowDetail(true);
    onEventClick?.(event, index);
  };

  const isVertical = orientation === "vertical";

  return (
    <div
      ref={containerRef}
      className={[
        isVertical ? "" : "overflow-x-auto",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={isVertical ? "space-y-6" : "flex gap-8 pb-4 px-4"}
        role="list"
        aria-label="Timeline"
      >
        {events.map((event, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = event.status === "current" || index === currentIndex;
          const isCompleted = event.status === "completed" || index < currentIndex;
          const eventColor = event.color || timelineColor;

          return (
            <div
              key={event.id}
              ref={isSelected ? selectedRef : null}
              className={isVertical ? "" : "flex-shrink-0 w-64"}
              role="listitem"
            >
              <div
                className={`relative ${isVertical ? "flex gap-4" : "flex flex-col items-center"}`}
              >
                {/* Timeline node */}
                <button
                  onClick={() => handleEventClick(event, index)}
                  onMouseEnter={() => showDetails && setShowDetail(true)}
                  onMouseLeave={() => showDetails && setShowDetail(false)}
                  className="relative z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full transition-all duration-300"
                  style={{
                    "--tw-ring-color": eventColor,
                  } as RingStyle}
                  aria-label={`${event.name}${isCurrent ? " (current)" : ""}`}
                  aria-pressed={isSelected}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                      isSelected ? "ring-4 ring-offset-2" : ""
                    } ${isCompleted ? "shadow-lg" : ""}`}
                    style={{
                      backgroundColor: eventColor,
                      color: "white",
                      borderColor: eventColor,
                      "--tw-ring-color": `${eventColor}40`,
                      transform: isSelected ? "scale(1.2)" : "scale(1)",
                    } as RingStyle}
                  >
                    {event.icon || "●"}
                  </div>
                </button>

                {/* Connection line */}
                {index < events.length - 1 && (
                  <div
                    className={`absolute ${isVertical ? "left-6 top-12 bottom-0 w-0.5" : "top-12 left-12 right-0 h-0.5"}`}
                    style={{
                      backgroundColor: `${eventColor}40`,
                    }}
                  />
                )}

                {/* Event content */}
                <div className={isVertical ? "flex-1 pt-1" : "mt-4"}>
                  <button
                    onClick={() => handleEventClick(event, index)}
                    className="text-left focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-2 py-1 transition-all duration-200 hover:bg-ds-bg-subtle"
                    style={{
                      "--tw-ring-color": eventColor,
                    } as RingStyle}
                  >
                    <h3
                      className="font-semibold text-ds-text-primary"
                      style={{
                        color: isSelected ? eventColor : "inherit",
                      }}
                    >
                      {event.name}
                    </h3>
                  </button>

                  {event.timestamp && (
                    <p className="text-xs text-ds-text-tertiary mt-1">
                      {event.timestamp}
                    </p>
                  )}

                  {event.description && (
                    <p className="text-sm text-ds-text-secondary mt-1">
                      {event.description}
                    </p>
                  )}

                  {/* Status indicator */}
                  <div className="flex items-center gap-1 mt-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: isCompleted ? "#16a34a" : eventColor,
                      }}
                    />
                    <span className="text-xs text-ds-text-tertiary">
                      {event.status === "completed" || index < currentIndex
                        ? "Completed"
                        : event.status === "current" || index === currentIndex
                          ? "Current"
                          : "Upcoming"}
                    </span>
                  </div>

                  {/* Detail card */}
                  {(showDetail || isSelected) && showDetails && event.details && (
                    <div
                      className="mt-3 p-3 rounded-lg bg-ds-surface border border-ds-border-subtle animate-slideUp"
                      style={{
                        borderLeftWidth: "3px",
                        borderLeftColor: eventColor,
                      }}
                    >
                      <p className="text-sm text-ds-text-secondary m-0">
                        {event.details}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Horizontal Timeline — Optimized for horizontal layout.
 */
export function HorizontalTimeline({
  events,
  currentIndex = 0,
  onEventClick,
  className = "",
}: {
  events: TimelineEvent[];
  currentIndex?: number;
  onEventClick?: (event: TimelineEvent, index: number) => void;
  className?: string;
}) {
  return (
    <InteractiveTimeline
      events={events}
      currentIndex={currentIndex}
      orientation="horizontal"
      onEventClick={onEventClick}
      className={className}
    />
  );
}

/**
 * Vertical Timeline — Optimized for vertical layout.
 */
export function VerticalTimeline({
  events,
  currentIndex = 0,
  onEventClick,
  className = "",
}: {
  events: TimelineEvent[];
  currentIndex?: number;
  onEventClick?: (event: TimelineEvent, index: number) => void;
  className?: string;
}) {
  return (
    <InteractiveTimeline
      events={events}
      currentIndex={currentIndex}
      orientation="vertical"
      onEventClick={onEventClick}
      className={className}
    />
  );
}

/**
 * Milestone Timeline — Show progress through milestones.
 */
export function MilestoneTimeline({
  milestones,
  currentIndex = 0,
  onMilestoneClick,
  className = "",
}: {
  milestones: Array<{
    id: string;
    title: string;
    description?: string;
    date?: string;
  }>;
  currentIndex?: number;
  onMilestoneClick?: (id: string, index: number) => void;
  className?: string;
}) {
  return (
    <InteractiveTimeline
      events={milestones.map((m) => ({
        ...m,
        name: m.title,
        timestamp: m.date,
      }))}
      currentIndex={currentIndex}
      orientation="vertical"
      onEventClick={(event, index) => onMilestoneClick?.(event.id, index)}
      className={className}
    />
  );
}
