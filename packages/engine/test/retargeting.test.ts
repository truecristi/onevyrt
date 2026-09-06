import test from "node:test";
import assert from "node:assert/strict";
import { simulateWithRetargeting, type RetargetingLoop } from "../src/retargeting.ts";
import { simulate } from "../src/simulate.ts";
import type { Funnel } from "../src/types.ts";

// traffic(1000 @ $2) -> split(yesRate 0.5) -> yes -> offer(conv 0.2 @ $100)
const funnel: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 200 },
    { id: "split", kind: "split", yesRate: 0.5 },
    { id: "o", kind: "offer", conversionRate: 0.2, price: 10000 },
  ],
  edges: [
    { from: "t", to: "split", port: "out" },
    { from: "split", to: "o", port: "yes" },
  ],
};

test("simulateWithRetargeting: no loops returns exactly the plain simulate() totals", () => {
  const r = simulateWithRetargeting(funnel, []);
  const plain = simulate(funnel);
  assert.deepEqual(r.totals, plain.totals);
  assert.equal(r.iterations, 0);
  assert.equal(r.truncated, false);
});

test("simulateWithRetargeting: a retargeting loop on the split's 'no' drop-offs increases buyers and revenue", () => {
  const loops: RetargetingLoop[] = [
    { id: "l1", fromNodeId: "split", fromPort: "no", toNodeId: "split", decayRate: 0.4 },
  ];
  const r = simulateWithRetargeting(funnel, loops);
  const base = simulate(funnel);
  assert.ok(r.totals.buyers > base.totals.buyers);
  assert.ok(r.totals.revenue > base.totals.revenue);
  assert.equal(r.totals.visitors, base.totals.visitors); // retargeting doesn't create new "unique" traffic
});

test("simulateWithRetargeting: converges to the exact closed-form geometric sum (the population system is linear)", () => {
  const decayRate = 0.4, noRate = 0.5, loopGain = decayRate * noRate; // 0.2 per round
  const loops: RetargetingLoop[] = [
    { id: "l1", fromNodeId: "split", fromPort: "no", toNodeId: "split", decayRate },
  ];
  const r = simulateWithRetargeting(funnel, loops, { epsilon: 1e-6, maxIterations: 100 });
  const base = simulate(funnel);

  const baseNoEmission = base.nodes.split.emissions.no ?? 0; // 500
  const firstInjection = baseNoEmission * decayRate; // 200
  const totalInjectedAcrossAllRounds = firstInjection / (1 - loopGain); // geometric series
  const expectedExtraBuyers = totalInjectedAcrossAllRounds * 0.5 * 0.2; // split.yes * conversionRate
  const expectedExtraRevenue = expectedExtraBuyers * 10000;

  assert.ok(Math.abs((r.totals.buyers - base.totals.buyers) - expectedExtraBuyers) < 0.01);
  assert.ok(Math.abs(r.totals.revenue - base.totals.revenue - expectedExtraRevenue) < 50); // rounding across many small passes
});

test("simulateWithRetargeting: stops early once the injected population decays below epsilon", () => {
  const loops: RetargetingLoop[] = [
    { id: "l1", fromNodeId: "split", fromPort: "no", toNodeId: "split", decayRate: 0.4 },
  ];
  const r = simulateWithRetargeting(funnel, loops, { epsilon: 0.01, maxIterations: 100 });
  assert.ok(r.iterations < 100, `expected early stop, got ${r.iterations} iterations`);
  assert.equal(r.truncated, false);
});

test("simulateWithRetargeting: flat expenses are counted once, not re-booked every pass", () => {
  // Same loop, run over two funnels that differ ONLY by flat operating expenses
  // (a per-node flat expenseAmount and a scenario-wide expenses.amount). Those
  // are fixed costs — recirculated traffic doesn't re-incur them — so the flat
  // total must appear exactly once (in the base pass), and the retargeting delta
  // cost must be identical with or without them. Before the fix, each delta pass
  // re-added the flat amounts, so `withFlat` cost grew by (iterations × flat).
  const NODE_FLAT = 3000, SCENARIO_FLAT = 5000, FLAT = NODE_FLAT + SCENARIO_FLAT;
  const withFlat: Funnel = {
    ...funnel,
    nodes: funnel.nodes.map((n) => (n.id === "o" ? { ...n, expenseAmount: NODE_FLAT } : n)),
    expenses: { amount: SCENARIO_FLAT },
  };
  const loops: RetargetingLoop[] = [
    { id: "l1", fromNodeId: "split", fromPort: "no", toNodeId: "split", decayRate: 0.4 },
  ];
  const rPlain = simulateWithRetargeting(funnel, loops, { epsilon: 1e-6, maxIterations: 100 });
  const rFlat = simulateWithRetargeting(withFlat, loops, { epsilon: 1e-6, maxIterations: 100 });
  const basePlain = simulate(funnel);
  const baseFlat = simulate(withFlat);

  // The flat cost shows up once in the base pass...
  assert.equal(baseFlat.totals.cost - basePlain.totals.cost, FLAT);
  // ...and STILL only once after many retargeting passes (not FLAT × iterations).
  assert.equal(rFlat.totals.cost - rPlain.totals.cost, FLAT);
  // Equivalently: the cost that retargeting itself adds is unaffected by flat expenses.
  assert.equal(rFlat.totals.cost - baseFlat.totals.cost, rPlain.totals.cost - basePlain.totals.cost);
  assert.ok(rFlat.iterations > 1, "sanity: the loop ran several passes");
});

test("simulateWithRetargeting: a slow-decaying loop hits maxIterations and reports truncated", () => {
  const loops: RetargetingLoop[] = [
    { id: "l1", fromNodeId: "split", fromPort: "no", toNodeId: "split", decayRate: 0.98 },
  ];
  const r = simulateWithRetargeting(funnel, loops, { epsilon: 0.0001, maxIterations: 3 });
  assert.equal(r.iterations, 3);
  assert.equal(r.truncated, true);
});

test("simulateWithRetargeting: multiple independent loops both contribute", () => {
  const branchy: Funnel = {
    nodes: [
      { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 200 },
      { id: "s1", kind: "split", yesRate: 0.5 },
      { id: "s2", kind: "split", yesRate: 0.5 },
      { id: "o", kind: "offer", conversionRate: 0.2, price: 10000 },
    ],
    edges: [
      { from: "t", to: "s1", port: "out" },
      { from: "s1", to: "s2", port: "yes" },
      { from: "s2", to: "o", port: "yes" },
    ],
  };
  const loops: RetargetingLoop[] = [
    { id: "l1", fromNodeId: "s1", fromPort: "no", toNodeId: "s1", decayRate: 0.3 },
    { id: "l2", fromNodeId: "s2", fromPort: "no", toNodeId: "s2", decayRate: 0.3 },
  ];
  const r = simulateWithRetargeting(branchy, loops);
  const base = simulate(branchy);
  assert.ok(r.totals.buyers > base.totals.buyers);
});
