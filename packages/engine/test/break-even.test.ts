import test from "node:test";
import assert from "node:assert/strict";
import { computeUnitBreakEven, unitsForTargetProfit } from "../src/break-even.ts";

// $50 price, $20 variable cost -> $30 contribution; $6,000 fixed costs.
const inputs = { fixedCosts: 600000, pricePerUnit: 5000, variableCostPerUnit: 2000 };

test("computeUnitBreakEven: contribution and margin from price and variable cost", () => {
  const r = computeUnitBreakEven(inputs);
  assert.equal(r.contributionPerUnit, 3000); // 5000 - 2000
  assert.ok(Math.abs(r.contributionMarginPct! - 0.6) < 1e-9); // 3000 / 5000
});

test("computeUnitBreakEven: break-even units round up to a whole unit", () => {
  const r = computeUnitBreakEven(inputs);
  assert.equal(r.breakEvenUnits, 200); // 600000 / 3000
  assert.equal(r.breakEvenRevenue, 1000000); // 200 * 5000
});

test("computeUnitBreakEven: fractional break-even rounds up, never down", () => {
  // 100000 / 3000 = 33.33 -> 34 units needed to actually cover fixed costs.
  const r = computeUnitBreakEven({ fixedCosts: 100000, pricePerUnit: 5000, variableCostPerUnit: 2000 });
  assert.equal(r.breakEvenUnits, 34);
});

test("computeUnitBreakEven: non-positive contribution can never break even", () => {
  const r = computeUnitBreakEven({ fixedCosts: 600000, pricePerUnit: 2000, variableCostPerUnit: 2000 });
  assert.equal(r.contributionPerUnit, 0);
  assert.equal(r.breakEvenUnits, null);
  assert.equal(r.breakEvenRevenue, null);

  const losing = computeUnitBreakEven({ fixedCosts: 600000, pricePerUnit: 1500, variableCostPerUnit: 2000 });
  assert.equal(losing.contributionPerUnit, -500);
  assert.equal(losing.breakEvenUnits, null);
});

test("computeUnitBreakEven: zero price yields a null margin, not a divide-by-zero", () => {
  const r = computeUnitBreakEven({ fixedCosts: 600000, pricePerUnit: 0, variableCostPerUnit: 0 });
  assert.equal(r.contributionMarginPct, null);
  assert.equal(r.breakEvenUnits, null); // contribution is 0
});

test("computeUnitBreakEven: current volume gives profit and margin of safety", () => {
  const r = computeUnitBreakEven(inputs, 300); // 100 units above the 200 break-even
  assert.equal(r.currentProfit, 300000); // 300*3000 - 600000
  assert.equal(r.marginOfSafetyUnits, 100); // 300 - 200
  assert.ok(Math.abs(r.marginOfSafetyPct! - (100 / 300)) < 1e-9);
});

test("computeUnitBreakEven: current volume below break-even is a loss and negative safety", () => {
  const r = computeUnitBreakEven(inputs, 150); // below 200
  assert.equal(r.currentProfit, -150000); // 150*3000 - 600000
  assert.equal(r.marginOfSafetyUnits, -50); // 150 - 200
  assert.ok(r.marginOfSafetyPct! < 0);
});

test("computeUnitBreakEven: no current volume leaves current/safety fields null", () => {
  const r = computeUnitBreakEven(inputs);
  assert.equal(r.currentProfit, null);
  assert.equal(r.marginOfSafetyUnits, null);
  assert.equal(r.marginOfSafetyPct, null);
});

test("unitsForTargetProfit: target folds into fixed costs, rounds up", () => {
  // $30 contribution, $6,000 fixed. To make $3,000 profit: (6000+3000)/30 = 300 units.
  assert.equal(unitsForTargetProfit(inputs, 300000), 300);
  // target 0 === break-even (200 units here)
  assert.equal(unitsForTargetProfit(inputs, 0), 200);
  // fractional rounds UP
  assert.equal(unitsForTargetProfit({ fixedCosts: 100, pricePerUnit: 30, variableCostPerUnit: 0 }, 0), 4); // 100/30 = 3.33 -> 4
});

test("unitsForTargetProfit: null when each sale contributes nothing", () => {
  assert.equal(unitsForTargetProfit({ fixedCosts: 100, pricePerUnit: 20, variableCostPerUnit: 20 }, 500), null);
  assert.equal(unitsForTargetProfit({ fixedCosts: 100, pricePerUnit: 10, variableCostPerUnit: 20 }, 0), null);
});

test("unitsForTargetProfit: negative target (acceptable loss) floors at 0", () => {
  // contribution $30, fixed $6,000; accepting a $6,000 loss needs 0 sales.
  assert.equal(unitsForTargetProfit(inputs, -600000), 0);
  // accepting more loss than fixed costs still floors at 0, never negative.
  assert.equal(unitsForTargetProfit(inputs, -900000), 0);
});
