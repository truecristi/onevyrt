/**
 * Decision Moment Utilities
 *
 * Client-side utilities for triggering and handling decision-moment reminders
 * that surface a user's Why & Creed before major actions.
 */

export type ActionType = "payment" | "milestone" | "level-up" | "chapter-submit";

export interface DecisionMomentContext {
  amount?: number;
  description?: string;
  chapterName?: string;
  chapterNumber?: number;
  lessonTitle?: string;
  [key: string]: unknown;
}

export interface ModalConfig {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  color: string;
  icon: string;
}

export interface DecisionMomentReminder {
  actionType: ActionType;
  why: string;
  creed: string;
  modal: ModalConfig;
  context: DecisionMomentContext;
}

export interface DecisionMomentResponse {
  ok: boolean;
  error?: string;
  reminder?: DecisionMomentReminder;
}

/**
 * Trigger a decision moment reminder
 * Call this before a major action to surface the user's Why & Creed
 */
export async function triggerDecisionMoment(
  actionType: ActionType,
  context?: DecisionMomentContext
): Promise<DecisionMomentResponse> {
  try {
    const response = await fetch("/api/dashboard/trigger-decision-moment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ actionType, context }),
    });

    const data: DecisionMomentResponse = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error("Failed to trigger decision moment:", error);
    return {
      ok: false,
      error: "Failed to fetch decision moment",
    };
  }
}

/**
 * Format context for display
 * Converts context object to human-readable description
 */
export function formatContextForDisplay(
  actionType: ActionType,
  context?: DecisionMomentContext
): string {
  if (!context) return "";

  switch (actionType) {
    case "payment":
      return context.amount
        ? `Investment: $${context.amount}`
        : "You're about to make an investment";
    case "milestone":
      return context.description || "You've reached a milestone";
    case "level-up":
      return context.lessonTitle || "You're unlocking new capabilities";
    case "chapter-submit":
      return context.chapterName
        ? `Submitting: ${context.chapterName}`
        : "Submitting your work";
    default:
      return "";
  }
}

/**
 * Get color for action type
 * Returns the brand color associated with an action
 */
export function getActionColor(actionType: ActionType): string {
  const colors: Record<ActionType, string> = {
    payment: "#2563eb", // Blue
    milestone: "#16a34a", // Green
    "level-up": "#d97706", // Amber
    "chapter-submit": "#0891b2", // Cyan
  };
  return colors[actionType] || "#6b7280";
}

/**
 * Get icon for action type
 * Returns the heroicon name for an action
 */
export function getActionIcon(actionType: ActionType): string {
  const icons: Record<ActionType, string> = {
    payment: "credit-card",
    milestone: "star",
    "level-up": "arrow-up",
    "chapter-submit": "check-circle",
  };
  return icons[actionType] || "sparkles";
}
