/**
 * Design tokens (§12): colour, typography, spacing, radius and motion.
 * Neutral palette chosen for WCAG 2.2 AA contrast on white and near-black
 * text; restrained, high-precision visual language per the spec's design
 * direction - not yet the full ONEVYRT brand palette, which is a product
 * decision for a later phase.
 */

export const color = {
  background: "#ffffff",
  backgroundMuted: "#f5f5f7",
  surface: "#ffffff",
  // Phase 8 accessibility audit finding: the original #d2d2d7 was only
  // 1.51:1 against white, failing WCAG 2.2 SC 1.4.11's 3:1 requirement
  // for a UI component's visible boundary (a border only decorative
  // elements can ignore, but a border marking an actual control's edge
  // cannot). #8e8e93 (Apple's systemGray, staying within this token
  // file's own "Apple-inspired" palette) clears it at ~3.3:1 on white.
  border: "#8e8e93", // ~3.3:1 on white (SC 1.4.11 UI component contrast)
  textPrimary: "#1d1d1f", // ~15.8:1 on white
  textSecondary: "#6e6e73", // ~4.9:1 on white
  accent: "#0071e3", // ~4.6:1 on white at normal text size
  accentHover: "#0058b0",
  danger: "#d70015", // ~5.9:1 on white
  success: "#1e7e34",
  focusRing: "#0071e3",
} as const;

export const font = {
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  sizeBody: "1rem",
  sizeSmall: "0.875rem",
  sizeLarge: "1.25rem",
  sizeHeading: "clamp(1.5rem, 1rem + 2vw, 2.5rem)",
  weightRegular: 400,
  weightSemibold: 600,
  lineHeightBody: 1.5,
  lineHeightHeading: 1.1,
} as const;

// 8px base scale - generous spacing per the "Apple-inspired" section spacing guidance.
export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2.5rem",
  xxl: "4rem",
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  full: "9999px",
} as const;

export const motion = {
  durationFast: "120ms",
  durationBase: "200ms",
  easingStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
  reducedMotionQuery: "(prefers-reduced-motion: reduce)",
} as const;
