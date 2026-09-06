import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeEconomics, economicsViability, EMPTY_ECONOMICS, type EconomicsData } from "../lib/studio/economics";

test("sanitizeEconomics coerces to non-negative numbers, keeps optionals only when present", () => {
  const o = sanitizeEconomics({ fixedCosts: "6000", variableCostPerUnit: -5, currentUnits: "12.7", profitGoal: "3000" });
  assert.equal(o.fixedCosts, 6000);
  assert.equal(o.variableCostPerUnit, 0); // negative floored
  assert.equal(o.currentUnits, 13);        // rounded
  assert.equal(o.profitGoal, 3000);
  // absent optionals stay absent
  const bare = sanitizeEconomics({ fixedCosts: 100, variableCostPerUnit: 20 });
  assert.equal(bare.currentUnits, undefined);
  assert.equal(bare.profitGoal, undefined);
  // garbage → empties
  assert.deepEqual(sanitizeEconomics({ fixedCosts: "abc", variableCostPerUnit: NaN }), EMPTY_ECONOMICS);
});

test("economicsViability: healthy margin scores as the margin percent", () => {
  const econ: EconomicsData = { fixedCosts: 6000, variableCostPerUnit: 20 };
  const v = economicsViability(econ, 50); // contribution 30, margin 60%
  assert.equal(v.viable, true);
  assert.equal(v.contributionPerUnit, 30);
  assert.ok(Math.abs(v.contributionMarginPct! - 0.6) < 1e-9);
  assert.equal(v.score, 60);
  assert.equal(v.stage, "Strong margins");
  assert.equal(v.breakEvenUnits, 200); // 6000 / 30
});

test("economicsViability: each sale loses money → not viable, no break-even", () => {
  const v = economicsViability({ fixedCosts: 100, variableCostPerUnit: 60 }, 50);
  assert.equal(v.viable, false);
  assert.equal(v.score, 0);
  assert.equal(v.stage, "Not viable");
  assert.equal(v.breakEvenUnits, null);
});

test("economicsViability: no price yet → not viable, margin null", () => {
  const v = economicsViability({ fixedCosts: 100, variableCostPerUnit: 10 }, 0);
  assert.equal(v.viable, false);
  assert.equal(v.contributionMarginPct, null);
  assert.equal(v.score, 0);
});

test("economicsViability: stages move with the margin", () => {
  const thin = economicsViability({ fixedCosts: 0, variableCostPerUnit: 90 }, 100); // 10% margin
  assert.equal(thin.stage, "Thin margins");
  const workable = economicsViability({ fixedCosts: 0, variableCostPerUnit: 70 }, 100); // 30%
  assert.equal(workable.stage, "Workable");
  const healthy = economicsViability({ fixedCosts: 0, variableCostPerUnit: 50 }, 100); // 50%
  assert.equal(healthy.stage, "Healthy");
});
