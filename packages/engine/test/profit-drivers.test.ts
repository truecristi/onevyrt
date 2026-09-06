import test from "node:test";
import assert from "node:assert/strict";
import { simulateProfitDrivers, DEFAULT_PROFIT_DRIVER_INPUTS, type ProfitDriverInputs } from "../src/profit-drivers.ts";

const baseline = { revenue: 1000000, cost: 600000 }; // $10,000 revenue, $6,000 cost -> $4,000 profit

test("simulateProfitDrivers: zero improvements leave baseline unchanged", () => {
  const r = simulateProfitDrivers(baseline, DEFAULT_PROFIT_DRIVER_INPUTS);
  assert.equal(r.compoundMultiplier, 1);
  assert.equal(r.improved.revenue, baseline.revenue);
  assert.equal(r.improved.cost, baseline.cost);
  assert.equal(r.profitLift, 0);
  assert.equal(r.profitLiftPct, 0);
});

test("simulateProfitDrivers: a single 10% lever multiplies revenue by 1.1", () => {
  const inputs: ProfitDriverInputs = { ...DEFAULT_PROFIT_DRIVER_INPUTS, conversionPct: 0.1 };
  const r = simulateProfitDrivers(baseline, inputs);
  assert.equal(r.compoundMultiplier, 1.1);
  assert.equal(r.improved.revenue, 1100000);
  assert.equal(r.improved.cost, baseline.cost); // conversion doesn't touch traffic cost
});

test("simulateProfitDrivers: five 10% levers compound multiplicatively, not additively", () => {
  const inputs: ProfitDriverInputs = { leadsPct: 0.1, salesProcessPct: 0.1, conversionPct: 0.1, transactionValuePct: 0.1, retentionPct: 0.1 };
  const r = simulateProfitDrivers(baseline, inputs);
  assert.ok(Math.abs(r.compoundMultiplier - 1.61051) < 1e-9); // 1.1^5, not 1.5
});

test("simulateProfitDrivers: leads lift scales traffic cost proportionally", () => {
  const inputs: ProfitDriverInputs = { ...DEFAULT_PROFIT_DRIVER_INPUTS, leadsPct: 0.2 };
  const r = simulateProfitDrivers(baseline, inputs);
  assert.equal(r.improved.cost, 720000); // 600000 * 1.2
  assert.equal(r.improved.revenue, 1200000);
});

test("simulateProfitDrivers: profitLiftPct is null when baseline profit is exactly zero", () => {
  const r = simulateProfitDrivers({ revenue: 500000, cost: 500000 }, { ...DEFAULT_PROFIT_DRIVER_INPUTS, conversionPct: 0.1 });
  assert.equal(r.profitBaseline, 0);
  assert.equal(r.profitLiftPct, null);
});

test("simulateProfitDrivers: negative baseline profit still computes a sensible lift", () => {
  const losing = { revenue: 400000, cost: 600000 }; // -$2,000 profit
  const r = simulateProfitDrivers(losing, { ...DEFAULT_PROFIT_DRIVER_INPUTS, conversionPct: 0.5 });
  assert.equal(r.profitBaseline, -200000);
  assert.equal(r.improved.revenue, 600000);
  assert.equal(r.profitImproved, 0);
  assert.equal(r.profitLift, 200000);
});
