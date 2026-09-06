/**
 * Unified Action Item — a canonical, READ-ONLY view over the 5 real
 * per-project action/decision/evidence types that already feed at least one
 * cross-cutting "what needs my attention" consumer today
 * (apps/web/app/funnel-studio.tsx's Fix First list): ForceActionItem
 * (program.ts), GoalNode (goals.ts), Decision (loop.ts), AssumptionEntry
 * (assumptions.ts), ExperimentEntry (experiments.ts).
 *
 * This resolves the "one action-plan system" cross-cutting question flagged
 * in docs/IMPLEMENTATION_ROADMAP.md as the single highest-leverage
 * unresolved architecture decision (it recurs across platform-spec Sections
 * 2, 5, 7, 8, 12, 13) — as a scoped-down READ-ONLY adapter, not a data
 * migration. Every source type keeps its own real storage shape, CRUD UI,
 * and validation exactly as today; this module only normalizes a VIEW over
 * them. A true schema unification was confirmed disproportionate by two
 * fresh, file:line-verified research passes this session: the 13 real
 * action-item-shaped types split across 3 different storage scopes (per-
 * project FunnelDoc, two different per-workspace tables), share almost no
 * field names (four different spellings of "the thing to do", five of
 * "when it's due"), and several carry fields with no equivalent anywhere
 * else (Decision's required owner/dueDate/measurement, GoalNode's parent-
 * child rollup, BlockOpsEntry's nested checklist/kpis) — forcing them into
 * one storage shape would either lose real data or require a genuinely
 * risky cross-scope migration, comparable in size to the still-deliberately-
 * deferred program.definition migration (see the roadmap doc's Section 1
 * follow-up).
 *
 * Deliberately excludes, for now — confirmed by direct read to have ZERO
 * existing cross-cutting consumer, so an adapter for them would be
 * speculative, unused code rather than a fix for a demonstrated gap:
 * ChecklistItem, BlockOpsEntry, RiskRegisterEntry (all per-project), Sprint
 * (per-workspace). Also deliberately excludes the 3 other real per-workspace
 * types (ExecTask, ExecGoal, GrowthPlanAction): their one real cross-cutting
 * consumer (apps/web/lib/reports/transformation-report.ts) already has its
 * own report-specific output shapes (NextStepAction/Milestone) carrying
 * fields (metric, target, impact, definitionOfDone) this simpler shape
 * doesn't — forcing them through UnifiedActionItem would be a lossy
 * conversion for no real gain, the exact anti-pattern this whole cross-
 * store-merge effort has avoided all session. If a future per-workspace
 * cross-cutting consumer needs them (e.g. a Command Center "what needs
 * attention" widget), extend this module then, against that real need —
 * don't speculate on its shape now.
 *
 * Pure and dependency-free (matches lib/studio/fix-first.ts's own stated
 * design goal) — no React, no db, so it's unit-testable and usable from
 * both engine-level code and any web consumer without pulling anything
 * heavier along with it.
 */
import type { ForceActionItem, ActionPriority } from "./program.ts";
import type { GoalNode } from "./goals.ts";
import type { Decision } from "./loop.ts";
import type { AssumptionEntry } from "./assumptions.ts";
import type { ExperimentEntry } from "./experiments.ts";

export type UnifiedActionStatus = "not_started" | "in_progress" | "done";
export type UnifiedActionSource = "forceAction" | "goal" | "decision" | "assumption" | "experiment";

export interface UnifiedActionItem {
  source: UnifiedActionSource;
  sourceId: string;
  title: string;
  detail: string;
  owner: string;   // "" when the source type has no owner concept, or it's unset
  due: string;      // ISO date, or "" when the source type has no due-date concept, or it's unset
  status: UnifiedActionStatus;
  priority: ActionPriority | null;   // null when the source type has no real priority concept
  /** True when the SOURCE type's own already-established "worth surfacing"
   *  signal fires (overdue, at-risk, awaiting-decision, overconfident,
   *  unreviewed-invalidated). Reuses each type's existing semantics — the
   *  same ones summarizeAssumptions()/summarizeExperiments() already
   *  compute elsewhere — never a new heuristic invented here. Callers
   *  decide what to do with it (e.g. Fix First keeps only these); this
   *  module only normalizes the shape, it doesn't decide what's worth
   *  showing. */
  needsAttention: boolean;
}

