/**
 * ONEVYRT Design System v2 — Comprehensive Design Tokens
 *
 * The complete foundation for a world-class, cohesive visual design.
 * Includes: colors (base + semantic), spacing, typography, elevation,
 * borders, radius, animations, component sizing, and dark mode support.
 *
 * Design Philosophy:
 * - Professional, not playful. Elegant, not minimal.
 * - Consistent hierarchy and breathing room (4px baseline spacing)
 * - Chapter colors signal psychological progression (DEFINE→IMPLEMENT→CONTROL→IMPROVE→FINISH)
 * - Status colors are semantic and accessible (WCAG AA+ everywhere)
 * - Dark mode is sophisticated refinement, not inversion
 * - Animations respect prefers-reduced-motion
 * - Every component should feel premium by default
 */

// ============================================================================
// COLOR SYSTEM — Chapter + Status + Semantic + Neutral
// ============================================================================

/**
 * Chapter Colors (Primary Identifiers)
 * Each chapter represents a psychological state in the business journey.
 * The progression signals transformation: uncertainty → clarity → action → control → optimization → mastery
 */
export const CHAPTER_COLORS = {
  start: '#64748b',    // Slate — neutral baseline
  define: '#2563eb',   // Blue — clarity & strategy
  implement: '#16a34a', // Green — growth & action
  control: '#d97706',  // Amber — focus & discipline
  improve: '#dc2626',  // Red — momentum & optimization
  finish: '#0891b2',   // Cyan — mastery & freedom
} as const;

/**
 * Chapter Color Variants
 * Soft (light tinted backgrounds), base (primary text/borders), and dark (hover/active states)
 */
export const CHAPTER_COLORS_SOFT = {
  start: '#f1f5f9',
  define: '#eff6ff',
  implement: '#dcfce7',
  control: '#fef3c7',
  improve: '#fee2e2',
  finish: '#ecf8fa',
} as const;

export const CHAPTER_COLORS_DARK = {
  start: '#334155',
  define: '#1e40af',
  implement: '#15803d',
  control: '#b45309',
  improve: '#b91c1c',
  finish: '#0e7490',
} as const;

/**
 * Intermediate Shades (for gradients, subtle variations)
 * Useful for sophisticated color blending and progressive disclosure
 */
export const CHAPTER_COLORS_MID = {
  define: '#1d4ed8',    // Between base and dark
  implement: '#15a34a', // Adjusted for better contrast
  control: '#d97706',   // Optimized
  improve: '#dc2626',   // Optimized
  finish: '#0891b2',    // Optimized
} as const;

/**
 * Status Colors (Progress, Review States)
 * Semantic signals for awaiting, approved, rejected, in-progress
 */
export const STATUS_COLORS = {
  // Review states
  awaiting: '#2563eb',     // Blue — neutral pending
  approved: '#16a34a',     // Green — positive completion
  changesRequested: '#d97706', // Amber — needs attention
  rejected: '#dc2626',     // Red — blocked/negative

  // Progress states
  complete: '#16a34a',     // Green — done
  inProgress: '#0891b2',   // Cyan — active work
  notStarted: '#94a3b8',   // Gray — inactive
  skipped: '#cbd5e1',      // Light gray — not applicable

  // Readiness scores
  fragile: '#dc2626',      // Red — low readiness
  developing: '#d97706',   // Amber — moderate readiness
  strong: '#16a34a',       // Green — high readiness
  excellent: '#0891b2',    // Cyan — exceptional readiness
} as const;

/**
 * Navigation Section Colors
 * Used for visual differentiation in primary navigation
 */
export const NAV_COLORS = {
  home: '#0891b2',         // Cyan — command center
  programme: '#2563eb',    // Blue — learning
  business: '#16a34a',     // Green — operations
  coaching: '#d97706',     // Amber — mentorship
  resources: '#8b5cf6',    // Violet — knowledge
} as const;

/**
 * Neutral Base Colors (Light Mode)
 * Foundation for backgrounds, text, borders
 */
