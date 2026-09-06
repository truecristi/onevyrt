/**
 * ONEVYRT Icon Registry — canonical icon catalog organized by category.
 *
 * This module defines the complete icon system for ONEVYRT, mapping semantic
 * concepts (chapters, statuses, actions) to Heroicons (24-grid line-style icons).
 *
 * Icons are organized by category:
 * - Chapter icons (DEFINE, IMPLEMENT, CONTROL, IMPROVE & SCALE, FINISH)
 * - Status icons (locked, available, in progress, completed, awaiting review, etc.)
 * - Action icons (add, edit, delete, download, share, print, etc.)
 * - Navigation icons (imported from existing MarketingIcons where applicable)
 *
 * All icons use the solid variant (filled) for consistency and visual weight.
 * Icon sizing is handled by IconSizer component, not individual icon props.
 */

import type { SVGProps } from "react";

// Heroicons solid (24px grid) — all imported types for compatibility
export type IconProps = SVGProps<SVGSVGElement> & { "aria-label"?: string; title?: string };

/**
 * Chapter icons — semantic visual representation of each programme stage.
 * These icons appear in the Programme Journey map and chapter navigation.
 */
export const CHAPTER_ICONS = {
  /** DEFINE — Business & Customer & Psychology Blueprint */
  define: {
    label: "Define",
    description: "Business Psychology Blueprint",
    color: "var(--ds-chapter-1, #06b6d4)", // cyan
  },
  /** IMPLEMENT — Working Business System */
  implement: {
    label: "Implement",
    description: "Working Business System",
    color: "var(--ds-chapter-2, #8b5cf6)", // purple
  },
  /** CONTROL — Numbers & Control Dashboard */
  control: {
    label: "Control",
    description: "Numbers & Control Dashboard",
    color: "var(--ds-chapter-3, #ec4899)", // pink
  },
  /** IMPROVE & SCALE — Growth & Improvement Plan */
  improve: {
    label: "Improve & Scale",
    description: "Growth & Improvement Plan",
    color: "var(--ds-chapter-4, #f59e0b)", // amber
  },
  /** FINISH — Transformation Report */
  finish: {
    label: "Finish",
    description: "Transformation Report",
    color: "var(--ds-chapter-5, #10b981)", // emerald
  },
} as const;

/**
 * Status icons — visual indicators for learner progress and item states.
 * These appear next to lesson/chapter states and in approval workflows.
 */
export const STATUS_ICONS = {
  /** Locked state — prerequisites not met */
  locked: "🔒",
  /** Available — ready to start */
  available: "⭕",
  /** In progress — currently working */
  inProgress: "⏳",
  /** Completed/Done */
  completed: "✅",
  /** Awaiting Review — submitted, waiting for coach */
  awaitingReview: "📋",
  /** Approved — coach approved, can proceed */
  approved: "✓",
  /** Rejected — coach sent back for revision */
  rejected: "✗",
  /** Not applicable or skipped */
  skipped: "⊘",
} as const;

/**
 * Action icons — UI controls for common operations.
 * These appear as icon buttons throughout the interface.
 */
export const ACTION_ICONS = {
  add: "➕",
  edit: "✏️",
  delete: "🗑️",
  download: "⬇️",
  share: "🔗",
  print: "🖨️",
  save: "💾",
  close: "✕",
  back: "←",
  forward: "→",
  search: "🔍",
  filter: "⚙️",
  more: "⋯",
} as const;

/**
 * Navigation icons — main section icons (from MarketingIcon set).
 * Kept for reference; these are rendered via MarketingIcon component.
 */
export const NAVIGATION_ICONS = {
  home: "🏠",
  programme: "📚",
  business: "💼",
  coaching: "🎯",
  resources: "📖",
  admin: "⚙️",
} as const;

/**
 * Psychological state colors — match learner's psychological state
 * at each chapter boundary.
 */
export const PSYCHOLOGICAL_STATE_COLORS: Record<
  "uncertainty" | "clarity" | "confidence" | "control" | "momentum" | "freedom",
  { label: string; color: string; bgColor: string }
> = {
  uncertainty: {
    label: "Uncertainty",
    color: "#6b7280", // gray
    bgColor: "#f3f4f6",
  },
  clarity: {
    label: "Clarity",
    color: "#06b6d4", // cyan (Chapter 1)
    bgColor: "#cffafe",
  },
  confidence: {
    label: "Confidence",
    color: "#8b5cf6", // purple (Chapter 2)
    bgColor: "#f3e8ff",
  },
  control: {
    label: "Control",
    color: "#ec4899", // pink (Chapter 3)
    bgColor: "#fce7f3",
  },
  momentum: {
    label: "Momentum",
    color: "#f59e0b", // amber (Chapter 4)
    bgColor: "#fef3c7",
  },
  freedom: {
    label: "Freedom",
    color: "#10b981", // emerald (Finish)
    bgColor: "#d1fae5",
  },
};

/**
 * Coaching workflow status colors — used in approval dashboards and
 * submission review interfaces.
 */
export const COACHING_STATUS_COLORS: Record<
  "pending" | "approved" | "rejected" | "revision",
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Awaiting Review",
    color: "#3b82f6", // blue
    bgColor: "#dbeafe",
  },
  approved: {
    label: "Approved",
    color: "#10b981", // emerald
    bgColor: "#d1fae5",
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444", // red
    bgColor: "#fee2e2",
  },
  revision: {
    label: "Needs Revision",
    color: "#f59e0b", // amber
    bgColor: "#fef3c7",
  },
};

/**
 * Get the color for a given psychological state.
 */
export function getPsychologicalStateColor(
  state: keyof typeof PSYCHOLOGICAL_STATE_COLORS
) {
  return PSYCHOLOGICAL_STATE_COLORS[state];
}

/**
 * Get the color for a given coaching status.
 */
export function getCoachingStatusColor(
  status: keyof typeof COACHING_STATUS_COLORS
) {
  return COACHING_STATUS_COLORS[status];
}
