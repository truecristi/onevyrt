/**
 * Program: the business-definition + 7 Forces workbook layer that sits BEFORE
 * the canvas/simulation (Map & Model = Phase 5/6; this is Phase 1-4). Original
 * software modules inspired by standard business-transformation coaching
 * structure — no third-party workbook text is stored or reproduced here, only
 * the user's own answers and action items. Pure data + pure builders; no UI.
 */
export interface BusinessDefinition {
  businessName?: string;
  whoServe?: string;
  mainOffer?: string;
  currentReality?: string;
  breakthrough?: string;
  vision?: string;
  milestones?: string;
  mainConstraint?: string;
  mainOpportunity?: string;
  /** State/Story/Strategy (Module 3): the human/narrative layer before numbers. */
  currentState?: string;
  currentStory?: string;
  newStory?: string;
  strategy?: string;
  /** Mindfulness (Module 5): the one thing worth an hour of focus this week. */
  weeklyFocus?: string;
}

export type ForceNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const FORCE_NAMES: Record<ForceNumber, string> = {
  1: "Business Map",
  2: "Strategic Innovation",
  3: "Marketing & Product Promises",
  4: "Sales Systems",
  5: "Financial & Legal Anticipation",
  6: "Optimization, People, Process, Execution",
  7: "Client Advocacy & Culture",
};

export type ActionStatus = "open" | "in_progress" | "done";
export type ActionPriority = "low" | "medium" | "high";
/** How sure the owner actually is this action gets done on time — separate
 *  from priority (how much it matters) and status (where it's at). */
export type ActionConfidence = "low" | "medium" | "high";
/** The same metric keys the Goal Solver already uses — an action item can
 *  point at the KPI it's meant to move, instead of that link living only
 *  in someone's head. */
export type LinkedKpi = "grossProfit" | "revenue" | "buyers" | "cost" | "mrr" | "ltv";

export interface ForceActionItem {
  id: string;
  force: ForceNumber;
  principle: string;
  actionItem: string;
  dollarValue?: number; // minor units
  deadline?: string;    // ISO date
  owner?: string;
  status: ActionStatus;
  priority: ActionPriority;
  confidence?: ActionConfidence;
  /** A canvas node id this action is meant to move — lets the plan point
   *  back at the actual block instead of just describing it in prose. */
  linkedNodeId?: string;
  linkedKpi?: LinkedKpi;
  createdAt: string;
}

export interface ProgramState {
  definition?: BusinessDefinition;
  forceActions?: ForceActionItem[];
  /** Guided-course progress: which lessons without their own "wrote
   *  something down" signal (Money, Profit Drivers, Brief) have at least
   *  been opened, plus one-time welcome/completion flags. Persisted so
   *  "resume where I left off" survives a reload, not just the session. */
  visitedLessons?: string[];
  introSeen?: boolean;
  graduationSeen?: boolean;
}

export interface ForceActionSummary {
  total: number;
  open: number;
  inProgress: number;
  done: number;
  totalDollarValue: number; // minor units, sum of all non-done items — the upside still on the table
  byForce: Record<ForceNumber, { total: number; done: number }>;
}

export function summarizeForceActions(items: ForceActionItem[]): ForceActionSummary {
  const byForce = {} as Record<ForceNumber, { total: number; done: number }>;
  for (let f = 1; f <= 7; f++) byForce[f as ForceNumber] = { total: 0, done: 0 };
  const s: ForceActionSummary = { total: 0, open: 0, inProgress: 0, done: 0, totalDollarValue: 0, byForce };
  for (const it of items) {
    s.total++;
    if (it.status === "open") s.open++;
    else if (it.status === "in_progress") s.inProgress++;
    else s.done++;
    if (it.status !== "done") s.totalDollarValue += it.dollarValue ?? 0;
    byForce[it.force].total++;
    if (it.status === "done") byForce[it.force].done++;
  }
  return s;
}

export interface TransformationBrief {
  businessName: string;
  breakthrough: string;
  vision: string;
  milestones: string;
  mainOpportunity: string;
  mainConstraint: string;
  topActions: ForceActionItem[]; // highest dollar value, not-yet-done, top 3
  actionSummary: ForceActionSummary;
  generatedAt: string;
}

/** Highest-leverage-first brief: definition answers plus the top 3 highest-dollar open actions. */
export function buildTransformationBrief(
  definition: BusinessDefinition,
  forceActions: ForceActionItem[],
  generatedAt = new Date().toISOString(),
): TransformationBrief {
  const topActions = [...forceActions]
    .filter((a) => a.status !== "done")
    .sort((a, b) => (b.dollarValue ?? 0) - (a.dollarValue ?? 0))
    .slice(0, 3);
  return {
    businessName: definition.businessName ?? "",
    breakthrough: definition.breakthrough ?? "",
    vision: definition.vision ?? "",
    milestones: definition.milestones ?? "",
    mainOpportunity: definition.mainOpportunity ?? "",
    mainConstraint: definition.mainConstraint ?? "",
    topActions,
    actionSummary: summarizeForceActions(forceActions),
    generatedAt,
  };
}
