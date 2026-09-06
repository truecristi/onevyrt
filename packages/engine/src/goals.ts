/**
 * Goal Hierarchy: the single chain the rest of the program hangs off of —
 * vision -> annual goal -> quarterly target -> monthly KPI -> project ->
 * action. Each node optionally links up to its parent (one level up) and,
 * for actions, back to a canvas node — so a single action someone commits to
 * can be traced all the way up to the 24-36 month vision it actually serves,
 * and a stalled vision can be traced back down to the specific action that's
 * blocking it. Pure data + pure roll-up logic, no UI.
 */
export type GoalLevel = "vision" | "annual" | "quarterly" | "monthly_kpi" | "project" | "action";

export const GOAL_LEVELS: readonly GoalLevel[] = ["vision", "annual", "quarterly", "monthly_kpi", "project", "action"];

export const GOAL_LEVEL_LABELS: Record<GoalLevel, string> = {
  vision: "24–36 Month Vision",
  annual: "Annual Goal",
  quarterly: "Quarterly Target",
  monthly_kpi: "Monthly KPI",
  project: "Project",
  action: "Action",
};

export type GoalStatus = "not_started" | "on_track" | "at_risk" | "done";

export interface GoalNode {
  id: string;
  level: GoalLevel;
  title: string;
  /** The goal one level up this belongs to. Absent only for a root (a vision
   *  with no parent, or a level-1 goal entered before its parent exists). */
  parentId?: string;
  /** Numeric target/actual, mainly meaningful on monthly_kpi (e.g. "40 leads")
   *  but usable at any level someone wants to measure directly. */
  targetValue?: number;
  actualValue?: number;
  unit?: string;
  dueDate?: string;
  /** The status THIS node was set to directly — rollUpStatus below is what
   *  actually accounts for children; this is the leaf-level truth. */
  status: GoalStatus;
  /** Ties an action/project back to the canvas block it's actually about. */
  linkedNodeId?: string;
  createdAt: string;
}

export function childrenOf(goals: readonly GoalNode[], parentId: string): GoalNode[] {
  return goals.filter((g) => g.parentId === parentId);
}

export function rootGoals(goals: readonly GoalNode[]): GoalNode[] {
  return goals.filter((g) => !g.parentId);
}

/** A goal's EFFECTIVE status, accounting for its descendants — a vision
 *  isn't really "on track" if the quarterly target underneath it is at
 *  risk, even if nobody's gone back and manually flagged the vision itself.
 *  A goal with no children just reports its own status; a childless status
 *  is never overridden. Never hides a downstream problem: any at-risk
 *  descendant makes the whole chain above it at-risk too. */
export function rollUpStatus(goalId: string, goals: readonly GoalNode[]): GoalStatus {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return "not_started";
  const kids = childrenOf(goals, goalId);
  if (kids.length === 0) return goal.status;
  const childStatuses = kids.map((k) => rollUpStatus(k.id, goals));
  if (childStatuses.includes("at_risk")) return "at_risk";
  if (childStatuses.every((s) => s === "done")) return "done";
  if (childStatuses.some((s) => s === "on_track" || s === "done")) return "on_track";
  return "not_started";
}

export interface GoalSummary {
  total: number;
  done: number;
  onTrack: number;
  atRisk: number;
  notStarted: number;
  /** Root-level goals (usually the vision(s)) whose rolled-up status is
   *  at_risk — the "what's actually threatening the top of the chain"
   *  view, since a single blocked action three levels down is easy to lose
   *  track of otherwise. */
  atRiskRoots: GoalNode[];
}

export function summarizeGoals(goals: readonly GoalNode[]): GoalSummary {
  const summary: GoalSummary = { total: goals.length, done: 0, onTrack: 0, atRisk: 0, notStarted: 0, atRiskRoots: [] };
  for (const g of goals) {
    const effective = rollUpStatus(g.id, goals);
    if (effective === "done") summary.done++;
    else if (effective === "on_track") summary.onTrack++;
    else if (effective === "at_risk") summary.atRisk++;
    else summary.notStarted++;
  }
  summary.atRiskRoots = rootGoals(goals).filter((g) => rollUpStatus(g.id, goals) === "at_risk");
  return summary;
}

/** Walks a goal up to its root (the vision it ultimately serves), following
 *  parentId links. Guards against a cyclic/self-referential parentId
 *  (shouldn't happen, but a corrupted doc could produce one) by capping at
 *  the number of levels that could ever legitimately exist. */
export function ancestryOf(goalId: string, goals: readonly GoalNode[]): GoalNode[] {
  const chain: GoalNode[] = [];
  let current = goals.find((g) => g.id === goalId);
  let guard = 0;
  while (current && guard < GOAL_LEVELS.length + 1) {
    chain.unshift(current);
    current = current.parentId ? goals.find((g) => g.id === current!.parentId) : undefined;
    guard++;
  }
  return chain;
}
