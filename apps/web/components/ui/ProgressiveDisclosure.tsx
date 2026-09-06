/**
 * ONEVYRT Progressive Disclosure — Expandable sections with smooth animations.
 *
 * Features:
 * - Expandable sections with smooth height animations
 * - Chevron indicators rotating on expand/collapse
 * - Optional icon badges indicating filled vs empty state
 * - Section completeness percentage display
 * - Keyboard navigation (arrow keys to expand/collapse)
 * - Accessibility: proper ARIA roles and labels
 * - Smooth transitions using height animations
 *
 * Usage:
 *   <ProgressiveDisclosure
 *     sections={[
 *       { id: "1", title: "Section 1", children: <div>Content</div> },
 *     ]}
 *     allowMultiple
 *   />
 */

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { prefersReducedMotion } from "@/lib/animations/micro-interactions";
import { getChapterColor } from "@/lib/colors/chapter-tokens";

// CSSProperties has no index signature for custom properties — extend it
// locally so the dynamic per-section Tailwind ring color below is still fully
// typed rather than escaping to `any` (same pattern as InteractiveStatusBadge.tsx).
interface RingStyle extends CSSProperties {
  "--tw-ring-color"?: string;
}

export interface DisclosureSection {
  id: string;
  title: string;
  children: React.ReactNode;
  icon?: string;
  chapter?: string;
  badge?: string | number;
  disabled?: boolean;
  defaultOpen?: boolean;
  completeness?: number; // 0-100
  description?: string;
}

export interface ProgressiveDisclosureProps {
  /** Array of disclosure sections */
  sections: DisclosureSection[];

  /** Allow multiple sections open simultaneously */
  allowMultiple?: boolean;

  /** IDs of open sections (controlled) */
  openSections?: string[];

  /** Section open/close handler */
  onToggle?: (id: string, isOpen: boolean) => void;

  /** Show completeness indicators */
  showCompleteness?: boolean;

  /** CSS className */
  className?: string;

  /** Accordion mode (only one open at a time) */
  accordion?: boolean;
}

export function ProgressiveDisclosure({
  sections,
  allowMultiple = true,
  openSections: controlledOpenSections,
  onToggle,
  showCompleteness = true,
  className = "",
  accordion = !allowMultiple,
}: ProgressiveDisclosureProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<Set<string>>(
    new Set(sections.filter((s) => s.defaultOpen).map((s) => s.id))
  );

  const isControlled = controlledOpenSections !== undefined;
  const openSections = isControlled
    ? new Set(controlledOpenSections)
    : uncontrolledOpen;

  const handleToggle = (id: string) => {
    const isOpen = openSections.has(id);
    const newOpen = new Set(openSections);

    if (accordion && !isOpen) {
      // Close all others
      newOpen.clear();
    }

    if (isOpen) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }

    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }

    onToggle?.(id, newOpen.has(id));
  };

  return (
    <div
      className={["space-y-2", className].filter(Boolean).join(" ")}
      role="region"
      aria-label="Progressive disclosure sections"
    >
      {sections.map((section) => (
        <DisclosureItem
          key={section.id}
          section={section}
          isOpen={openSections.has(section.id)}
          onToggle={() => handleToggle(section.id)}
          showCompleteness={showCompleteness}
        />
      ))}
    </div>
  );
}

/**
 * Individual Disclosure Item
 */
