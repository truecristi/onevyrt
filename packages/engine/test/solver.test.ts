import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import { simulate } from "../src/simulate.ts";
import { solveGoal } from "../src/solver.ts";

// 1000 visitors, $0 cost, offer $100 @ conv -> profit = conv*1000*$100
const funnel: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
};

test("solveGoal: finds conversion rate to hit a profit target", () => {
  // want $2,000 profit: $2,000 / $100 = 20 buyers / 1000 visitors = conv 0.02
  const r = solveGoal(funnel, { metric: "grossProfit", value: 200000 }, { nodeId: "o", field: "conversionRate", min: 0, max: 1 });
  assert.equal(r.reachable, true);
  assert.ok(Math.abs(r.leverValue - 0.02) < 1e-3, `got ${r.leverValue}`);
  assert.ok(Math.abs(r.achieved - 200000) < 100);
});

test("solveGoal: finds visitors to hit a buyers target", () => {
  // buyers = visitors * 0.1; want 50 buyers -> 500 visitors
  const r = solveGoal(funnel, { metric: "buyers", value: 50 }, { nodeId: "t", field: "visitors", min: 0, max: 100000 });
  assert.equal(r.reachable, true);
  assert.ok(Math.abs(r.leverValue - 500) < 1, `got ${r.leverValue}`);
});

test("solveGoal: unreachable target within bounds is flagged", () => {
  // max conv 0.5 -> max profit $5,000; target $99,999 impossible
  const r = solveGoal(funnel, { metric: "grossProfit", value: 9999900 }, { nodeId: "o", field: "conversionRate", min: 0, max: 0.5 });
  assert.equal(r.reachable, false);
  assert.ok(Math.abs(r.leverValue - 0.5) < 1e-9); // closest bound is the max
});

test("solveGoal: does not mutate the base funnel", () => {
  const before = JSON.stringify(funnel);
  solveGoal(funnel, { metric: "revenue", value: 500000 }, { nodeId: "o", field: "price", min: 0, max: 100000 });
  assert.equal(JSON.stringify(funnel), before);
});

test("solveGoal: solves price to hit a revenue target", () => {
  // 100 buyers; want $30,000 revenue -> price $300
  const r = solveGoal(funnel, { metric: "revenue", value: 3000000 }, { nodeId: "o", field: "price", min: 0, max: 100000 });
  assert.equal(r.reachable, true);
  assert.ok(Math.abs(r.leverValue - 30000) < 50, `got ${r.leverValue}`);
});