export const NEUTRALS_LIGHT = {
  // Backgrounds (hierarchy: app > subtle > surface > raised)
  bg_app: '#f7f8fc',       // App background (default view)
  bg_subtle: '#f1f4f9',    // Subtle background (secondary areas)
  surface: '#ffffff',      // Surface (cards, dropdowns, modals)
  surface_subtle: '#fafbfc', // Subtle surface (hover states)
  surface_raised: '#ffffff', // Raised surface (top-level elements)

  // Text hierarchy
  text_primary: '#111827',  // Primary text (high contrast)
  text_secondary: '#475569', // Secondary text (reduced contrast)
  text_tertiary: '#586173', // Tertiary text (WCAG AA: 4.5:1)
  text_disabled: '#94a3b8', // Disabled text
  text_muted: '#cbd5e1',   // Muted text (lowest contrast)

  // Borders (from subtle to strong)
  border_subtle: '#e8ecf2',  // Subtle dividers
  border_default: '#dde3eb', // Default borders
  border_strong: '#cbd5e1',  // Strong borders (input focus)

  // Selection & hover
  selection: 'rgba(10, 158, 110, 0.18)',
  scrollbar_thumb: 'rgba(100, 116, 139, 0.35)',
} as const;

/**
 * Neutral Base Colors (Dark Mode)
 * Navy-blue-grey aesthetic, refined not inverted
 */
export const NEUTRALS_DARK = {
  // Backgrounds (same hierarchy, shifted lighter)
  bg_app: '#1a2438',
  bg_subtle: '#202b44',
  surface: '#26314c',
  surface_subtle: '#2c3958',
  surface_raised: '#334263',

  // Text hierarchy (lighter for dark surfaces)
  text_primary: '#f8fafc',
  text_secondary: '#cbd5e1',
  text_tertiary: '#94a3b8',
  text_disabled: '#64748b',
  text_muted: '#475569',

  // Borders (translucent for dark theme)
  border_subtle: 'rgba(148, 163, 184, 0.12)',
  border_default: 'rgba(148, 163, 184, 0.18)',
  border_strong: 'rgba(148, 163, 184, 0.28)',

  // Selection & hover
  selection: 'rgba(63, 211, 158, 0.26)',
  scrollbar_thumb: 'rgba(148, 163, 184, 0.3)',
} as const;

/**
 * Brand Colors (Primary Action)
 * Green for primary CTAs, with hover/active states
 */
export const BRAND_COLORS = {
  // Light mode
  base: '#088057',         // Primary (WCAG AA: 4.96:1 text on light)
  hover: '#077049',        // Hover state
  active: '#066b46',       // Active/pressed state
  soft: '#e7f6f0',         // Light tinted background
  contrast: '#ffffff',     // Text on brand (always white)

  // Dark mode variants (lighter for legibility)
  dark_base: '#0a9e6e',    // Lighter green on dark (WCAG AA: 5.6:1)
  dark_hover: '#12b981',
  dark_active: '#34d399',
  dark_soft: '#0e2b22',

  // Fixed for buttons (stays same in both themes for white text)
  solid: '#088057',        // Button fill (WCAG AA: 4.95:1 white text both themes)
  solid_hover: '#077049',
} as const;

/**
 * Semantic Status Colors (with dark mode variants)
 */
export const SEMANTIC_COLORS = {
  success: {
    light: '#12703a',
    dark: '#34d399',
    soft_light: '#ecfdf3',
    soft_dark: '#052e2b',
  },
  warning: {
    light: '#b45309',
    dark: '#fbbf24',
    soft_light: '#fff8e7',
    soft_dark: '#2a2005',
  },
  danger: {
    light: '#c81e1e',
    dark: '#f87171',
    soft_light: '#fff1f1',
    soft_dark: '#2a1010',
  },
  info: {
    light: '#2563eb',
    dark: '#60a5fa',
    soft_light: '#eff6ff',
    soft_dark: '#0c1c3a',
  },
} as const;

/**
 * Alias Tokens (Semantic naming for common use cases)
 */
export const SEMANTIC_ALIASES = {
  error: SEMANTIC_COLORS.danger,
  success: SEMANTIC_COLORS.success,
  warning: SEMANTIC_COLORS.warning,
  info: SEMANTIC_COLORS.info,
} as const;

// ============================================================================
// SPACING SYSTEM — 4px baseline scale
// ============================================================================

export const SPACING = {
  // Core scale: 4px base × multipliers
  0: '0',
  1: '4px',   // micro
  2: '8px',   // xs
  3: '12px',  // sm
  4: '16px',  // md
  5: '20px',  // lg
  6: '24px',  // xl
  8: '32px',  // 2xl
  10: '40px', // 3xl
  12: '48px', // 4xl
  16: '64px', // 5xl
  20: '80px', // 6xl
  24: '96px', // 7xl

  // Semantic aliases for component padding
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
} as const;

