import test from "node:test";
import assert from "node:assert/strict";
import type { SimulationResult } from "../src/types.ts";
import type { Actuals } from "../src/actuals.ts";
import { computeVariance } from "../src/variance.ts";

const plan: SimulationResult = {
  nodes: {
    fb:   { id: "fb",   kind: "traffic", inflow: 0,   emissions: { out: 1000 }, buyers: 0,  revenue: 0,      cost: 200000 },
    land: { id: "land", kind: "step",    inflow: 1000, emissions: { out: 400 },  buyers: 0,  revenue: 0,      cost: 0 },
    sale: { id: "sale", kind: "offer",   inflow: 400, emissions: {},            buyers: 40, revenue: 388000, cost: 0 },
  },
  order: ["fb", "land", "sale"],
  totals: { visitors: 1000, buyers: 40, revenue: 388000, cost: 200000, grossProfit: 188000 },
};

test("computeVariance: attributes leaks with $ and %", () => {
  const actuals: Actuals = {
    fb:   { visitors: 950, cost: 210000 },  // spent $100 over plan -> leak
    sale: { buyers: 31, revenue: 300000 },  // revenue $880 under plan -> leak
  };
  const r = computeVariance(plan, actuals);
  const fb = r.nodes.find((n) => n.nodeId === "fb")!;
  const sale = r.nodes.find((n) => n.nodeId === "sale")!;

  assert.equal(fb.metric, "cost");
  assert.equal(fb.moneyDelta, 10000);       // actual - plan cost
  assert.equal(fb.profitImpact, -10000);    // overspend hurts profit
  assert.equal(fb.leak, true);
  assert.ok(Math.abs(fb.pctOffPlan! - 0.05) < 1e-9); // 5% over

  assert.equal(sale.metric, "revenue");
  assert.equal(sale.moneyDelta, -88000);
  assert.equal(sale.profitImpact, -88000);
  assert.equal(sale.leak, true);
});

test("computeVariance: with no offer costs, impacts sum to the gap and nothing is unexplained", () => {
  const actuals: Actuals = { fb: { cost: 210000 }, sale: { revenue: 300000 } };
  const r = computeVariance(plan, actuals);
  const sum = r.nodes.reduce((s, n) => s + n.profitImpact, 0);
  assert.equal(sum, r.profitGap);
  assert.equal(r.profitGap, r.actualProfit - r.planProfit);
  assert.equal(r.profitGap, -98000);
  assert.equal(r.unexplained, 0); // offer cost is 0 here, so node impacts fully explain the gap
});

test("computeVariance: an offer's variable cost surfaces as `unexplained`, so it still reconciles", () => {
  // Same funnel but the offer carries $880 of plan variable cost (COGS/fees).
  // Actuals record only offer revenue and traffic cost, so that cost can't be
  // attributed per node — it must show up in `unexplained`, and
  // Σ impacts + unexplained must always equal the profit gap.
  const planWithCost: SimulationResult = {
    ...plan,
    nodes: { ...plan.nodes, sale: { ...plan.nodes.sale, cost: 88000 } },
    totals: { ...plan.totals, cost: 288000, grossProfit: 100000 }, // 388000 rev - 200000 traffic - 88000 offer
  };
  const actuals: Actuals = { fb: { cost: 210000 }, sale: { revenue: 300000 } };
  const r = computeVariance(planWithCost, actuals);
  const sum = r.nodes.reduce((s, n) => s + n.profitImpact, 0);

  assert.equal(r.profitGap, -10000);            // 90000 actual - 100000 plan
  assert.equal(sum, -98000);                    // node impacts alone
  assert.equal(r.unexplained, 88000);           // the offer's plan cost, unattributable
  assert.equal(sum + r.unexplained, r.profitGap); // the honest reconciliation always holds
});

test("computeVariance: biggest leak is the worst node", () => {
  const actuals: Actuals = { fb: { cost: 210000 }, sale: { revenue: 300000 } };
  const r = computeVariance(plan, actuals);
  assert.equal(r.biggestLeak?.nodeId, "sale"); // -88000 worse than -10000
  assert.equal(r.ranked[0].nodeId, "sale");
  assert.equal(r.ranked[1].nodeId, "fb");
});

test("computeVariance: gains are not leaks; no biggest leak when all beat plan", () => {
  const actuals: Actuals = { fb: { cost: 180000 }, sale: { revenue: 420000 } };
  const r = computeVariance(plan, actuals);
  assert.equal(r.nodes.every((n) => !n.leak), true);
  assert.equal(r.biggestLeak, null);
  assert.ok(r.profitGap > 0);
});

test("computeVariance: pctOffPlan null when plan value is 0", () => {
  const zeroPlan: SimulationResult = {
    ...plan,
    nodes: { ...plan.nodes, sale: { ...plan.nodes.sale, revenue: 0 } },
    totals: { ...plan.totals, revenue: 0, grossProfit: -200000 },
  };
  const r = computeVariance(zeroPlan, { sale: { revenue: 5000 } });
  assert.equal(r.nodes[0].pctOffPlan, null);
});
