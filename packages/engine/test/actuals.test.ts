import test from "node:test";
import assert from "node:assert/strict";
import { aggregateActuals, hasActuals, type Actuals } from "../src/actuals.ts";

test("aggregateActuals: sums observed values into totals", () => {
  const a: Actuals = {
    fb:   { visitors: 900, cost: 210000 },   // $2,100 spend, 900 visitors
    sale: { buyers: 31, revenue: 300700 },   // 31 buyers, $3,007
  };
  const t = aggregateActuals(a);
  assert.equal(t.visitors, 900);
  assert.equal(t.buyers, 31);
  assert.equal(t.revenue, 300700);
  assert.equal(t.cost, 210000);
  assert.equal(t.grossProfit, 90700); // 300700 - 210000
});

test("aggregateActuals: missing measurements contribute zero, never NaN", () => {
  const t = aggregateActuals({ a: {}, b: { revenue: 5000 } });
  assert.equal(t.visitors, 0);
  assert.equal(t.buyers, 0);
  assert.equal(t.revenue, 5000);
  assert.equal(t.cost, 0);
  assert.equal(t.grossProfit, 5000);
  assert.ok(!Number.isNaN(t.grossProfit));
});

test("aggregateActuals: empty -> all zero", () => {
  const t = aggregateActuals({});
  assert.deepEqual(t, { visitors: 0, buyers: 0, revenue: 0, cost: 0, grossProfit: 0 });
});

test("hasActuals: detects whether anything was measured", () => {
  assert.equal(hasActuals({}), false);
  assert.equal(hasActuals({ a: {} }), false);
  assert.equal(hasActuals({ a: { buyers: 0 } }), true); // 0 is a real measurement
  assert.equal(hasActuals({ a: { revenue: 100 } }), true);
});
