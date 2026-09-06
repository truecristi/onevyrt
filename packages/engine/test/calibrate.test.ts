import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import { simulate } from "../src/simulate.ts";
import { computeCalibration, applyProposals, correctedForecast } from "../src/calibrate.ts";

const funnel: Funnel = {
  nodes: [
    { id: "fb", kind: "traffic", label: "FB", visitors: 1000, costPerVisitor: 200 },
    { id: "lp", kind: "step", label: "Landing", passRate: 0.4 },
    { id: "sale", kind: "offer", label: "Offer", conversionRate: 0.1, price: 9700 },
  ],
  edges: [
    { from: "fb", to: "lp", port: "out" },
    { from: "lp", to: "sale", port: "out" },
  ],
};

test("back-solves the true conversion rate from actuals", () => {
  const plan = simulate(funnel); // offer inflow = 400
  const r = computeCalibration(funnel, plan, { sale: { buyers: 31 } });
  const conv = r.proposals.find((p) => p.field === "conversionRate")!;
  assert.equal(conv.planValue, 0.1);
  assert.ok(Math.abs(conv.proposedValue - 31 / 400) < 1e-9); // 0.0775
});

test("corrected forecast reproduces the observed buyers", () => {
  const plan = simulate(funnel);
  const r = computeCalibration(funnel, plan, { sale: { buyers: 31 } });
  const corrected = correctedForecast(funnel, r.proposals);
  assert.equal(corrected.nodes.sale.buyers, 31); // re-sim at true rate == observed
});

test("back-solves price from revenue / buyers", () => {
  const plan = simulate(funnel);
  const r = computeCalibration(funnel, plan, { sale: { buyers: 30, revenue: 300000 } });
  const price = r.proposals.find((p) => p.field === "price")!;
  assert.equal(price.proposedValue, 10000); // $100.00
});

test("back-solves cost per visitor from spend / visitors", () => {
  const plan = simulate(funnel);
  const r = computeCalibration(funnel, plan, { fb: { visitors: 1050, cost: 220500 } });
  const cpv = r.proposals.find((p) => p.field === "costPerVisitor")!;
  assert.equal(cpv.proposedValue, 210); // 220500 / 1050, differs from plan 200
  const vis = r.proposals.find((p) => p.field === "visitors")!;
  assert.equal(vis.proposedValue, 1050);
});

test("no proposal when actuals match plan or are absent", () => {
  const plan = simulate(funnel);
  assert.equal(computeCalibration(funnel, plan, {}).proposals.length, 0);
  // conversion already equals plan -> no conv proposal
  const exact = computeCalibration(funnel, plan, { sale: { buyers: 40 } });
  assert.equal(exact.proposals.some((p) => p.field === "conversionRate"), false);
});

test("applyProposals does not mutate the original funnel", () => {
  const plan = simulate(funnel);
  const r = computeCalibration(funnel, plan, { sale: { buyers: 31 } });
  applyProposals(funnel, r.proposals);
  const offer = funnel.nodes.find((n) => n.id === "sale")!;
  assert.equal((offer as { conversionRate: number }).conversionRate, 0.1); // unchanged
});
