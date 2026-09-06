import test from "node:test";
import assert from "node:assert/strict";
import { buildDecidePhaseSummary, pickHighestLeverageAction, pickFastestCashImprovement } from "../src/decide.ts";
import type { ForceActionItem } from "../src/program.ts";
import type { RiskReport } from "../src/risk.ts";
import type { VarianceReport } from "../src/variance.ts";

function action(over: Partial<ForceActionItem>): ForceActionItem {
  return { id: "a", force: 1, principle: "p", actionItem: "Do the thing", status: "open", priority: "medium", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}

test("pickHighestLeverageAction: picks the highest confidence-weighted dollar value among open items", () => {
  const items = [
    action({ id: "a1", dollarValue: 100000, confidence: "low" }),   // 40000
    action({ id: "a2", dollarValue: 80000, confidence: "high" }),   // 80000
    action({ id: "a3", dollarValue: 90000, confidence: "medium" }), // 63000
  ];
  const picked = pickHighestLeverageAction(items);
  assert.equal(picked?.id, "a2");
});

test("pickHighestLeverageAction: ignores done items and items with no dollar value", () => {
  const items = [
    action({ id: "a1", dollarValue: 100000, status: "done" }),
    action({ id: "a2" }), // no dollarValue
  ];
  assert.equal(pickHighestLeverageAction(items), null);
});

test("pickFastestCashImprovement: picks the nearest deadline among actionable items with a dollar value", () => {
  const items = [
    action({ id: "a1", dollarValue: 50000, deadline: "2026-06-01" }),
    action({ id: "a2", dollarValue: 20000, deadline: "2026-02-01" }),
    action({ id: "a3", dollarValue: 90000 }), // no deadline, excluded
  ];
  const picked = pickFastestCashImprovement(items);
  assert.equal(picked?.id, "a2");
});

test("buildDecidePhaseSummary: prefers a measured variance leak over a modeled sensitivity", () => {
  const variance = { nodes: [], planProfit: 0, actualProfit: 0, profitGap: -500, biggestLeak: { nodeId: "checkout", kind: "offer", metric: "revenue", plan: 1000, actual: 500, moneyDelta: -500, profitImpact: -500, pctOffPlan: -0.5, leak: true }, ranked: [] } as unknown as VarianceReport;
  const risk = { score: 40, band: "moderate", planProfit: 1000, margin: 0.5, breakEven: { trafficMultiplier: null, conversionMultiplier: null, planProfit: 1000 }, sensitivities: [{ nodeId: "traffic", label: "Facebook Ads", field: "visitors", deltaProfitUp: 100, deltaProfitDown: -100, magnitude: 100 }], assumptions: [], caseRange: { worst: 0, likely: 1000, best: 2000, spread: 0.1 }, headline: "Fragile: one lever swings most of the profit." } as RiskReport;

  const summary = buildDecidePhaseSummary([], risk, variance);
  assert.equal(summary.biggestBottleneck?.source, "measured");
  assert.equal(summary.biggestBottleneck?.label, "checkout");
  assert.equal(summary.biggestRisk, "Fragile: one lever swings most of the profit.");
});

test("buildDecidePhaseSummary: falls back to a modeled sensitivity when there's no variance data yet", () => {
  const risk = { score: 40, band: "moderate", planProfit: 1000, margin: 0.5, breakEven: { trafficMultiplier: null, conversionMultiplier: null, planProfit: 1000 }, sensitivities: [{ nodeId: "traffic", label: "Facebook Ads", field: "visitors", deltaProfitUp: 100, deltaProfitDown: -100, magnitude: 100 }], assumptions: [], caseRange: { worst: 0, likely: 1000, best: 2000, spread: 0.1 }, headline: "headline" } as RiskReport;
  const summary = buildDecidePhaseSummary([], risk, null);
  assert.equal(summary.biggestBottleneck?.source, "modeled");
  assert.equal(summary.biggestBottleneck?.label, "Facebook Ads");
});

test("buildDecidePhaseSummary: with nothing at all, says so plainly instead of fabricating a recommendation", () => {
  const summary = buildDecidePhaseSummary([], null, null);
  assert.equal(summary.highestLeverageAction, null);
  assert.equal(summary.biggestBottleneck, null);
  assert.match(summary.decisionSummary, /Not enough data yet/);
});
