import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import {
  evaluateConstraints, filterViable,
  type Constraint, type BudgetCapConstraint, type CapacityLimitConstraint,
  type RateLimitConstraint, type MinThresholdConstraint,
} from "../src/constraints.ts";

// Healthy plan: 1000 visitors @ $1, offer $100 @ 10% -> revenue $10k, cost $1k, profit $9k
const healthy: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 100 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
};

test("constraints: budget cap satisfied when spend is under the limit", () => {
  const c: BudgetCapConstraint = { id: "b1", kind: "budget_cap", limitMinor: 200000 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.allSatisfied, true);
  assert.equal(r.results[0].actual, 100000);
  assert.ok(r.results[0].margin > 0);
});

test("constraints: budget cap violated when spend exceeds the limit", () => {
  const c: BudgetCapConstraint = { id: "b1", kind: "budget_cap", limitMinor: 50000 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.allSatisfied, false);
  assert.equal(r.violated.length, 1);
  assert.equal(r.results[0].severity, "violated");
});

test("constraints: budget cap near the limit is flagged as a warning", () => {
  const c: BudgetCapConstraint = { id: "b1", kind: "budget_cap", limitMinor: 105000 }; // 100000 actual, 5% headroom
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.results[0].satisfied, true);
  assert.equal(r.results[0].severity, "warning");
});

test("constraints: capacity limit checks a node's inflow", () => {
  const c: CapacityLimitConstraint = { id: "c1", kind: "capacity_limit", nodeId: "o", maxUnits: 500 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.results[0].actual, 1000);
  assert.equal(r.results[0].satisfied, false);
});

test("constraints: capacity limit satisfied with enough headroom", () => {
  const c: CapacityLimitConstraint = { id: "c1", kind: "capacity_limit", nodeId: "o", maxUnits: 5000 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.results[0].satisfied, true);
});

test("constraints: rate limit checks traffic source volume", () => {
  const c: RateLimitConstraint = { id: "r1", kind: "rate_limit", nodeId: "t", maxVisitors: 800 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.results[0].satisfied, false);
  assert.equal(r.results[0].actual, 1000);
});

test("constraints: min_threshold caps CPA from above", () => {
  // buyers = 100, cost = 100000 -> cpa = 1000 (minor units, $10)
  const c: MinThresholdConstraint = { id: "m1", kind: "min_threshold", metric: "cpa", direction: "under", value: 1500 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.results[0].satisfied, true);
  const tight: MinThresholdConstraint = { id: "m2", kind: "min_threshold", metric: "cpa", direction: "under", value: 500 };
  const rTight = evaluateConstraints(healthy, [tight]);
  assert.equal(rTight.results[0].satisfied, false);
});

test("constraints: min_threshold floors ROAS from below", () => {
  // revenue 1,000,000 / cost 100,000 = roas 10
  const c: MinThresholdConstraint = { id: "m3", kind: "min_threshold", metric: "roas", direction: "over", value: 0.5 };
  const r = evaluateConstraints(healthy, [c]);
  assert.equal(r.results[0].satisfied, true);
  const tooHigh: MinThresholdConstraint = { id: "m4", kind: "min_threshold", metric: "roas", direction: "over", value: 20 };
  const rHigh = evaluateConstraints(healthy, [tooHigh]);
  assert.equal(rHigh.results[0].satisfied, false);
});

test("constraints: worstSeverity reflects the worst single result", () => {
  const cs: Constraint[] = [
    { id: "b1", kind: "budget_cap", limitMinor: 200000 },
    { id: "b2", kind: "budget_cap", limitMinor: 10000 },
  ];
  const r = evaluateConstraints(healthy, cs);
  assert.equal(r.worstSeverity, "violated");
});

test("constraints: empty constraint list is trivially satisfied", () => {
  const r = evaluateConstraints(healthy, []);
  assert.equal(r.allSatisfied, true);
  assert.equal(r.results.length, 0);
});

test("constraints: filterViable keeps only funnels passing every constraint", () => {
  const roomy: Funnel = { ...healthy, nodes: healthy.nodes.map((n) => n.id === "t" ? { ...n, visitors: 100 } : n) };
  const cs: Constraint[] = [{ id: "r1", kind: "rate_limit", nodeId: "t", maxVisitors: 500 }];
  const kept = filterViable([healthy, roomy], cs);
  assert.equal(kept.length, 1);
  assert.equal(kept[0], roomy);
});

test("constraints: filterViable returns all candidates when there are no constraints", () => {
  const kept = filterViable([healthy, healthy], []);
  assert.equal(kept.length, 2);
});

test("constraints: deterministic — same funnel and constraints give the same report twice", () => {
  const c: Constraint[] = [{ id: "b1", kind: "budget_cap", limitMinor: 150000 }];
  const a = evaluateConstraints(healthy, c);
  const b = evaluateConstraints(healthy, c);
  assert.deepEqual(a, b);
});
