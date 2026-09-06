import test from "node:test";
import assert from "node:assert/strict";
import { projectMonths } from "../src/calendar.ts";

const baseline = { visitors: 1000, revenue: 1000000, cost: 600000 }; // $10,000 rev, $6,000 cost, $4,000 profit

test("projectMonths: zero growth repeats the baseline every month", () => {
  const p = projectMonths(baseline, 3, 0);
  assert.equal(p.length, 3);
  for (const m of p) {
    assert.equal(m.visitors, 1000);
    assert.equal(m.revenue, 1000000);
    assert.equal(m.cost, 600000);
    assert.equal(m.profit, 400000);
  }
  assert.equal(p[2].cumulativeProfit, 1200000); // 3 * 400000
});

test("projectMonths: month 1 is always the unscaled baseline", () => {
  const p = projectMonths(baseline, 5, 0.1);
  assert.equal(p[0].visitors, 1000);
  assert.equal(p[0].revenue, 1000000);
});

test("projectMonths: positive growth compounds multiplicatively month over month", () => {
  const p = projectMonths(baseline, 3, 0.1);
  assert.equal(p[0].revenue, 1000000);          // 1.1^0
  assert.equal(p[1].revenue, 1100000);          // 1.1^1
  assert.equal(p[2].revenue, 1210000);          // 1.1^2
});

test("projectMonths: cumulativeProfit is a running sum, monotonically increasing when profit stays positive", () => {
  const p = projectMonths(baseline, 4, 0.05);
  for (let i = 1; i < p.length; i++) {
    assert.ok(p[i].cumulativeProfit > p[i - 1].cumulativeProfit);
    assert.equal(p[i].cumulativeProfit, p[i - 1].cumulativeProfit + p[i].profit);
  }
});

test("projectMonths: negative growth shrinks the plan toward zero without going negative on visitors", () => {
  const p = projectMonths(baseline, 6, -0.2);
  assert.ok(p[5].visitors < p[0].visitors);
  assert.ok(p[5].visitors >= 0);
});
