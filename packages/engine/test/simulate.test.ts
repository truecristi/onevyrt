import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/simulate.ts";
import { validateFunnel, topoOrder } from "../src/graph.ts";
import { FunnelError, type Funnel } from "../src/types.ts";

// A -> landing(step 0.4) -> offer(0.1 @ $97)
const linear: Funnel = {
  nodes: [
    { id: "traffic", kind: "traffic", visitors: 1000, costPerVisitor: 200 }, // $2.00
    { id: "landing", kind: "step", passRate: 0.4 },
    { id: "sale", kind: "offer", conversionRate: 0.1, price: 9700 },          // $97
  ],
  edges: [
    { from: "traffic", to: "landing" },
    { from: "landing", to: "sale" },
  ],
};

test("linear funnel: hand-checked totals", () => {
  const r = simulate(linear);
  // 1000 visitors -> 400 to landing -> 40 buyers
  assert.equal(r.nodes.landing.inflow, 1000);
  assert.equal(r.nodes.landing.emissions.out, 400);
  assert.equal(r.nodes.sale.inflow, 400);
  assert.equal(r.nodes.sale.buyers, 40);
  assert.equal(r.totals.visitors, 1000);
  assert.equal(r.totals.buyers, 40);
  assert.equal(r.totals.cost, 200000);      // 1000 * 200 = $2000
  assert.equal(r.totals.revenue, 388000);   // 40 * 9700 = $3880
  assert.equal(r.totals.grossProfit, 188000); // $1880
});

test("determinism: identical input -> identical output", () => {
  assert.deepEqual(simulate(linear), simulate(linear));
});

// split funnel: 1000 -> split 0.7 yes / 0.3 no ; yes buys @ $50, no buys @ $20
const split: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
    { id: "s", kind: "split", yesRate: 0.7 },
    { id: "hot", kind: "offer", conversionRate: 0.2, price: 5000 },
    { id: "cold", kind: "offer", conversionRate: 0.05, price: 2000 },
  ],
  edges: [
    { from: "t", to: "s" },
    { from: "s", to: "hot", port: "yes" },
    { from: "s", to: "cold", port: "no" },
  ],
};

test("split funnel: ports route population correctly", () => {
  const r = simulate(split);
  assert.equal(r.nodes.s.emissions.yes, 700);
  assert.equal(r.nodes.s.emissions.no, 300);
  assert.equal(r.nodes.hot.buyers, 140);   // 700 * 0.2
  assert.equal(r.nodes.cold.buyers, 15);   // 300 * 0.05
  // revenue = 140*5000 + 15*2000 = 700000 + 30000 = 730000
  assert.equal(r.totals.revenue, 730000);
  assert.equal(r.totals.buyers, 155);
});

test("fan-in: two sources merge into one step", () => {
  const f: Funnel = {
    nodes: [
      { id: "fb", kind: "traffic", visitors: 600, costPerVisitor: 150 },
      { id: "goog", kind: "traffic", visitors: 400, costPerVisitor: 300 },
      { id: "page", kind: "step", passRate: 0.5 },
    ],
    edges: [{ from: "fb", to: "page" }, { from: "goog", to: "page" }],
  };
  const r = simulate(f);
  assert.equal(r.nodes.page.inflow, 1000);        // 600 + 400
  assert.equal(r.nodes.page.emissions.out, 500);
  assert.equal(r.totals.cost, 600 * 150 + 400 * 300); // 90000 + 120000
});

test("validation: rate out of range throws typed error", () => {
  const bad: Funnel = { nodes: [{ id: "x", kind: "step", passRate: 1.4 }], edges: [] };
  assert.throws(() => validateFunnel(bad), (e: any) => e instanceof FunnelError && e.code === "BAD_RATE");
});

test("validation: edge to missing node", () => {
  const bad: Funnel = {
    nodes: [{ id: "a", kind: "step", passRate: 0.5 }],
    edges: [{ from: "a", to: "ghost" }],
  };
  assert.throws(() => validateFunnel(bad), (e: any) => e.code === "EDGE_TO_MISSING");
});

test("cycle detection throws FunnelError CYCLE", () => {
  const cyc: Funnel = {
    nodes: [
      { id: "a", kind: "step", passRate: 0.5 },
      { id: "b", kind: "step", passRate: 0.5 },
    ],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
  };
  assert.throws(() => topoOrder(cyc), (e: any) => e.code === "CYCLE");
});

// --- unit economics -------------------------------------------------------
function econFunnel(over: Record<string, number>) {
  return {
    nodes: [
      { id: "t", kind: "traffic", label: "T", visitors: 1000, costPerVisitor: 0 },
      { id: "o", kind: "offer", label: "O", conversionRate: 0.1, price: 10000, ...over },
    ],
    edges: [{ from: "t", to: "o", port: "out" }],
  } as unknown as Funnel;
}

