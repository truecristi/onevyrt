/**
 * ChapterIcon — semantic visual representation of programme stages.
 *
 * Renders an icon for a given chapter/stage id (define, implement, control,
 * improve, finish). The icon's color is set automatically based on the chapter's
 * psychological state. Use alongside ChapterLabel for a full chapter identifier.
 *
 * Usage:
 *   <ChapterIcon chapter="define" size="md" />
 *   <ChapterIcon chapter="control" size="lg" withBackground />
 */
import {
  SparklesIcon,
  WrenchIcon,
  ChartBarIcon,
  LightBulbIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import { CHAPTER_ICONS, PSYCHOLOGICAL_STATE_COLORS } from "../../lib/icons/icon-registry";
import { IconSizer } from "./IconSizer";
import type { SVGProps } from "react";

type ChapterId = keyof typeof CHAPTER_ICONS;
type IconSize = "xs" | "sm" | "md" | "lg";

interface ChapterIconProps extends SVGProps<SVGSVGElement> {
  chapter: ChapterId;
  size?: IconSize;
  withBackground?: boolean;
  /** Optional CSS class for custom styling */
  className?: string;
}

const CHAPTER_ICON_MAP: Record<ChapterId, React.ComponentType<SVGProps<SVGSVGElement>>> = {
  define: SparklesIcon,
  implement: WrenchIcon,
  control: ChartBarIcon,
  improve: LightBulbIcon,
  finish: CheckCircleIcon,
};

const CHAPTER_STATE_MAP: Record<ChapterId, keyof typeof PSYCHOLOGICAL_STATE_COLORS> = {
  define: "clarity",
  implement: "confidence",
  control: "control",
  improve: "momentum",
  finish: "freedom",
};

export function ChapterIcon({
  chapter,
  size = "md",
  withBackground = false,
  className = "",
  ...rest
}: ChapterIconProps) {
  const IconComponent = CHAPTER_ICON_MAP[chapter];
  const state = CHAPTER_STATE_MAP[chapter];
  const stateColor = PSYCHOLOGICAL_STATE_COLORS[state];

  if (!IconComponent) {
    console.warn(`ChapterIcon: unknown chapter "${chapter}"`);
    return null;
  }

  return (
    <IconSizer
      size={size}
      color="inherit"
      className={[
        "chapter-icon",
        `chapter-icon--${chapter}`,
        withBackground ? `chapter-icon--bg` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        withBackground
          ? {
              backgroundColor: stateColor.bgColor,
              borderRadius: "8px",
              color: stateColor.color,
            }
          : { color: stateColor.color }
      }
      label={CHAPTER_ICONS[chapter].label}
    >
      <IconComponent width="1em" height="1em" {...rest} />
    </IconSizer>
  );
}

/**
 * ChapterLabel — text companion to ChapterIcon.
 * Displays the chapter name (e.g., "Define") with optional description.
 */
export function ChapterLabel({
  chapter,
  showDescription = false,
}: {
  chapter: ChapterId;
  showDescription?: boolean;
}) {
  const config = CHAPTER_ICONS[chapter];
  return (
    <div className="chapter-label">
      <div className="chapter-label__title">{config.label}</div>
      {showDescription && (
        <div className="chapter-label__description">{config.description}</div>
      )}
    </div>
  );
}

/**
 * ChapterBadge — icon + label combined badge for chapter identification.
 * Compact display of a chapter with semantic coloring.
 */
export function ChapterBadge({
  chapter,
  size = "sm",
}: {
  chapter: ChapterId;
  size?: IconSize;
}) {
  return (
    <span className="chapter-badge">
      <ChapterIcon chapter={chapter} size={size} />
      <ChapterLabel chapter={chapter} />
    </span>
  );
}
