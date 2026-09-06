import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import type { Actuals } from "../src/actuals.ts";
import type { Decision } from "../src/loop.ts";
import { simulate } from "../src/simulate.ts";
import { buildReport } from "../src/report.ts";

const funnel: Funnel = {
  nodes: [
    { id: "fb", kind: "traffic", label: "Facebook Ads", visitors: 1000, costPerVisitor: 200 },
    { id: "lp", kind: "step", label: "Landing", passRate: 0.4 },
    { id: "sale", kind: "offer", label: "Core Offer", conversionRate: 0.1, price: 9700 },
  ],
  edges: [{ from: "fb", to: "lp", port: "out" }, { from: "lp", to: "sale", port: "out" }],
};

test("buildReport: assembles headline from plan + actuals", () => {
  const plan = simulate(funnel);
  const actuals: Actuals = { fb: { visitors: 1000, cost: 200000 }, sale: { buyers: 31, revenue: 300000 } };
  const r = buildReport("Q1 funnel", funnel, plan, actuals, [], "2026-01-01T00:00:00Z");
  assert.equal(r.name, "Q1 funnel");
  assert.equal(r.headline.planProfit, plan.totals.grossProfit); // 188000
  assert.equal(r.headline.actualProfit, 100000); // 300000 - 200000
  assert.ok(r.headline.correctedProfit !== null);
  assert.equal(r.headline.profitGap, r.headline.actualProfit! - r.headline.planProfit);
  assert.equal(r.labels.sale, "Core Offer");
  assert.ok(r.variance && r.calibration);
});

test("buildReport: biggest leak label resolved from node labels", () => {
  const plan = simulate(funnel);
  const r = buildReport("x", funnel, plan, { sale: { buyers: 20, revenue: 194000 } }, [], "t");
  assert.equal(r.headline.biggestLeakLabel, "Core Offer");
  assert.ok((r.headline.biggestLeakImpact ?? 0) < 0);
});

test("buildReport: no actuals -> variance/calibration null, actualProfit null", () => {
  const plan = simulate(funnel);
  const r = buildReport("x", funnel, plan, {}, [], "t");
  assert.equal(r.variance, null);
  assert.equal(r.calibration, null);
  assert.equal(r.headline.actualProfit, null);
  assert.equal(r.headline.correctedProfit, null);
});

test("buildReport: includes decision summary", () => {
  const plan = simulate(funnel);
  const decisions: Decision[] = [
    { id: "d1", createdAt: "t", problem: "p", hypothesis: "h", move: "m", reason: "r",
      expectedImpact: "+5", confidence: "high", owner: "o", dueDate: "2026-02-01", status: "open" },
  ];
  const r = buildReport("x", funnel, plan, {}, decisions, "t");
  assert.equal(r.decisions.summary.total, 1);
  assert.equal(r.decisions.summary.open, 1);
  assert.equal(r.decisions.items.length, 1);
});