/** The one place "is this thing overdue" is actually decided, instead of
 *  five ad hoc string comparisons scattered across callers. */
export function isOverdue(due: string | undefined | null, today: string): boolean {
  return Boolean(due) && due! < today;
}

export function fromForceAction(fa: ForceActionItem, today: string): UnifiedActionItem {
  return {
    source: "forceAction", sourceId: fa.id, title: fa.actionItem, detail: fa.principle,
    owner: fa.owner ?? "", due: fa.deadline ?? "",
    status: fa.status === "done" ? "done" : fa.status === "in_progress" ? "in_progress" : "not_started",
    priority: fa.priority,
    needsAttention: fa.status !== "done" && isOverdue(fa.deadline, today),
  };
}

export function fromGoalNode(g: GoalNode, today: string): UnifiedActionItem {
  return {
    source: "goal", sourceId: g.id, title: g.title, detail: g.unit ? `Tracking ${g.unit}.` : "",
    owner: "", due: g.dueDate ?? "",
    status: g.status === "done" ? "done" : g.status === "not_started" ? "not_started" : "in_progress",
    priority: null,
    needsAttention: g.status === "at_risk" || (g.status !== "done" && isOverdue(g.dueDate, today)),
  };
}

export function fromDecision(d: Decision, today: string): UnifiedActionItem {
  return {
    source: "decision", sourceId: d.id, title: d.move || d.problem || "Decision", detail: d.reason,
    owner: d.owner, due: d.dueDate,
    status: d.status === "measured" ? "done" : "in_progress",
    priority: null,
    needsAttention: d.status === "open" && isOverdue(d.dueDate, today),
  };
}

export function fromAssumption(a: AssumptionEntry): UnifiedActionItem {
  const resolved = a.status === "confirmed" || a.status === "invalidated";
  return {
    source: "assumption", sourceId: a.id, title: a.text, detail: a.evidenceFor || a.evidenceAgainst || "",
    owner: a.owner ?? "", due: a.testByDate ?? "",
    status: resolved ? "done" : a.status === "untested" ? "not_started" : "in_progress",
    priority: null,
    // Mirrors summarizeAssumptions()'s own "overconfident"/"unreviewedInvalidated".
    needsAttention: (a.status === "untested" && a.confidence === "high") || (a.status === "invalidated" && !a.reviewedAt),
  };
}

export function fromExperiment(e: ExperimentEntry): UnifiedActionItem {
  return {
    source: "experiment", sourceId: e.id, title: e.hypothesis, detail: e.result ?? "",
    owner: e.owner ?? "", due: e.endDate ?? "",
    status: e.status === "planned" ? "not_started" : e.status === "running" ? "in_progress" : "done",
    priority: null,
    // Mirrors summarizeExperiments()'s own "awaitingDecision".
    needsAttention: e.status === "completed" && !e.decision,
  };
}

export interface ActionItemSources {
  forceActions?: readonly ForceActionItem[];
  goals?: readonly GoalNode[];
  decisions?: readonly Decision[];
  assumptions?: readonly AssumptionEntry[];
  experiments?: readonly ExperimentEntry[];
}

/** All 5 sources, converted and flattened into one list, in a stable
 *  source-then-original-order sequence. Callers filter/sort for their own
 *  purpose (e.g. Fix First keeps only `needsAttention` items) — this just
 *  normalizes the shape, it doesn't decide what's worth showing. */
export function collectActionItems(sources: ActionItemSources, today: string): UnifiedActionItem[] {
  const items: UnifiedActionItem[] = [];
  for (const fa of sources.forceActions ?? []) items.push(fromForceAction(fa, today));
  for (const g of sources.goals ?? []) items.push(fromGoalNode(g, today));
  for (const d of sources.decisions ?? []) items.push(fromDecision(d, today));
  for (const a of sources.assumptions ?? []) items.push(fromAssumption(a));
  for (const e of sources.experiments ?? []) items.push(fromExperiment(e));
  return items;
}
