import test from "node:test";
import assert from "node:assert/strict";
import type { Funnel } from "../src/types.ts";
import { simulate } from "../src/simulate.ts";
import { computeTimeline } from "../src/time.ts";

test("computeTimeline: no delays means instant conversion", () => {
  const funnel: Funnel = {
    nodes: [
      { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
      { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
    ],
    edges: [{ from: "t", to: "o", port: "out" }],
  };
  const sim = simulate(funnel);
  const tl = computeTimeline(funnel, sim);
  assert.equal(tl.daysFromStart.t, 0);
  assert.equal(tl.daysFromStart.o, 0);
  assert.equal(tl.overallDaysToConvert, 0);
});

test("computeTimeline: delay on a step pushes the offer's arrival day", () => {
  const funnel: Funnel = {
    nodes: [
      { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
      { id: "wait", kind: "step", passRate: 1, delayDays: 3 },
      { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
    ],
    edges: [{ from: "t", to: "wait" }, { from: "wait", to: "o" }],
  };
  const sim = simulate(funnel);
  const tl = computeTimeline(funnel, sim);
  assert.equal(tl.daysFromStart.wait, 0); // arrives at wait instantly
  assert.equal(tl.daysFromStart.o, 3);    // then waits 3 days before reaching the offer
  assert.equal(tl.overallDaysToConvert, 3);
});

test("computeTimeline: arrival day is the slowest path in (max, not sum, across parallel inputs)", () => {
  const funnel: Funnel = {
    nodes: [
      { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
      { id: "fast", kind: "step", passRate: 1, delayDays: 1 },
      { id: "slow", kind: "step", passRate: 1, delayDays: 5 },
      { id: "o", kind: "offer", conversionRate: 0.1, price: 10000 },
    ],
    edges: [
      { from: "t", to: "fast" }, { from: "t", to: "slow" },
      { from: "fast", to: "o" }, { from: "slow", to: "o" },
    ],
  };
  const sim = simulate(funnel);
  const tl = computeTimeline(funnel, sim);
  assert.equal(tl.daysFromStart.o, 5); // must wait for the slower path
});

test("computeTimeline: overall days-to-convert is buyer-weighted across offers", () => {
  const funnel: Funnel = {
    nodes: [
      { id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 },
      { id: "fastwait", kind: "step", passRate: 1, delayDays: 1 },
      { id: "of1", kind: "offer", conversionRate: 0.8, price: 1000 }, // many buyers, 1 day
      { id: "slowwait", kind: "step", passRate: 1, delayDays: 10 },
      { id: "of2", kind: "offer", conversionRate: 0.2, price: 1000 }, // few buyers, 10 days
    ],
    edges: [
      { from: "t", to: "fastwait" }, { from: "fastwait", to: "of1" },
      { from: "t", to: "slowwait" }, { from: "slowwait", to: "of2" },
    ],
  };
  const sim = simulate(funnel);
  const tl = computeTimeline(funnel, sim);
  // weighted toward the higher-volume, faster offer
  assert.ok(tl.overallDaysToConvert! < 5.5);
  assert.ok(tl.overallDaysToConvert! > 1);
});

test("computeTimeline: no offers means no overall days-to-convert", () => {
  const funnel: Funnel = {
    nodes: [{ id: "t", kind: "traffic", visitors: 1000, costPerVisitor: 0 }],
    edges: [],
  };
  const sim = simulate(funnel);
  const tl = computeTimeline(funnel, sim);
  assert.equal(tl.overallDaysToConvert, null);
  assert.deepEqual(tl.offers, []);
});
