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

test("churn: LTV = monthlyPrice / churnRate per subscriber", () => {
  // 100 buyers * 0.5 recurring = 50 subs; $30/mo, 10% churn -> LTV/sub = $300 -> $15,000
  const r = simulate(linear({ recurringRate: 0.5, monthlyPrice: 3000, churnRate: 0.1 }));
  assert.equal(r.totals.mrr, 50 * 3000);   // $1,500/mo unchanged
  assert.equal(r.nodes.o.ltv, 50 * 30000); // $15,000 lifetime
  assert.equal(r.totals.ltv, 1500000);
});

test("churn: no churn rate -> no LTV computed (avoids divide-by-zero / infinity)", () => {
  const r = simulate(linear({ recurringRate: 0.5, monthlyPrice: 3000 })); // churn omitted
  assert.equal(r.totals.mrr, 150000);
  assert.equal(r.totals.ltv, 0);
});

test("churn: lower churn -> higher LTV", () => {
  const high = simulate(linear({ recurringRate: 0.4, monthlyPrice: 2000, churnRate: 0.2 })); // LTV/sub $100
  const low = simulate(linear({ recurringRate: 0.4, monthlyPrice: 2000, churnRate: 0.05 })); // LTV/sub $400
  assert.ok((low.totals.ltv ?? 0) > (high.totals.ltv ?? 0));
  assert.equal(high.nodes.o.ltv, 40 * 10000); // 40 subs * $100
  assert.equal(low.nodes.o.ltv, 40 * 40000);  // 40 subs * $400
});

test("churn: no recurring -> no LTV even if churn set", () => {
  const r = simulate(linear({ churnRate: 0.1 })); // no recurringRate/monthlyPrice
  assert.equal(r.totals.ltv, 0);
});
