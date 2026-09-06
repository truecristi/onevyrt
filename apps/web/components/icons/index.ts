/**
 * ONEVYRT Icon System — main export point for all icon components.
 *
 * Components:
 * - ChapterIcon: Programme stage icons (DEFINE, IMPLEMENT, etc.)
 * - StatusIcon: Progress and state indicators
 * - ActionIcon: UI control icons (add, edit, delete, etc.)
 * - IconButton: Reusable icon-only button wrapper
 * - ActionButton: Pre-styled action icon button
 * - IconSizer: Utility for consistent icon sizing
 *
 * Registry:
 * - icon-registry.ts: Complete icon catalog and color system
 *
 * Usage:
 *   import { ChapterIcon, StatusIcon, ActionButton } from '@/components/icons';
 *   import { CHAPTER_ICONS, STATUS_ICONS } from '@/lib/icons/icon-registry';
 */

export { ChapterIcon, ChapterLabel, ChapterBadge } from "./ChapterIcon";
export { StatusIcon, StatusBadge } from "./StatusIcon";
export { ActionIcon, ActionButton } from "./ActionIcon";
export { IconButton, ContextIconButton } from "./IconButton";
export { IconSizer } from "./IconSizer";

// Re-export registry for consumers that need direct access to icon data
export {
  CHAPTER_ICONS,
  STATUS_ICONS,
  ACTION_ICONS,
  NAVIGATION_ICONS,
  PSYCHOLOGICAL_STATE_COLORS,
  COACHING_STATUS_COLORS,
  getPsychologicalStateColor,
  getCoachingStatusColor,
} from "@/lib/icons/icon-registry";

export type { IconProps } from "@/lib/icons/icon-registry";
