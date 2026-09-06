import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import { simulate } from "../src/simulate.ts";
import { applyScenario, compareScenarios, headToHead, HEAD_TO_HEAD_BASE_ID, type Scenario } from "../src/scenarios.ts";

const base: Funnel = {
  nodes: [
    { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
    { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
  ],
  edges: [{ from: "t", to: "o", port: "out" }],
};

test("applyScenario: overrides a field without mutating the base", () => {
  const sc: Scenario = { id: "s1", name: "Higher price", overrides: [{ nodeId: "o", field: "price", value: 20000 }] };
  const variant = applyScenario(base, sc);
  const vOffer = variant.nodes.find((n) => n.id === "o")!;
  const bOffer = base.nodes.find((n) => n.id === "o")!;
  assert.equal((vOffer as { price: number }).price, 20000);
  assert.equal((bOffer as { price: number }).price, 10000); // base untouched
});

test("compareScenarios: price bump raises revenue, delta reported", () => {
  const sc: Scenario = { id: "s1", name: "2x price", overrides: [{ nodeId: "o", field: "price", value: 20000 }] };
  const cmp = compareScenarios(base, [sc]);
  assert.equal(cmp.base.revenue, 1000000);         // 100 * $100
  assert.equal(cmp.scenarios[0].totals.revenue, 2000000);
  assert.equal(cmp.scenarios[0].delta.revenue, 1000000);
});

test("compareScenarios: adding recurring shows MRR delta", () => {
  const sc: Scenario = { id: "s2", name: "Add subscription", overrides: [
    { nodeId: "o", field: "recurringRate", value: 0.5 },
    { nodeId: "o", field: "monthlyPrice", value: 3000 },
  ] };
  const cmp = compareScenarios(base, [sc]);
  assert.equal(cmp.base.mrr ?? 0, 0);
  assert.equal(cmp.scenarios[0].totals.mrr, 50 * 3000); // 50 subs @ $30
  assert.equal(cmp.scenarios[0].delta.mrr, 150000);
});

test("compareScenarios: conversion bump raises buyers and profit", () => {
  const sc: Scenario = { id: "s3", name: "Better CR", overrides: [{ nodeId: "o", field: "conversionRate", value: 0.15 }] };
  const cmp = compareScenarios(base, [sc]);
  assert.equal(cmp.scenarios[0].delta.buyers, 50);       // 150 - 100
  assert.ok(cmp.scenarios[0].delta.grossProfit > 0);
});

test("compareScenarios: no scenarios -> base only", () => {
  const cmp = compareScenarios(base, []);
  assert.equal(cmp.scenarios.length, 0);
  assert.equal(cmp.base.buyers, 100);
});

test("headToHead: two scenarios side-by-side, delta is B minus A", () => {
  const a: Scenario = { id: "a", name: "2x price", overrides: [{ nodeId: "o", field: "price", value: 20000 }] };
  const b: Scenario = { id: "b", name: "3x price", overrides: [{ nodeId: "o", field: "price", value: 30000 }] };
  const cmp = compareScenarios(base, [a, b]);
  const h = headToHead(cmp, "a", "b")!;
  assert.equal(h.a.name, "2x price");
  assert.equal(h.b.name, "3x price");
  assert.equal(h.a.totals.revenue, 2000000);
  assert.equal(h.b.totals.revenue, 3000000);
  assert.equal(h.delta.revenue, 1000000); // B − A
});

test("headToHead: a scenario against the base plan via the base sentinel", () => {
  const b: Scenario = { id: "b", name: "Better CR", overrides: [{ nodeId: "o", field: "conversionRate", value: 0.15 }] };
  const cmp = compareScenarios(base, [b]);
  const h = headToHead(cmp, HEAD_TO_HEAD_BASE_ID, "b")!;
  assert.equal(h.a.name, "Base plan");
  assert.equal(h.delta.buyers, 50); // 150 - 100
});

test("headToHead: unknown id -> null", () => {
  const cmp = compareScenarios(base, []);
  assert.equal(headToHead(cmp, "nope", HEAD_TO_HEAD_BASE_ID), null);
});
