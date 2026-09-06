import test from "node:test";
import assert from "node:assert/strict";
import { computeReadiness } from "../src/readiness.ts";
import type { GoalNode } from "../src/goals.ts";
import type { AssumptionEntry } from "../src/assumptions.ts";
import type { ExperimentEntry } from "../src/experiments.ts";

function goal(over: Partial<GoalNode>): GoalNode {
  return { id: "g", level: "vision", title: "t", status: "not_started", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}
function assumption(over: Partial<AssumptionEntry>): AssumptionEntry {
  return { id: "a", text: "t", confidence: "medium", status: "untested", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}
function experiment(over: Partial<ExperimentEntry>): ExperimentEntry {
  return { id: "e", hypothesis: "h", status: "planned", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}

test("computeReadiness: no data anywhere returns null score, not zero, and no gaps (nothing's started, not 'missing')", () => {
  const r = computeReadiness([], [], []);
  assert.equal(r.score, null);
  assert.equal(r.label, "no_data");
  assert.deepEqual(r.topIssues, []);
  assert.deepEqual(r.gaps, []);
});

test("computeReadiness: all goals done, no assumptions/experiments logged yet — scores only what exists and flags the two empty registers as gaps", () => {
  const r = computeReadiness([goal({ id: "1", status: "done" })], [], []);
  assert.equal(r.goalsScore, 100);
  assert.equal(r.assumptionsScore, null);
  assert.equal(r.experimentsScore, null);
  assert.equal(r.score, 100);
  assert.equal(r.label, "strong");
  assert.equal(r.gaps.length, 2);
  assert.ok(r.gaps.some((g) => g.includes("No assumptions")));
  assert.ok(r.gaps.some((g) => g.includes("No experiments")));
});

test("computeReadiness: an at-risk root goal drags the score down and shows up as a top issue", () => {
  const r = computeReadiness([goal({ id: "1", status: "at_risk" })], [], []);
  assert.equal(r.goalsScore, 0);
  assert.equal(r.score, 0);
  assert.equal(r.label, "fragile");
  assert.ok(r.topIssues.some((s) => s.includes("at risk")));
});

test("computeReadiness: overconfident and unreviewed-invalidated assumptions penalize assumptionsScore", () => {
  const r = computeReadiness(
    [],
    [
      assumption({ id: "1", confidence: "high", status: "untested" }),
      assumption({ id: "2", status: "invalidated" }),
    ],
    [],
  );
  assert.equal(r.assumptionsScore, 100 - 15 - 20);
  assert.equal(r.topIssues.length, 2);
});

test("computeReadiness: a completed experiment with no decision penalizes experimentsScore", () => {
  const r = computeReadiness([], [], [experiment({ id: "1", status: "completed" })]);
  assert.equal(r.experimentsScore, 80);
  assert.ok(r.topIssues.some((s) => s.includes("no decision recorded")));
});

test("computeReadiness: a fully healthy plan across all three registers scores strong with no issues", () => {
  const r = computeReadiness(
    [goal({ id: "1", status: "done" })],
    [assumption({ id: "1", confidence: "high", status: "confirmed" })],
    [experiment({ id: "1", status: "completed", decision: "adopt" })],
  );
  assert.equal(r.score, 100);
  assert.equal(r.label, "strong");
  assert.deepEqual(r.topIssues, []);
  assert.deepEqual(r.gaps, []);
});
