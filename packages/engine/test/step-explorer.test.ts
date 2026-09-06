import test from "node:test";
import assert from "node:assert/strict";
import { exploreStep } from "../src/step-explorer.ts";
import type { Funnel } from "../src/types.ts";

// fb -----\
//          > landing -> sale
// google -/                \-> upsell
const funnel: Funnel = {
  nodes: [
    { id: "fb", kind: "traffic", visitors: 1000, costPerVisitor: 200 },
    { id: "google", kind: "traffic", visitors: 500, costPerVisitor: 300 },
    { id: "landing", kind: "step", passRate: 0.4 },
    { id: "sale", kind: "offer", conversionRate: 0.1, price: 9700 },
    { id: "upsell", kind: "offer", conversionRate: 0.2, price: 4900 },
  ],
  edges: [
    { from: "fb", to: "landing" },
    { from: "google", to: "landing" },
    { from: "landing", to: "sale" },
    { from: "sale", to: "upsell" },
  ],
};

test("exploreStep: middle node sees both traffic sources upstream and both offers downstream", () => {
  const r = exploreStep(funnel, "landing");
  assert.deepEqual(new Set(r.ancestors), new Set(["fb", "google"]));
  assert.deepEqual(new Set(r.descendants), new Set(["sale", "upsell"]));
  assert.deepEqual(new Set(r.upstreamTrafficSources), new Set(["fb", "google"]));
  assert.deepEqual(new Set(r.downstreamOffers), new Set(["sale", "upsell"]));
});

test("exploreStep: a traffic source has no ancestors", () => {
  const r = exploreStep(funnel, "fb");
  assert.deepEqual(r.ancestors, []);
  assert.deepEqual(r.upstreamTrafficSources, []);
  assert.deepEqual(new Set(r.descendants), new Set(["landing", "sale", "upsell"]));
});

test("exploreStep: the final offer has no descendants", () => {
  const r = exploreStep(funnel, "upsell");
  assert.deepEqual(r.descendants, []);
  assert.deepEqual(r.downstreamOffers, []);
  assert.deepEqual(new Set(r.ancestors), new Set(["fb", "google", "landing", "sale"]));
});

test("exploreStep: sale's downstream offers include upsell but not itself", () => {
  const r = exploreStep(funnel, "sale");
  assert.deepEqual(r.downstreamOffers, ["upsell"]);
  assert.ok(!r.descendants.includes("sale"));
  assert.ok(!r.ancestors.includes("sale"));
});
