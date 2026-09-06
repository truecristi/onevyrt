/**
 * Color system & design token exports — re-exported for convenient importing.
 *
 * Use the new `DesignTokens` export for comprehensive token access:
 *   import { DesignTokens } from '@/lib/colors';
 *
 * Or import specific tokens:
 *   import { CHAPTER_COLORS, SPACING, TYPOGRAPHY } from '@/lib/colors';
 */

// Legacy exports (kept for backward compatibility)
export {
  CHAPTER_COLORS,
  CHAPTER_COLORS_SOFT,
  CHAPTER_COLORS_DARK,
  STATUS_COLORS,
  NAV_COLORS,
  getChapterColor,
  getChapterColorSoft,
  getChapterColorDark,
  generateCSSVariables,
  type ChapterKey,
} from "./chapter-tokens";

// New comprehensive design tokens
export {
  // All color systems
  CHAPTER_COLORS as CHAPTER_COLORS_NEW,
  CHAPTER_COLORS_SOFT as CHAPTER_COLORS_SOFT_NEW,
  CHAPTER_COLORS_DARK as CHAPTER_COLORS_DARK_NEW,
  CHAPTER_COLORS_MID,
  STATUS_COLORS as STATUS_COLORS_NEW,
  NAV_COLORS as NAV_COLORS_NEW,
  BRAND_COLORS,
  SEMANTIC_COLORS,
  SEMANTIC_ALIASES,
  NEUTRALS_LIGHT,
  NEUTRALS_DARK,

  // Spacing & sizing
  SPACING,
  GAPS,
  COMPONENT_SIZES,
  BREAKPOINTS,
  BREAKPOINT_QUERIES,

  // Typography
  TYPOGRAPHY,
  TYPE_STYLES,

  // Elevation & shadows
  SHADOWS,
  ELEVATIONS,

  // Borders & radius
  BORDER_RADIUS,
  BORDER_WIDTHS,
  BORDERS,
  FOCUS_RINGS,

  // Animation
  ANIMATIONS,
  ANIMATION_PRESETS,

  // Comprehensive tokens object
  DesignTokens,

  // Utility functions
  getChapterColor as getChapterColorNew,
  getStatusColor,
  getNavColor,
  generateCSSVariables as generateCSSVariablesNew,
} from "./design-tokens";