function DisclosureItem({
  section,
  isOpen,
  onToggle,
  showCompleteness,
}: {
  section: DisclosureSection;
  isOpen: boolean;
  onToggle: () => void;
  showCompleteness: boolean;
}) {
  const [height, setHeight] = useState("0px");
  const contentRef = useRef<HTMLDivElement>(null);
  const chapterColor = section.chapter
    ? getChapterColor(section.chapter)
    : "#2563eb";

  // Measure content height for smooth animation
  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      setHeight(`${contentRef.current.scrollHeight}px`);
    } else {
      setHeight("0px");
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    } else if (e.key === "ArrowDown" && isOpen) {
      // Focus next section
      e.preventDefault();
      (e.currentTarget.parentElement?.nextElementSibling?.querySelector(
        "button"
      ) as HTMLButtonElement)?.focus();
    } else if (e.key === "ArrowUp" && isOpen) {
      // Focus previous section
      e.preventDefault();
      (e.currentTarget.parentElement?.previousElementSibling?.querySelector(
        "button"
      ) as HTMLButtonElement)?.focus();
    }
  };

  const completenessColor =
    !section.completeness || section.completeness < 33
      ? "#dc2626"
      : section.completeness < 66
        ? "#d97706"
        : "#16a34a";

  return (
    <div
      className="ds-card overflow-hidden transition-all duration-200"
      role="region"
      aria-expanded={isOpen}
    >
      {/* Header / Trigger */}
      <button
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        disabled={section.disabled}
        className={[
          "w-full px-4 py-3 sm:px-6 sm:py-4 text-left",
          "focus:outline-none focus:ring-2 focus:ring-inset",
          "hover:bg-ds-bg-subtle transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-between gap-3",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          "--tw-ring-color": chapterColor,
        } as RingStyle}
        aria-controls={`content-${section.id}`}
      >
        {/* Left: Icon + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {section.icon && (
            <span
              className="text-xl flex-shrink-0"
              style={{ color: chapterColor, opacity: isOpen ? 1 : 0.6 }}
            >
              {section.icon}
            </span>
          )}

          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-ds-text-primary transition-colors duration-200"
              style={{ color: isOpen ? chapterColor : "inherit" }}
            >
              {section.title}
            </h3>

            {section.description && (
              <p className="text-sm text-ds-text-tertiary mt-0.5">
                {section.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Badge + Chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {section.badge !== undefined && (
            <div
              className="px-2 py-1 rounded text-xs font-semibold"
              style={{
                backgroundColor: `${chapterColor}20`,
                color: chapterColor,
              }}
            >
              {section.badge}
            </div>
          )}

          {showCompleteness && section.completeness !== undefined && (
            <div
              className="text-xs font-medium transition-colors"
              style={{ color: completenessColor }}
            >
              {section.completeness}%
            </div>
          )}

          <div
            className="transition-transform duration-300 flex-shrink-0"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: chapterColor,
            }}
          >
            ▼
          </div>
        </div>
      </button>

      {/* Content */}
      <div
        id={`content-${section.id}`}
        ref={contentRef}
        className="overflow-hidden"
        style={{
          height,
          transition: prefersReducedMotion()
            ? "none"
            : "height 300ms cubic-bezier(0.2, 0.7, 0.3, 1)",
        }}
        role="region"
        aria-labelledby={`trigger-${section.id}`}
      >
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-ds-border-subtle">
          {section.children}
        </div>
      </div>

      {/* Progress bar indicator */}
      {showCompleteness && section.completeness !== undefined && isOpen && (
        <div
          className="h-1"
          style={{
            backgroundColor: completenessColor,
            width: `${section.completeness}%`,
            transition: "width 300ms ease-out",
          }}
        />
      )}
    </div>
  );
}

/**
 * Accordion — Convenience wrapper for single-open disclosure.
 */
export function Accordion({
  items,
  onChange,
  className = "",
}: {
  items: Omit<DisclosureSection, "defaultOpen">[];
  onChange?: (id: string) => void;
  className?: string;
}) {
  return (
    <ProgressiveDisclosure
      sections={items}
      accordion
      onToggle={(id, isOpen) => isOpen && onChange?.(id)}
      className={className}
    />
  );
}

/**
 * Details Card — Styled disclosure for details/more info.
 */
export function DetailsCard({
  title,
  summary,
  children,
  icon,
  chapter = "define",
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  icon?: string;
  chapter?: string;
}) {
  return (
    <ProgressiveDisclosure
      sections={[
        {
          id: "details",
          title,
          description: summary,
          icon,
          children,
          chapter,
        },
      ]}
      allowMultiple={false}
    />
  );
}