test("economics: refund rate reduces revenue to what is kept", () => {
  const r = simulate(econFunnel({ refundRate: 0.2 }));
  // 100 buyers * $100 = $10,000 collected; 20% refunded -> $8,000 kept
  assert.equal(r.nodes.o.revenue, 800000);
  assert.equal(r.nodes.o.cost, 0);
  assert.equal(r.totals.grossProfit, 800000);
});

test("economics: merchant fee is charged on revenue kept after refunds", () => {
  const r = simulate(econFunnel({ refundRate: 0.5, merchantFeeRate: 0.03 }));
  // $10,000 collected, 50% refunded -> $5,000 kept; 3% fee = $150
  assert.equal(r.nodes.o.revenue, 500000);
  assert.equal(r.nodes.o.cost, 15000);
  assert.equal(r.totals.grossProfit, 485000);
});

test("economics: unit cost is paid only on fulfilled (non-refunded) sales", () => {
  const r = simulate(econFunnel({ refundRate: 0.1, unitCost: 2000 }));
  // 100 buyers, 10% refund -> 90 fulfilled * $20 = $1,800 COGS
  assert.equal(r.nodes.o.cost, 180000);
  assert.equal(r.nodes.o.revenue, 900000);
  assert.equal(r.totals.grossProfit, 720000);
});

test("economics: all three combined, hand-checked", () => {
  const r = simulate(econFunnel({ refundRate: 0.1, merchantFeeRate: 0.029, unitCost: 1500 }));
  // collected $10,000; kept $9,000; fee 2.9% of 9,000 = $261; COGS 90 * $15 = $1,350
  assert.equal(r.nodes.o.revenue, 900000);
  assert.equal(r.nodes.o.cost, 26100 + 135000);
  assert.equal(r.totals.grossProfit, 900000 - 26100 - 135000);
});

test("economics: omitting the fields changes nothing (back-compat)", () => {
  const bare = simulate(econFunnel({}));
  assert.equal(bare.nodes.o.revenue, 1000000);
  assert.equal(bare.nodes.o.cost, 0);
  assert.equal(bare.totals.grossProfit, 1000000);
});

test("economics: validation rejects out-of-range refund and fee rates", () => {
  assert.throws(() => simulate(econFunnel({ refundRate: 1.5 })), /refundRate must be 0\.\.1/);
  assert.throws(() => simulate(econFunnel({ merchantFeeRate: -0.1 })), /merchantFeeRate must be 0\.\.1/);
  assert.throws(() => simulate(econFunnel({ unitCost: -5 })), /unitCost must be >= 0/);
});

// --- traffic as a channel (can receive, not just emit) --------------------
test("traffic node passes inbound population through instead of dropping it", () => {
  const f = {
    nodes: [
      { id: "ads", kind: "traffic", label: "Ads", visitors: 1000, costPerVisitor: 100 },
      { id: "lp", kind: "step", label: "LP", passRate: 0.5 },
      { id: "page", kind: "traffic", label: "FB Page", visitors: 0, costPerVisitor: 0 },
      { id: "o", kind: "offer", label: "Offer", conversionRate: 0.1, price: 10000 },
    ],
    edges: [{ from: "ads", to: "lp", port: "out" }, { from: "lp", to: "page", port: "out" }, { from: "page", to: "o", port: "out" }],
  } as unknown as Funnel;
  const r = simulate(f);
  assert.equal(r.nodes.page.inflow, 500);        // it now SEES the people
  assert.equal(r.nodes.page.emissions.out, 500); // and passes them on
  assert.equal(r.nodes.o.inflow, 500);           // nobody is lost
  assert.equal(r.nodes.o.buyers, 50);
});

test("traffic channel adds its own visitors to inbound population", () => {
  const f = {
    nodes: [
      { id: "ads", kind: "traffic", label: "Ads", visitors: 300, costPerVisitor: 100 },
      { id: "page", kind: "traffic", label: "Social page", visitors: 200, costPerVisitor: 50 },
      { id: "o", kind: "offer", label: "Offer", conversionRate: 0.5, price: 1000 },
    ],
    edges: [{ from: "ads", to: "page", port: "out" }, { from: "page", to: "o", port: "out" }],
  } as unknown as Funnel;
  const r = simulate(f);
  assert.equal(r.nodes.page.emissions.out, 500);   // 200 organic + 300 sent in
  assert.equal(r.totals.visitors, 500);            // counted once each, not double
  assert.equal(r.totals.cost, 300 * 100 + 200 * 50); // each node pays only for what it acquires
});

test("traffic with no inbound behaves exactly as before (back-compat)", () => {
  const r = simulate(linear);
  assert.equal(r.nodes.traffic.emissions.out, 1000);
  assert.equal(r.nodes.traffic.inflow, 0);
  assert.equal(r.totals.visitors, 1000);
  assert.equal(r.totals.cost, 200000);
});

