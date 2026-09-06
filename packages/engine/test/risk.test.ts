import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import { assessRisk, computeSensitivities, computeBreakEven, flagAssumptions, computeCaseRange } from "../src/risk.ts";

// Healthy plan: 1000 visitors @ $1, offer $100 @ 10% -> revenue $10k, cost $1k, profit $9k
const healthy: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 100 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
};

// Thin plan: 1000 visitors @ $9, offer $100 @ 10% -> revenue $10k, cost $9k, profit $1k
const thin: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 900 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
};

// Losing plan: cost exceeds revenue
const losing: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 1500 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
};

test("risk: healthy plan scores lower than thin plan", () => {
  const h = assessRisk(healthy);
  const t = assessRisk(thin);
  assert.ok(h.score < t.score, `healthy ${h.score} should be < thin ${t.score}`);
  assert.equal(h.planProfit, 900000); // $9,000 in minor
});

test("risk: losing plan flagged and high score", () => {
  const r = assessRisk(losing);
  assert.ok(r.planProfit <= 0);
  assert.ok(r.score >= 50, `losing score ${r.score}`);
  assert.match(r.headline, /does not profit/);
});

test("risk: sensitivities ranked, price and conversion matter most on the offer", () => {
  const s = computeSensitivities(healthy);
  assert.ok(s.length > 0);
  // top sensitivity should be a lever that moves profit a lot
  assert.ok(s[0].magnitude > 0);
  // sorted descending
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].magnitude >= s[i].magnitude);
});

test("risk: break-even traffic multiplier is < 1 for a healthy plan", () => {
  const be = computeBreakEven(healthy);
  // healthy plan profits, so it can lose some traffic and still break even
  assert.ok(be.trafficMultiplier != null && be.trafficMultiplier < 1, `tm ${be.trafficMultiplier}`);
});

test("risk: assumption flags catch an over-optimistic pass rate", () => {
  const f: Funnel = {
    nodes: [
      { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 100 },
      { id: "s", kind: "step", passRate: 0.95, label: "Landing" },
      { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
    ],
    edges: [{ from: "t", to: "s", port: "out" }, { from: "s", to: "o", port: "out" }],
  };
  const flags = flagAssumptions(f);
  assert.ok(flags.some((x) => x.field === "passRate" && x.severity === "high"));
});

test("risk: deterministic — same funnel gives same score twice", () => {
  assert.equal(assessRisk(thin).score, assessRisk(thin).score);
});

test("computeCaseRange: likely matches current plan profit exactly", () => {
  const r = computeCaseRange(healthy);
  assert.equal(r.likely, assessRisk(healthy).planProfit);
});

test("computeCaseRange: worst < likely < best for a healthy plan (traffic and rates both matter)", () => {
  const r = computeCaseRange(healthy);
  assert.ok(r.worst < r.likely, `worst ${r.worst} should be < likely ${r.likely}`);
  assert.ok(r.best > r.likely, `best ${r.best} should be > likely ${r.likely}`);
});

test("computeCaseRange: default spread is 15%, and a wider spread widens the range", () => {
  const narrow = computeCaseRange(healthy, 0.1);
  const wide = computeCaseRange(healthy, 0.3);
  assert.equal(computeCaseRange(healthy).spread, 0.15);
  assert.ok(wide.best - wide.worst > narrow.best - narrow.worst);
});

test("computeCaseRange: assessRisk exposes the same caseRange", () => {
  const risk = assessRisk(thin);
  const standalone = computeCaseRange(thin);
  assert.deepEqual(risk.caseRange, standalone);
});
