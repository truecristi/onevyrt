import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeDriverSensitivity,
  PROFIT_DRIVER_KEYS,
  PROFIT_DRIVER_LABELS,
} from "../src/sensitivity.ts";

// $10,000 revenue, $6,000 cost -> $4,000 profit.
const baseline = { revenue: 1000000, cost: 600000 };

test("analyzeDriverSensitivity: ranks all five levers, biggest lift first", () => {
  const r = analyzeDriverSensitivity(baseline, 0.1);
  assert.equal(r.drivers.length, 5);
  assert.equal(r.testLift, 0.1);
  assert.equal(r.baselineProfit, 400000);
  // sorted descending by profitLift
  for (let i = 1; i < r.drivers.length; i++) {
    assert.ok(r.drivers[i - 1].profitLift >= r.drivers[i].profitLift);
  }
});

test("analyzeDriverSensitivity: non-leads levers beat leads because leads also lifts cost", () => {
  const r = analyzeDriverSensitivity(baseline, 0.1);
  // A 10% conversion lift adds all revenue, no cost: +100000 profit.
  // A 10% leads lift adds revenue but also 10% of cost (60000): +40000 profit.
  const leads = r.drivers.find((d) => d.driver === "leadsPct")!;
  const conversion = r.drivers.find((d) => d.driver === "conversionPct")!;
  assert.equal(conversion.profitLift, 100000);
  assert.equal(leads.profitLift, 40000);
  assert.ok(conversion.rank < leads.rank);
  assert.notEqual(r.topDriver, "leadsPct");
});

test("analyzeDriverSensitivity: shareOfTop is 1 for the winner and a fraction for the rest", () => {
  const r = analyzeDriverSensitivity(baseline, 0.1);
  assert.equal(r.drivers[0].shareOfTop, 1);
  const leads = r.drivers.find((d) => d.driver === "leadsPct")!;
  // 40000 / 100000 = 0.4
  assert.ok(Math.abs(leads.shareOfTop! - 0.4) < 1e-9);
});

test("analyzeDriverSensitivity: the four non-leads levers tie and share rank 1", () => {
  const r = analyzeDriverSensitivity(baseline, 0.1);
  const nonLeads = r.drivers.filter((d) => d.driver !== "leadsPct");
  // All four add pure revenue at the same 10% of $10,000 = +100000.
  for (const d of nonLeads) {
    assert.equal(d.profitLift, 100000);
    assert.equal(d.rank, 1);
  }
  // Competition ranking: after four rank-1 ties, leads lands at rank 5.
  const leads = r.drivers.find((d) => d.driver === "leadsPct")!;
  assert.equal(leads.rank, 5);
});

test("analyzeDriverSensitivity: a zero test lift yields no leverage and no top driver", () => {
  const r = analyzeDriverSensitivity(baseline, 0);
  assert.equal(r.topDriver, null);
  for (const d of r.drivers) {
    assert.equal(d.profitLift, 0);
    assert.equal(d.shareOfTop, null);
  }
});

test("analyzeDriverSensitivity: labels and keys stay in sync", () => {
  const r = analyzeDriverSensitivity(baseline, 0.1);
  assert.equal(PROFIT_DRIVER_KEYS.length, 5);
  for (const d of r.drivers) {
    assert.equal(d.label, PROFIT_DRIVER_LABELS[d.driver]);
  }
});

test("analyzeDriverSensitivity: default test lift is 10%", () => {
  const r = analyzeDriverSensitivity(baseline);
  assert.equal(r.testLift, 0.1);
});