// --- operating expenses ---------------------------------------------------
function expFunnel(nodeOver: Record<string, unknown>, scenario?: { amount?: number; rate?: number }) {
  const f: Record<string, unknown> = {
    nodes: [
      { id: "t", kind: "traffic", label: "T", visitors: 1000, costPerVisitor: 0 },
      { id: "o", kind: "offer", label: "O", conversionRate: 0.1, price: 10000, ...nodeOver },
    ],
    edges: [{ from: "t", to: "o", port: "out" }],
  };
  if (scenario) f.expenses = scenario;
  return f as unknown as Funnel;
}

test("expenses: flat node expense is booked as cost", () => {
  const r = simulate(expFunnel({ expenseAmount: 50000 })); // $500
  assert.equal(r.nodes.o.revenue, 1000000);
  assert.equal(r.nodes.o.cost, 50000);
  assert.equal(r.totals.grossProfit, 950000);
});

test("expenses: node expense rate is charged on that node's revenue", () => {
  const r = simulate(expFunnel({ expenseRate: 0.1 })); // 10% of $10,000
  assert.equal(r.nodes.o.cost, 100000);
  assert.equal(r.totals.grossProfit, 900000);
});

test("expenses: scenario expenses are flat + a share of total revenue", () => {
  const r = simulate(expFunnel({}, { amount: 100000, rate: 0.05 })); // $1,000 + 5% of $10,000
  assert.equal(r.totals.revenue, 1000000);
  assert.equal(r.totals.cost, 100000 + 50000);
  assert.equal(r.totals.grossProfit, 1000000 - 150000);
});

test("expenses: node + scenario + unit economics all stack, hand-checked", () => {
  const r = simulate(expFunnel({ refundRate: 0.1, merchantFeeRate: 0.03, unitCost: 1000, expenseAmount: 20000 },
                               { amount: 30000, rate: 0.02 }));
  // collected 100*$100 = $10,000; kept after 10% refunds = $9,000
  assert.equal(r.totals.revenue, 900000);
  // node cost: fee 3% of 9,000 = $270 + COGS 90*$10 = $900 + flat $200 = $1,370
  assert.equal(r.nodes.o.cost, 27000 + 90000 + 20000);
  // scenario: $300 + 2% of 9,000 = $180
  assert.equal(r.totals.cost, 27000 + 90000 + 20000 + 30000 + 18000);
  assert.equal(r.totals.grossProfit, 900000 - (27000 + 90000 + 20000 + 30000 + 18000));
});

test("expenses: omitted changes nothing (back-compat)", () => {
  const r = simulate(expFunnel({}));
  assert.equal(r.totals.cost, 0);
  assert.equal(r.totals.grossProfit, 1000000);
});

test("expenses: validation rejects bad rates and negative amounts", () => {
  assert.throws(() => simulate(expFunnel({ expenseRate: 2 })), /expenseRate must be 0\.\.1/);
  assert.throws(() => simulate(expFunnel({ expenseAmount: -1 })), /expenseAmount must be >= 0/);
  assert.throws(() => simulate(expFunnel({}, { rate: 9 })), /expenses\.rate must be 0\.\.1/);
});

// --- traffic cost model ---------------------------------------------------
test("cost model: flat books a fixed spend regardless of visitors", () => {
  const mk = (visitors: number) => ({
    nodes: [{ id: "t", kind: "traffic", label: "Ads", visitors, costPerVisitor: 200, costModel: "flat", flatCost: 300000 }],
    edges: [],
  } as unknown as Funnel);
  assert.equal(simulate(mk(1000)).totals.cost, 300000); // $3,000
  assert.equal(simulate(mk(9999)).totals.cost, 300000); // same spend, more people
});

test("cost model: perVisitor is the default and still multiplies", () => {
  const f = { nodes: [{ id: "t", kind: "traffic", label: "Ads", visitors: 1000, costPerVisitor: 200 }], edges: [] } as unknown as Funnel;
  assert.equal(simulate(f).totals.cost, 200000);
  const explicit = { nodes: [{ id: "t", kind: "traffic", label: "Ads", visitors: 1000, costPerVisitor: 200, costModel: "perVisitor" }], edges: [] } as unknown as Funnel;
  assert.equal(simulate(explicit).totals.cost, 200000);
});

test("cost model: flat with no flatCost is free, and negative flatCost is rejected", () => {
  const f = { nodes: [{ id: "t", kind: "traffic", label: "Ads", visitors: 500, costPerVisitor: 200, costModel: "flat" }], edges: [] } as unknown as Funnel;
  assert.equal(simulate(f).totals.cost, 0);
  const bad = { nodes: [{ id: "t", kind: "traffic", label: "Ads", visitors: 1, costPerVisitor: 0, flatCost: -1 }], edges: [] } as unknown as Funnel;
  assert.throws(() => simulate(bad), /flatCost must be >= 0/);
});

