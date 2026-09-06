import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import { simulate } from "../src/simulate.ts";

const linear = (offerExtra: Record<string, number> = {}): Funnel => ({
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000, ...offerExtra },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
});

test("no economics set -> revenue unchanged, mrr zero (back-compat)", () => {
  const r = simulate(linear());
  assert.equal(r.totals.buyers, 100);
  assert.equal(r.totals.revenue, 1000000); // 100 * $100
  assert.equal(r.totals.mrr, 0);
});

test("order bump adds one-time revenue", () => {
  const r = simulate(linear({ orderBumpRate: 0.5, orderBumpPrice: 2000 })); // 50 take $20 bump
  assert.equal(r.totals.revenue, 1000000 + 50 * 2000); // +$1,000
});

test("upsell adds one-time revenue", () => {
  const r = simulate(linear({ upsellRate: 0.3, upsellPrice: 5000 })); // 30 take $50 upsell
  assert.equal(r.totals.revenue, 1000000 + 30 * 5000); // +$1,500
});

test("recurring produces MRR without inflating one-time revenue", () => {
  const r = simulate(linear({ recurringRate: 0.4, monthlyPrice: 3000 })); // 40 subs @ $30/mo
  assert.equal(r.totals.revenue, 1000000);       // one-time unchanged
  assert.equal(r.totals.mrr, 40 * 3000);         // $1,200 MRR
  assert.equal(r.nodes.o.mrr, 120000);
});

test("bump + upsell + recurring combine correctly", () => {
  const r = simulate(linear({ orderBumpRate: 0.5, orderBumpPrice: 2000, upsellRate: 0.2, upsellPrice: 5000, recurringRate: 0.1, monthlyPrice: 3000 }));
  assert.equal(r.totals.revenue, 1000000 + 50 * 2000 + 20 * 5000);
  assert.equal(r.totals.mrr, 10 * 3000);
});
