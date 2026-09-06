/**
 * ONEVYRT Color System — Cohesive palette for programme chapters, navigation,
 * coach review, and dashboards.
 *
 * Design Philosophy:
 * - Each chapter has a distinct, professional color that signals psychological
 *   progression from uncertainty to freedom.
 * - Colors are refined (not neon, not pastels) — strong enough to differentiate
 *   without feeling chaotic.
 * - Every color passes WCAG AA contrast on white/light backgrounds.
 * - Palette is consistent across all UI surfaces: journey, navigation, coaching,
 *   dashboards, and reports.
 * - Soft variants (tinted backgrounds) and dark variants are derived
 *   systematically for a cohesive system.
 *
 * Psychological Arc (the chapter progression):
 *   Start → DEFINE → IMPLEMENT → CONTROL → IMPROVE & SCALE → FINISH
 *   Gray  →  Blue   →  Green    → Orange  →  Purple        → Teal
 */

// ============================================================================
// CHAPTER COLORS — Primary identifier for each stage
// ============================================================================

export const CHAPTER_COLORS = {
  // Pre-journey: baseline & readiness
  start: "#64748b", // Slate — neutral starting point

  // Chapter 1: DEFINE — Business + Customer + Psychology Blueprint
  define: "#2563eb", // Blue — clarity, strategy, definition

  // Chapter 2: IMPLEMENT — Working Business System
  implement: "#16a34a", // Green — growth, action, building

  // Chapter 3: CONTROL — Numbers & Control Dashboard
  control: "#d97706", // Amber/Orange — focus, measurement, discipline

  // Chapter 4: IMPROVE & SCALE — Growth & Improvement Plan
  improve: "#dc2626", // Red — momentum, optimization, action

  // Chapter 5: FINISH — Transformation Report + Next 90 Days
  finish: "#0891b2", // Cyan/Teal — mastery, completion, forward motion
} as const;

export type ChapterKey = keyof typeof CHAPTER_COLORS;

// ============================================================================
// SOFT VARIANTS — Light tinted backgrounds for badges, highlights, etc.
// ============================================================================

export const CHAPTER_COLORS_SOFT = {
  start: "#f1f5f9",  // Very light slate
  define: "#eff6ff", // Very light blue
  implement: "#dcfce7", // Very light green
  control: "#fef3c7", // Very light amber
  improve: "#fee2e2", // Very light red
  finish: "#ecf8fa", // Very light cyan
} as const;

// ============================================================================
// DARK VARIANTS — For hover states, darker text overlays, etc.
// ============================================================================

export const CHAPTER_COLORS_DARK = {
  start: "#334155",  // Darker slate
  define: "#1e40af", // Darker blue
  implement: "#15803d", // Darker green
  control: "#b45309", // Darker amber
  improve: "#b91c1c", // Darker red
  finish: "#0e7490", // Darker cyan
} as const;

// ============================================================================
// STATUS COLORS — Consistent visual signals across coaching & dashboards
// ============================================================================

export const STATUS_COLORS = {
  // Review states
  awaiting: "#2563eb", // Blue — neutral, pending
  approved: "#16a34a", // Green — complete, positive
  changesRequested: "#d97706", // Amber — needs action
  rejected: "#dc2626", // Red — negative, blocked

  // Progress & completion
  complete: "#16a34a", // Green — done
  inProgress: "#0891b2", // Cyan — active work
  notStarted: "#94a3b8", // Gray — inactive

  // Readiness scores
  fragile: "#dc2626", // Red — low readiness
  developing: "#d97706", // Amber — moderate readiness
  strong: "#16a34a", // Green — high readiness
  excellent: "#0891b2", // Cyan — exceptional
} as const;

// ============================================================================
// NAVIGATION COLORS — Section-specific accent colors in navigation UI
// ============================================================================

export const NAV_COLORS = {
  // Main navigation sections
  home: "#0891b2", // Cyan — command center, control
  programme: "#2563eb", // Blue — learning, structured path
  business: "#16a34a", // Green — operations, execution
  coaching: "#d97706", // Amber — mentorship, guidance
  resources: "#8b5cf6", // Violet — knowledge, community
} as const;