// --- variants / sales share ----------------------------------------------
function varFunnel(variants: unknown[], nodeOver: Record<string, unknown> = {}) {
  return {
    nodes: [
      { id: "t", kind: "traffic", label: "T", visitors: 1000, costPerVisitor: 0 },
      { id: "o", kind: "offer", label: "O", conversionRate: 0.1, price: 10000, variants, ...nodeOver },
    ],
    edges: [{ from: "t", to: "o", port: "out" }],
  } as unknown as Funnel;
}

test("variants: buyers split by share, each at its own price", () => {
  const r = simulate(varFunnel([
    { id: "basic", name: "Basic", price: 5000, share: 0.7 },
    { id: "pro", name: "Pro", price: 20000, share: 0.3 },
  ]));
  // 100 buyers: 70 x $50 = $3,500 + 30 x $200 = $6,000 -> $9,500
  assert.equal(r.nodes.o.revenue, 950000);
  assert.equal(r.nodes.o.buyers, 100);
});

test("variants: shares are normalised, so they need not sum to 1", () => {
  const half = simulate(varFunnel([
    { id: "a", price: 10000, share: 0.5 },
    { id: "b", price: 20000, share: 0.5 },
  ])).nodes.o.revenue;
  const tens = simulate(varFunnel([
    { id: "a", price: 10000, share: 0.1 },
    { id: "b", price: 20000, share: 0.1 },
  ])).nodes.o.revenue;
  assert.equal(half, tens);              // same 50/50 split
  assert.equal(half, 1500000);           // 50 x $100 + 50 x $200 = $15,000
});

test("variants: each carries its own refunds, fees and unit cost", () => {
  const r = simulate(varFunnel([
    { id: "cheap", price: 10000, share: 0.5, refundRate: 0.2, unitCost: 1000 },
    { id: "lux", price: 50000, share: 0.5, refundRate: 0, unitCost: 20000, merchantFeeRate: 0.05 },
  ]));
  // cheap: 50 x $100 = $5,000, keep 80% = $4,000; COGS 40 x $10 = $400
  // lux:   50 x $500 = $25,000 kept; fee 5% = $1,250; COGS 50 x $200 = $10,000
  assert.equal(r.nodes.o.revenue, 400000 + 2500000);
  assert.equal(r.nodes.o.cost, 40000 + 125000 + 1000000);
});

test("variants: a variant inherits node economics when it omits them", () => {
  const r = simulate(varFunnel(
    [{ id: "only", price: 10000, share: 1 }],
    { refundRate: 0.1, merchantFeeRate: 0.03, unitCost: 1000 },
  ));
  // identical to the no-variant path at the same price
  const plain = simulate(varFunnel([], { refundRate: 0.1, merchantFeeRate: 0.03, unitCost: 1000 }));
  assert.equal(r.nodes.o.revenue, plain.nodes.o.revenue);
  assert.equal(r.nodes.o.cost, plain.nodes.o.cost);
});

test("variants: inactive variants are ignored", () => {
  const r = simulate(varFunnel([
    { id: "live", price: 10000, share: 0.5 },
    { id: "dead", price: 99900, share: 0.5, active: false },
  ]));
  assert.equal(r.nodes.o.revenue, 1000000); // all 100 buyers at $100
});

test("variants: no variants means the old behaviour, exactly (back-compat)", () => {
  const withEmpty = simulate(varFunnel([]));
  const without = simulate({
    nodes: [
      { id: "t", kind: "traffic", label: "T", visitors: 1000, costPerVisitor: 0 },
      { id: "o", kind: "offer", label: "O", conversionRate: 0.1, price: 10000 },
    ],
    edges: [{ from: "t", to: "o", port: "out" }],
  } as unknown as Funnel);
  assert.equal(withEmpty.nodes.o.revenue, without.nodes.o.revenue);
  assert.equal(withEmpty.nodes.o.revenue, 1000000);
});

test("variants: validation rejects bad ladders", () => {
  assert.throws(() => simulate(varFunnel([{ id: "a", price: 100, share: 2 }])), /share must be 0\.\.1/);
  assert.throws(() => simulate(varFunnel([{ id: "a", price: -1, share: 1 }])), /price must be >= 0/);
  assert.throws(() => simulate(varFunnel([{ id: "a", price: 1, share: 1 }, { id: "a", price: 2, share: 1 }])), /duplicate variant id/);
  assert.throws(() => simulate(varFunnel([{ id: "", price: 1, share: 1 }])), /needs an id/);
  assert.throws(() => simulate(varFunnel([{ id: "a", price: 1, share: 0 }])), /cannot all have 0 share/);
});
