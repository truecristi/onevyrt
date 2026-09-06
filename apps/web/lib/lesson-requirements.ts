/**
 * Lesson completion validation rules. Each lesson can define:
 * - minEvidenceLength: Minimum character count for evidence
 * - minChecklistItems: Minimum number of checklist items that must be checked
 * - requiresArtifact: Whether a specific artifact must exist
 * - artifactType: Type of artifact to check for (funnel, campaign, etc.)
 *
 * This ensures submissions represent real work, not placeholder text.
 */

import { listProjects } from "./store";
import type { Workspace } from "./workspaces";

export interface LessonRequirement {
  minEvidenceLength?: number; // Minimum evidence characters (default: 100)
  minChecklistItems?: number; // Minimum checked items (0 = no requirement)
  requiresArtifact?: boolean;
  artifactType?: string; // 'funnel', 'campaign', 'brand', etc.
  customValidate?: (workspace: Workspace) => Promise<boolean>;
}

export interface LessonRequirements {
  [lessonId: string]: LessonRequirement;
}

/**
 * Lesson-specific completion requirements.
 * Lessons not listed here use the default (100 char evidence, 0 checklist items).
 */
export const LESSON_REQUIREMENTS: LessonRequirements = {
  // ── Start ────────────────────────────────────────────────────────────────
  "m-start-assessment": {
    minEvidenceLength: 80,
    minChecklistItems: 3, // At least 3 of 4 checklist items
  },

  // ── Chapter 1 — Define ───────────────────────────────────────────────────
  "m-founder-psychology": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Must have vision + freedom number
  },
  "m-business-definition": {
    minEvidenceLength: 120,
    minChecklistItems: 2, // Must clearly name the customer and problem
  },
  "m-customer-psychology": {
    minEvidenceLength: 150,
    minChecklistItems: 2, // Must log objections and responses
  },
  "m-transformation-message": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Must have one-liner + hooks
  },
  "m-strategic-direction": {
    minEvidenceLength: 120,
    minChecklistItems: 2, // Must address 7 Systems, value, owners
  },

  // ── Chapter 2 — Implement ────────────────────────────────────────────────
  "m-positioning-brand": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Positioning + brand voice
  },
  "m-offer": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Offer must be specific + priced
  },
  "m-customer-journey": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Funnel steps + tracking
  },
  "m-marketing-system": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Real channels + real numbers
  },
  "m-sales-system": {
    minEvidenceLength: 120,
    minChecklistItems: 2, // Qualify/follow-up/close process
  },
  "m-delivery-operations": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Client promises + retention/referral rates
  },
  "m-90-day-plan": {
    minEvidenceLength: 120,
    minChecklistItems: 2, // Ordered dated actions
  },

  // ── Chapter 3 — Control ──────────────────────────────────────────────────
  "m-personal-freedom-number": {
    minEvidenceLength: 80,
    minChecklistItems: 3, // All three targets: Security, Growth, Dream
  },
  "m-price-unit-economics": {
    minEvidenceLength: 80,
    minChecklistItems: 2, // Price + cost + margin + break-even
  },
  "m-growth-mathematics": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Levers ranked + top lever identified
  },
  "m-business-economics": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Revenue + costs + profit + freedom check
  },
  "m-plan-vs-actual": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Plan vs actual + biggest gap + action
  },
  "m-improvement-loop": {
    minEvidenceLength: 120,
    minChecklistItems: 2, // Assumptions + experiment result + decision
  },

  // ── Chapter 4 — Improve & Scale ──────────────────────────────────────────
  "m-bottleneck": {
    minEvidenceLength: 150,
    minChecklistItems: 3, // Must score areas, declare, name relief move, stop doing
  },
  "m-improve-conversion": {
    minEvidenceLength: 120,
    minChecklistItems: 3, // Weakest step + change + before/target numbers
  },
  "m-improve-profit": {
    minEvidenceLength: 120,
    minChecklistItems: 3, // Lever chosen + change + new margin/profit calculated
  },
  "m-systemise-automate": {
    minEvidenceLength: 120,
    minChecklistItems: 3, // Task named + route chosen + built + new owner
  },
  "m-growth-plan": {
    minEvidenceLength: 200,
    minChecklistItems: 4, // All four actions: constraint + conversion + profit + systems
  },

  // ── Finish ───────────────────────────────────────────────────────────────
  "m-finish-transformation": {
    minEvidenceLength: 100,
    minChecklistItems: 2, // Final score vs baseline + 90-day plan
  },
};

/**
 * Get the validation rules for a specific lesson.
 * Falls back to defaults if lesson not explicitly configured.
 * Default: minimal evidence (already checked for non-empty at route level),
 * no checklist requirement. Explicit configs above have stricter requirements.
 */
export function getRequirementsForLesson(lessonId: string): LessonRequirement {
  return LESSON_REQUIREMENTS[lessonId] ?? { minEvidenceLength: 10, minChecklistItems: 0 };
}

/**
 * Validate a lesson submission against its requirements.
 * Returns null if valid; otherwise returns a user-friendly error message.
 */
export async function validateLessonSubmission(
  lessonId: string,
  evidence: string,
  checklistChecked: string[],
  workspace: any,
): Promise<string | null> {
  const requirements = getRequirementsForLesson(lessonId);

  // Check evidence length
  if (requirements.minEvidenceLength) {
    const cleaned = evidence.trim();
    if (cleaned.length < requirements.minEvidenceLength) {
      return `Evidence must be at least ${requirements.minEvidenceLength} characters. You provided ${cleaned.length}.`;
    }
  }

  // Check checklist completion
  if (requirements.minChecklistItems && requirements.minChecklistItems > 0) {
    if (checklistChecked.length < requirements.minChecklistItems) {
      return `Please complete at least ${requirements.minChecklistItems} checklist items. You have checked ${checklistChecked.length}.`;
    }
  }

  // Check required artifacts (if workspace provided)
  if (workspace && requirements.requiresArtifact && requirements.artifactType) {
    const hasArtifact = await validateArtifact(workspace.id, requirements.artifactType);
    if (!hasArtifact) {
      const artLabel = formatArtifactLabel(requirements.artifactType);
      return `You need to create a ${artLabel} first. Go back and build it before submitting.`;
    }
  }

  // Run custom validation if present
  if (requirements.customValidate) {
    const isValid = await requirements.customValidate(workspace);
    if (!isValid) {
      return `This lesson requires additional setup. Check the instructions and try again.`;
    }
  }

  return null;
}

/**
 * Check if a required artifact exists in the workspace.
 */
async function validateArtifact(workspaceId: string, _artifactType: string): Promise<boolean> {
  try {
    const projects = await listProjects(workspaceId);
    // For now, just check that at least one project exists
    // In future, could add type filtering or metadata checks
    return projects.length > 0;
  } catch {
    return false;
  }
}

/**
 * Format artifact type for user-friendly display.
 */
function formatArtifactLabel(type: string): string {
  const labels: Record<string, string> = {
    funnel: "customer journey funnel",
    campaign: "brand & campaign",
    brand: "brand profile",
    "numbers-dashboard": "numbers dashboard",
    "reality-map": "reality map",
  };
  return labels[type] || type;
}