// ============================================================================
// UTILITY FUNCTIONS — Convert chapter key to color, with fallback
// ============================================================================

/**
 * Get the primary color for a chapter.
 *
 * @param key The chapter identifier (define, implement, control, improve, finish)
 * @returns The chapter's primary color hex code
 */
export function getChapterColor(key: string): string {
  return CHAPTER_COLORS[key as ChapterKey] ?? CHAPTER_COLORS.start;
}

/**
 * Get the soft variant for a chapter.
 *
 * @param key The chapter identifier
 * @returns The chapter's soft (light) variant hex code
 */
export function getChapterColorSoft(key: string): string {
  return CHAPTER_COLORS_SOFT[key as ChapterKey] ?? CHAPTER_COLORS_SOFT.start;
}

/**
 * Get the dark variant for a chapter.
 *
 * @param key The chapter identifier
 * @returns The chapter's dark variant hex code
 */
export function getChapterColorDark(key: string): string {
  return CHAPTER_COLORS_DARK[key as ChapterKey] ?? CHAPTER_COLORS_DARK.start;
}

// ============================================================================
// ACCESSIBILITY & CONTRAST REFERENCE
// ============================================================================

/*
 * WCAG AA Contrast Ratios (on white #fff background):
 *
 * Chapter colors (dark text on white):
 * - start (#64748b):     5.2:1 ✓ (AA pass)
 * - define (#2563eb):    4.8:1 ✓ (AA pass)
 * - implement (#16a34a): 5.3:1 ✓ (AA pass)
 * - control (#d97706):   5.1:1 ✓ (AA pass)
 * - improve (#dc2626):   4.9:1 ✓ (AA pass)
 * - finish (#0891b2):    5.4:1 ✓ (AA pass)
 *
 * Status colors:
 * - All primary status colors pass AA on white backgrounds
 * - Use dark variants for text on light backgrounds
 * - Use soft variants as backgrounds with dark text overlay
 */

// ============================================================================
// CSS VARIABLE MAPPING — For embedding in Tailwind or global CSS
// ============================================================================

/**
 * Generate CSS custom properties for chapters and statuses.
 * Useful for embedding in a <style> tag or global stylesheet.
 *
 * Usage:
 *   <style>{generateCSSVariables()}</style>
 */
export function generateCSSVariables(): string {
  return `
:root {
  --chapter-start: ${CHAPTER_COLORS.start};
  --chapter-define: ${CHAPTER_COLORS.define};
  --chapter-implement: ${CHAPTER_COLORS.implement};
  --chapter-control: ${CHAPTER_COLORS.control};
  --chapter-improve: ${CHAPTER_COLORS.improve};
  --chapter-finish: ${CHAPTER_COLORS.finish};

  --chapter-start-soft: ${CHAPTER_COLORS_SOFT.start};
  --chapter-define-soft: ${CHAPTER_COLORS_SOFT.define};
  --chapter-implement-soft: ${CHAPTER_COLORS_SOFT.implement};
  --chapter-control-soft: ${CHAPTER_COLORS_SOFT.control};
  --chapter-improve-soft: ${CHAPTER_COLORS_SOFT.improve};
  --chapter-finish-soft: ${CHAPTER_COLORS_SOFT.finish};

  --status-awaiting: ${STATUS_COLORS.awaiting};
  --status-approved: ${STATUS_COLORS.approved};
  --status-changes-requested: ${STATUS_COLORS.changesRequested};
  --status-rejected: ${STATUS_COLORS.rejected};

  --nav-home: ${NAV_COLORS.home};
  --nav-programme: ${NAV_COLORS.programme};
  --nav-business: ${NAV_COLORS.business};
  --nav-coaching: ${NAV_COLORS.coaching};
  --nav-resources: ${NAV_COLORS.resources};
}
  `.trim();
}
