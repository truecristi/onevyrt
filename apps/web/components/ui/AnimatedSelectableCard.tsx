/**
 * ONEVYRT Animated Selectable Card — Interactive card selection with smooth animations.
 *
 * Features:
 * - Card selection with smooth animations
 * - Background color transition on select
 * - Checkmark animation on selection
 * - Multi-select support with visual feedback
 * - Keyboard navigation (Tab to move, Space/Enter to select)
 * - Smooth deselection animation
 * - Focus state styling for accessibility
 *
 * Usage:
 *   <AnimatedSelectableCard
 *     selected={isSelected}
 *     onSelect={() => setSelected(!isSelected)}
 *     title="Option 1"
 *     description="Description text"
 *   />
 */

import { useState } from "react";
import { getChapterColor } from "@/lib/colors/chapter-tokens";

export interface AnimatedSelectableCardProps {
  /** Whether card is selected */
  selected?: boolean;

  /** Selection change handler */
  onSelect?: (selected: boolean) => void;

  /** Card title */
  title: string;

  /** Card description/content */
  description?: React.ReactNode;

  /** Icon or image */
  icon?: React.ReactNode;

  /** Chapter color scheme */
  chapter?: string;

  /** Custom color */
  color?: string;

  /** Additional badge/tag */
  badge?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Size variant */
  size?: "sm" | "md" | "lg";

  /** CSS className */
  className?: string;
}

export function AnimatedSelectableCard({
  selected = false,
  onSelect,
  title,
  description,
  icon,
  chapter = "implement",
  color,
  badge,
  disabled = false,
  size = "md",
  className = "",
}: AnimatedSelectableCardProps) {
  const [isFocused, setIsFocused] = useState(false);

  const cardColor = color || getChapterColor(chapter);
  const sizeClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onSelect?.(!selected);
    }
  };

  return (
    <div
      onClick={() => !disabled && onSelect?.(!selected)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      className={[
        "ds-card relative cursor-pointer transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        selected ? "ring-2" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: selected ? `${cardColor}10` : "var(--ds-surface)",
        borderColor: selected ? cardColor : "var(--ds-border-subtle)",
        borderWidth: "2px",
        boxShadow:
          isFocused && !disabled
            ? `0 0 0 3px ${cardColor}20`
            : selected
              ? `0 0 0 2px ${cardColor}40`
              : "var(--ds-shadow-sm)",
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Checkmark indicator */}
      <div
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center font-bold text-white transition-all duration-200 animate-scaleIn"
        style={{
          backgroundColor: cardColor,
          opacity: selected ? 1 : 0,
          transform: selected ? "scale(1)" : "scale(0.5)",
          pointerEvents: "none",
        }}
      >
        ✓
      </div>

      {/* Content */}
      <div className={`${sizeClasses[size]} pr-10`}>
        <div className="flex items-start gap-3">
          {icon && (
            <div className="text-2xl flex-shrink-0" style={{ opacity: selected ? 1 : 0.7 }}>
              {icon}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-ds-text-primary transition-colors duration-200"
              style={{
                color: selected ? cardColor : "var(--ds-text-primary)",
              }}
            >
              {title}
            </h3>

            {description && (
              <p className="text-sm text-ds-text-secondary mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Badge */}
        {badge && (
          <div className="mt-3 inline-block px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${cardColor}20`, color: cardColor }}>
            {badge}
          </div>
        )}
      </div>

      {/* Border accent on selection */}
      <div
        className="absolute inset-0 rounded-lg transition-opacity duration-200 pointer-events-none"
        style={{
          borderWidth: "2px",
          borderColor: cardColor,
          opacity: selected ? 0.2 : 0,
        }}
      />
    </div>
  );
}

/**
 * Selectable Card Group — Multiple selectable cards with group behavior.
 */
export interface SelectableCardGroupProps {
  /** Array of card options */
  options: Array<{
    id: string;
    title: string;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    badge?: string;
  }>;

  /** Selected option ID(s) */
  selected?: string | string[];

  /** Selection change handler */
  onSelect?: (id: string | string[]) => void;

  /** Multi-select mode */
  multiple?: boolean;

  /** Chapter color scheme */
  chapter?: string;

  /** Columns (responsive) */
  columns?: number;

  /** Gap between cards */
  gap?: "sm" | "md" | "lg";

  /** CSS className */
  className?: string;
}

export function SelectableCardGroup({
  options,
  multiple = false,
  selected = multiple ? [] : "",
  onSelect,
  chapter = "implement",
  columns = 2,
  gap = "md",
  className = "",
}: SelectableCardGroupProps) {
  const selectedSet = new Set(Array.isArray(selected) ? selected : [selected].filter(Boolean));

  const handleSelect = (id: string) => {
    if (multiple) {
      const newSelected = Array.isArray(selected) ? [...selected] : [];
      if (selectedSet.has(id)) {
        onSelect?.(newSelected.filter((s) => s !== id));
      } else {
        onSelect?.([...newSelected, id]);
      }
    } else {
      onSelect?.(selectedSet.has(id) ? "" : id);
    }
  };

  const gapClasses = {
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  };

  return (
    <div
      className={[
        "grid",
        `grid-cols-${columns}`,
        gapClasses[gap],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      role="radiogroup"
      aria-label="Select an option"
    >
      {options.map((option) => (
        <div key={option.id} className="min-w-0">
          <AnimatedSelectableCard
            selected={selectedSet.has(option.id)}
            onSelect={() => handleSelect(option.id)}
            title={option.title}
            description={option.description}
            icon={option.icon}
            badge={option.badge}
            chapter={chapter}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Toggle Card — Binary (on/off) selectable card.
 */
export interface ToggleCardProps {
  /** Whether enabled/selected */
  enabled?: boolean;

  /** Change handler */
  onChange?: (enabled: boolean) => void;

  /** Card title */
  title: string;

  /** Card description */
  description?: React.ReactNode;

  /** Icon */
  icon?: React.ReactNode;

  /** Chapter color */
  chapter?: string;

  /** CSS className */
  className?: string;
}

export function ToggleCard({
  enabled = false,
  onChange,
  title,
  description,
  icon,
  chapter = "implement",
  className = "",
}: ToggleCardProps) {
  return (
    <AnimatedSelectableCard
      selected={enabled}
      onSelect={(val) => onChange?.(val)}
      title={title}
      description={description}
      icon={icon}
      chapter={chapter}
      className={className}
    />
  );
}

/**
 * Option Picker — Compact option selector with animations.
 */
export function OptionPicker({
  options,
  selected,
  onSelect,
  className = "",
}: {
  options: Array<{ value: string; label: string; icon?: string }>;
  selected?: string;
  onSelect?: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex gap-2 flex-wrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect?.(option.value)}
          className={[
            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            selected === option.value
              ? "bg-blue-600 text-white shadow-md"
              : "bg-ds-surface border border-ds-border-default text-ds-text-primary hover:bg-ds-bg-subtle",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={selected === option.value}
        >
          {option.icon && <span className="mr-1">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}