/**
 * Gap Scale (for flexbox/grid)
 * Follows same 4px baseline
 */
export const GAPS = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
} as const;

// ============================================================================
// TYPOGRAPHY SYSTEM — Professional scale
// ============================================================================

export const TYPOGRAPHY = {
  // Font family stack (Apple-first for SF Pro)
  family: {
    sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Courier, monospace',
  },

  // Type scale — sizes in pixels
  sizes: {
    // Display/hero level (marketing, landing pages)
    display_xl: '64px',
    display_lg: '48px',
    display_md: '40px',
    display_sm: '32px',

    // Heading level (page titles, major sections)
    heading_1: '32px',
    heading_2: '24px',
    heading_3: '20px',
    heading_4: '18px',
    heading_5: '16px',
    heading_6: '14px',

    // Body text
    body_lg: '16px',   // Large body
    body_md: '14px',   // Standard body
    body_sm: '13px',   // Small body
    body_xs: '12px',   // Extra small

    // UI elements
    button: '14px',
    input: '14px',
    label: '13px',
    caption: '12px',
    overline: '11px',  // All-caps small text
  },

  // Line height scale
  lineHeights: {
    tight: '1.2',      // Headings (54-64px sizes)
    snug: '1.4',       // Headings (24-40px sizes)
    normal: '1.6',     // Body text (14-18px)
    relaxed: '1.8',    // Comfortable reading (marketing)
    loose: '2.0',      // Generous space (dense text)
  },

  // Letter spacing (em units)
  letterSpacing: {
    tight: '-0.02em',      // Display text (condense)
    base: '-0.005em',      // Normal text
    loose: '0.02em',       // UI labels
    extra_loose: '0.06px', // Overline/caps
  },

  // Font weights
  weights: {
    thin: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

/**
 * Predefined type styles (component-ready)
 * Use these for consistent typography across components
 */
export const TYPE_STYLES = {
  // Display
  display_xl: {
    size: '64px',
    weight: 700,
    lineHeight: '1.1',
    letterSpacing: '-0.055em',
  },

  // Headings
  h1: {
    size: '32px',
    weight: 700,
    lineHeight: '1.2',
    letterSpacing: '-0.02em',
  },
  h2: {
    size: '24px',
    weight: 700,
    lineHeight: '1.2',
    letterSpacing: '-0.01em',
  },
  h3: {
    size: '20px',
    weight: 600,
    lineHeight: '1.4',
  },
  h4: {
    size: '18px',
    weight: 600,
    lineHeight: '1.4',
  },

  // Body
  body_lg: {
    size: '16px',
    weight: 400,
    lineHeight: '1.6',
  },
  body_md: {
    size: '14px',
    weight: 400,
    lineHeight: '1.6',
  },
  body_sm: {
    size: '13px',
    weight: 400,
    lineHeight: '1.6',
  },

  // UI
  button: {
    size: '14px',
    weight: 500,
    lineHeight: '1.4',
  },
  label: {
    size: '13px',
    weight: 500,
    lineHeight: '1.4',
  },
  caption: {
    size: '12px',
    weight: 400,
    lineHeight: '1.4',
  },
  overline: {
    size: '11px',
    weight: 700,
    lineHeight: '1.4',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
} as const;

// ============================================================================
// ELEVATION & SHADOW SYSTEM — Subtle, sophisticated
// ============================================================================

export const SHADOWS = {
  // Light mode shadows
  xs_light: '0 1px 2px rgba(15, 23, 42, 0.05)',
  sm_light: '0 2px 6px -1px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
  md_light: '0 8px 24px -6px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.06)',
  lg_light: '0 20px 48px -12px rgba(15, 23, 42, 0.20), 0 6px 16px -8px rgba(15, 23, 42, 0.10)',
  xl_light: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',

  // Dark mode shadows (darker, deeper)
  xs_dark: '0 1px 2px rgba(0, 0, 0, 0.4)',
  sm_dark: '0 2px 6px -1px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)',
  md_dark: '0 8px 24px -6px rgba(0, 0, 0, 0.55), 0 2px 6px -2px rgba(0, 0, 0, 0.4)',
  lg_dark: '0 20px 48px -12px rgba(0, 0, 0, 0.65), 0 6px 16px -8px rgba(0, 0, 0, 0.5)',
  xl_dark: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
} as const;

/**
 * Elevation levels (semantic elevation)
 * Use these for consistent depth cues
 */
export const ELEVATIONS = {
  none: 'none',
  xs: SHADOWS.xs_light,
  sm: SHADOWS.sm_light,
  md: SHADOWS.md_light,
  lg: SHADOWS.lg_light,
  xl: SHADOWS.xl_light,
} as const;

// ============================================================================
// BORDER & RADIUS SYSTEM — Clean, refined
// ============================================================================

export const BORDER_RADIUS = {
  // Corner radius scale (4px base × multipliers)
  xs: '4px',   // Micro controls (4px)
  sm: '8px',   // Small buttons, inputs (8px)
  md: '12px',  // Medium buttons, cards (12px)
  lg: '14px',  // Large cards, panels (14px)
  xl: '18px',  // Extra large panels (18px)
  '2xl': '24px', // Modals, hero elements (24px)
  pill: '999px', // Fully rounded (badges, pills)
} as const;

export const BORDER_WIDTHS = {
  none: '0',
  thin: '1px',   // Default borders
  medium: '2px', // Focus rings, stronger emphasis
  thick: '3px',  // Decorative elements
} as const;

export const BORDERS = {
  default: `1px solid`,
  medium: `2px solid`,
  thick: `3px solid`,
} as const;

/**
 * Focus ring styling
 * High contrast focus indicators for keyboard navigation
 */
export const FOCUS_RINGS = {
  light: '0 0 0 3px rgba(10, 158, 110, 0.2)',  // Brand green on light
  dark: '0 0 0 3px rgba(124, 110, 255, 0.28)', // Purple on dark
  accessible: '2px solid',                      // High contrast fallback
} as const;

// ============================================================================
// ANIMATION & MOTION — Smooth, purposeful
// ============================================================================

export const ANIMATIONS = {
  // Duration scale (milliseconds)
  durations: {
    micro: '75ms',    // Quick feedback (hover effects)
    fast: '120ms',    // Form interactions
    base: '150ms',    // UI state changes
    normal: '160ms',  // Hover effects
    panel: '200ms',   // Panel open/close
    modal: '240ms',   // Modal transitions
    slow: '300ms',    // Page transitions
  },

  // Easing functions (cubic-bezier)
  easing: {
    linear: 'cubic-bezier(0, 0, 1, 1)',
    ease_in: 'cubic-bezier(0.4, 0, 1, 1)',
    ease_out: 'cubic-bezier(0, 0, 0.2, 1)',
    ease_in_out: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.2, 0.7, 0.3, 1)',     // Apple-style spring
    bounce: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)', // Bouncy entrance
  },

  // Common transition combinations
  transitions: {
    colors: 'color, background-color, border-color',
    all: 'all',
    transform: 'transform',
    opacity: 'opacity',
  },
} as const;

/**
 * Predefined animation combinations
 */
export const ANIMATION_PRESETS = {
  fade_in: {
    duration: '200ms',
    easing: 'ease-out',
    properties: 'opacity',
  },
  slide_up: {
    duration: '300ms',
    easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
    properties: 'transform, opacity',
  },
  scale_in: {
    duration: '200ms',
    easing: 'ease-out',
    properties: 'transform, opacity',
  },
} as const;

// ============================================================================
// COMPONENT SIZING — Consistent dimensions
// ============================================================================

export const COMPONENT_SIZES = {
  // Button heights
  button_xs: '28px',
  button_sm: '32px',
  button_md: '40px',
  button_lg: '44px',
  button_xl: '48px',

  // Input heights (match buttons for alignment)
  input_xs: '28px',
  input_sm: '32px',
  input_md: '40px',
  input_lg: '44px',

  // Icon sizes
  icon_xs: '16px',
  icon_sm: '20px',
  icon_md: '24px',
  icon_lg: '32px',
  icon_xl: '48px',
  icon_2xl: '64px',

  // Card & surface sizes
  card_min_width: '280px',
  card_max_width: '400px',
  modal_width: '512px',
  modal_max_width: '90vw',

  // Common container widths
  container_sm: '640px',
  container_md: '768px',
  container_lg: '1024px',
  container_xl: '1280px',
  container_2xl: '1536px',
} as const;

/**
 * Responsive breakpoints (mobile-first)
 */
export const BREAKPOINTS = {
  xs: '320px',   // Extra small (mobile)
  sm: '640px',   // Small (tablet)
  md: '768px',   // Medium (tablet landscape)
  lg: '1024px',  // Large (desktop)
  xl: '1280px',  // Extra large (large desktop)
  '2xl': '1536px', // 2XL (ultra-wide)
} as const;

/**
 * Breakpoint queries (for CSS media queries)
 */
export const BREAKPOINT_QUERIES = {
  xs: '@media (max-width: 319px)',
  sm: '@media (min-width: 640px)',
  md: '@media (min-width: 768px)',
  lg: '@media (min-width: 1024px)',
  xl: '@media (min-width: 1280px)',
  '2xl': '@media (min-width: 1536px)',
} as const;

// ============================================================================
// UTILITY FUNCTIONS — Color & token helpers
// ============================================================================

/**
 * Get chapter color by key
 */
export function getChapterColor(key: string): string {
  return CHAPTER_COLORS[key as keyof typeof CHAPTER_COLORS] ?? CHAPTER_COLORS.start;
}

/**
 * Get chapter color soft variant
 */
export function getChapterColorSoft(key: string): string {
  return CHAPTER_COLORS_SOFT[key as keyof typeof CHAPTER_COLORS_SOFT] ?? CHAPTER_COLORS_SOFT.start;
}

/**
 * Get chapter color dark variant
 */
export function getChapterColorDark(key: string): string {
  return CHAPTER_COLORS_DARK[key as keyof typeof CHAPTER_COLORS_DARK] ?? CHAPTER_COLORS_DARK.start;
}

/**
 * Get status color by key
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.notStarted;
}

/**
 * Get navigation color by section
 */
export function getNavColor(section: string): string {
  return NAV_COLORS[section as keyof typeof NAV_COLORS] ?? NAV_COLORS.home;
}

/**
 * Generate CSS custom properties (for embedding in stylesheets)
 */
export function generateCSSVariables(): string {
  return `
:root {
  /* Chapter Colors */
  --chapter-start: ${CHAPTER_COLORS.start};
  --chapter-define: ${CHAPTER_COLORS.define};
  --chapter-implement: ${CHAPTER_COLORS.implement};
  --chapter-control: ${CHAPTER_COLORS.control};
  --chapter-improve: ${CHAPTER_COLORS.improve};
  --chapter-finish: ${CHAPTER_COLORS.finish};

  /* Spacing */
  --space-1: ${SPACING[1]};
  --space-2: ${SPACING[2]};
  --space-3: ${SPACING[3]};
  --space-4: ${SPACING[4]};
  --space-6: ${SPACING[6]};
  --space-8: ${SPACING[8]};

  /* Animation */
  --duration-fast: ${ANIMATIONS.durations.fast};
  --duration-base: ${ANIMATIONS.durations.base};
  --duration-slow: ${ANIMATIONS.durations.slow};
  --easing-spring: ${ANIMATIONS.easing.spring};
}
  `.trim();
}

// ============================================================================
// EXPORT COMPREHENSIVE TOKENS OBJECT
// ============================================================================

export const DesignTokens = {
  // Colors
  chapters: CHAPTER_COLORS,
  chapters_soft: CHAPTER_COLORS_SOFT,
  chapters_dark: CHAPTER_COLORS_DARK,
  status: STATUS_COLORS,
  nav: NAV_COLORS,
  brand: BRAND_COLORS,
  semantics: SEMANTIC_COLORS,
  neutrals_light: NEUTRALS_LIGHT,
  neutrals_dark: NEUTRALS_DARK,

  // Spacing
  spacing: SPACING,
  gaps: GAPS,

  // Typography
  typography: TYPOGRAPHY,
  type_styles: TYPE_STYLES,

  // Elevation & Shadows
  shadows: SHADOWS,
  elevations: ELEVATIONS,

  // Borders & Radius
  border_radius: BORDER_RADIUS,
  border_widths: BORDER_WIDTHS,
  borders: BORDERS,
  focus_rings: FOCUS_RINGS,

  // Animation
  animations: ANIMATIONS,
  animation_presets: ANIMATION_PRESETS,

  // Components
  component_sizes: COMPONENT_SIZES,
  breakpoints: BREAKPOINTS,
} as const;

export default DesignTokens;
