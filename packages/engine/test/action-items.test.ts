import test from "node:test";
import assert from "node:assert/strict";
import {
  isOverdue, fromForceAction, fromGoalNode, fromDecision, fromAssumption, fromExperiment, collectActionItems,
} from "../src/action-items.ts";
import type { ForceActionItem } from "../src/program.ts";
import type { GoalNode } from "../src/goals.ts";
import type { Decision } from "../src/loop.ts";
import type { AssumptionEntry } from "../src/assumptions.ts";
import type { ExperimentEntry } from "../src/experiments.ts";

/**
 * The canonical per-project action-item adapter (resolves the roadmap
 * doc's "one action-plan system" cross-cutting question as a read-only
 * view, not a data migration). Covers: each adapter's field mapping and
 * status normalization, and — the part that actually matters, since it's
 * what apps/web/app/funnel-studio.tsx's Fix First list now depends on —
 * that `needsAttention` reuses exactly the same conditions each source
 * type's own summarize*() functions already treat as "worth surfacing",
 * never a new heuristic.
 */

const TODAY = "2026-06-15";

function forceAction(over: Partial<ForceActionItem>): ForceActionItem {
  return { id: "fa1", force: 1, principle: "Know your numbers", actionItem: "Ship the pricing page", status: "open", priority: "medium", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}
function goalNode(over: Partial<GoalNode>): GoalNode {
  return { id: "g1", level: "action", title: "Hit 50k MRR", status: "not_started", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}
function decision(over: Partial<Decision>): Decision {
  return { id: "d1", createdAt: "2026-01-01T00:00:00.000Z", problem: "Churn is up", hypothesis: "Onboarding is confusing", move: "Rebuild the welcome flow", reason: "Support tickets spiked", expectedImpact: "-2% churn", confidence: "medium", owner: "Sam", dueDate: "2026-06-01", status: "open", ...over };
}
function assumption(over: Partial<AssumptionEntry>): AssumptionEntry {
  return { id: "a1", text: "Buyers care most about speed", confidence: "medium", status: "untested", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}
function experiment(over: Partial<ExperimentEntry>): ExperimentEntry {
  return { id: "e1", hypothesis: "A shorter form lifts conversion", status: "planned", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}

test("isOverdue: true only when a due date exists and is strictly before today", () => {
  assert.equal(isOverdue("2026-06-14", TODAY), true);
  assert.equal(isOverdue("2026-06-15", TODAY), false, "due today is not yet overdue");
  assert.equal(isOverdue("2026-06-16", TODAY), false);
  assert.equal(isOverdue(undefined, TODAY), false);
  assert.equal(isOverdue("", TODAY), false);
});

test("fromForceAction: maps fields, normalizes status, and carries the real priority through", () => {
  const item = fromForceAction(forceAction({ owner: "Jess", deadline: "2026-05-01", priority: "high" }), TODAY);
  assert.equal(item.source, "forceAction");
  assert.equal(item.sourceId, "fa1");
  assert.equal(item.title, "Ship the pricing page");
  assert.equal(item.owner, "Jess");
  assert.equal(item.due, "2026-05-01");
  assert.equal(item.priority, "high");
});

test("fromForceAction: needsAttention only when overdue AND not done", () => {
  assert.equal(fromForceAction(forceAction({ status: "open", deadline: "2026-05-01" }), TODAY).needsAttention, true);
  assert.equal(fromForceAction(forceAction({ status: "in_progress", deadline: "2026-05-01" }), TODAY).needsAttention, true);
  assert.equal(fromForceAction(forceAction({ status: "done", deadline: "2026-05-01" }), TODAY).needsAttention, false, "a done item is never flagged, however overdue its deadline was");
  assert.equal(fromForceAction(forceAction({ status: "open", deadline: "2026-07-01" }), TODAY).needsAttention, false, "not overdue yet");
  assert.equal(fromForceAction(forceAction({ status: "open" }), TODAY).needsAttention, false, "no deadline at all");
});

test("fromForceAction: status normalizes to the shared 3-state vocabulary, no owner/priority defaults to empty/carried-null", () => {
  assert.equal(fromForceAction(forceAction({ status: "open" }), TODAY).status, "not_started");
  assert.equal(fromForceAction(forceAction({ status: "in_progress" }), TODAY).status, "in_progress");
  assert.equal(fromForceAction(forceAction({ status: "done" }), TODAY).status, "done");
  const noOwner = fromForceAction(forceAction({ owner: undefined }), TODAY);
  assert.equal(noOwner.owner, "");
});

test("fromGoalNode: needsAttention on at-risk status, independent of any due date", () => {
  assert.equal(fromGoalNode(goalNode({ status: "at_risk" }), TODAY).needsAttention, true);
  assert.equal(fromGoalNode(goalNode({ status: "on_track" }), TODAY).needsAttention, false);
});

test("fromGoalNode: needsAttention on an overdue, not-yet-done goal too — not just at-risk", () => {
  assert.equal(fromGoalNode(goalNode({ status: "on_track", dueDate: "2026-01-01" }), TODAY).needsAttention, true);
  assert.equal(fromGoalNode(goalNode({ status: "done", dueDate: "2026-01-01" }), TODAY).needsAttention, false, "done overrides an overdue date");
});

test("fromGoalNode: has no owner concept — always empty, unlike ForceActionItem", () => {
  assert.equal(fromGoalNode(goalNode({}), TODAY).owner, "");
  assert.equal(fromGoalNode(goalNode({}), TODAY).priority, null, "GoalNode has no priority field to carry through");
});

test("fromDecision: title prefers 'move', falls back to 'problem' when move is blank; owner/due are always present (both required on Decision)", () => {
  assert.equal(fromDecision(decision({ move: "Rebuild the flow" }), TODAY).title, "Rebuild the flow");
  assert.equal(fromDecision(decision({ move: "" }), TODAY).title, "Churn is up", "falls back to problem");
  const item = fromDecision(decision({ owner: "Priya", dueDate: "2026-04-01" }), TODAY);
  assert.equal(item.owner, "Priya");
  assert.equal(item.due, "2026-04-01");
});

test("fromDecision: needsAttention only when open AND overdue; measured maps to done", () => {
  assert.equal(fromDecision(decision({ status: "open", dueDate: "2026-01-01" }), TODAY).needsAttention, true);
  assert.equal(fromDecision(decision({ status: "measured", dueDate: "2026-01-01" }), TODAY).needsAttention, false, "a measured decision is resolved, however late it was measured");
  assert.equal(fromDecision(decision({ status: "measured" }), TODAY).status, "done");
  assert.equal(fromDecision(decision({ status: "open" }), TODAY).status, "in_progress");
});

test("fromAssumption: needsAttention mirrors summarizeAssumptions()'s own 'overconfident' signal — untested + high confidence", () => {
  assert.equal(fromAssumption(assumption({ status: "untested", confidence: "high" })).needsAttention, true);
  assert.equal(fromAssumption(assumption({ status: "untested", confidence: "medium" })).needsAttention, false, "untested but not high-confidence is not 'overconfident'");
  assert.equal(fromAssumption(assumption({ status: "untested", confidence: "low" })).needsAttention, false);
});

test("fromAssumption: needsAttention mirrors summarizeAssumptions()'s own 'unreviewedInvalidated' signal", () => {
  assert.equal(fromAssumption(assumption({ status: "invalidated", reviewedAt: undefined })).needsAttention, true);
  assert.equal(fromAssumption(assumption({ status: "invalidated", reviewedAt: "2026-02-01T00:00:00.000Z" })).needsAttention, false, "already reviewed");
});

test("fromAssumption: confirmed and invalidated both count as resolved ('done'), untested as not_started, testing as in_progress", () => {
  assert.equal(fromAssumption(assumption({ status: "confirmed" })).status, "done");
  assert.equal(fromAssumption(assumption({ status: "invalidated", reviewedAt: "2026-02-01T00:00:00.000Z" })).status, "done");
  assert.equal(fromAssumption(assumption({ status: "untested" })).status, "not_started");
  assert.equal(fromAssumption(assumption({ status: "testing" })).status, "in_progress");
});

test("fromExperiment: needsAttention mirrors summarizeExperiments()'s own 'awaitingDecision' signal", () => {
  assert.equal(fromExperiment(experiment({ status: "completed", decision: undefined })).needsAttention, true);
  assert.equal(fromExperiment(experiment({ status: "completed", decision: "adopt" })).needsAttention, false, "a logged decision resolves it");
  assert.equal(fromExperiment(experiment({ status: "running" })).needsAttention, false, "not completed yet");
});

test("fromExperiment: status normalizes planned/running to not_started/in_progress; completed AND abandoned both map to done", () => {
  assert.equal(fromExperiment(experiment({ status: "planned" })).status, "not_started");
  assert.equal(fromExperiment(experiment({ status: "running" })).status, "in_progress");
  assert.equal(fromExperiment(experiment({ status: "completed" })).status, "done");
  assert.equal(fromExperiment(experiment({ status: "abandoned" })).status, "done");
});

test("collectActionItems: flattens all 5 sources in order, and tolerates any source being omitted", () => {
  const items = collectActionItems({
    forceActions: [forceAction({ id: "fa1" })],
    goals: [goalNode({ id: "g1" })],
    decisions: [decision({ id: "d1" })],
    assumptions: [assumption({ id: "a1" })],
    experiments: [experiment({ id: "e1" })],
  }, TODAY);
  assert.deepEqual(items.map((i) => i.source), ["forceAction", "goal", "decision", "assumption", "experiment"]);
  assert.deepEqual(items.map((i) => i.sourceId), ["fa1", "g1", "d1", "a1", "e1"]);
});

test("collectActionItems: an empty/omitted source set returns an empty list, never throws", () => {
  assert.deepEqual(collectActionItems({}, TODAY), []);
});
