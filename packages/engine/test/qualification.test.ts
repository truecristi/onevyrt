import test from "node:test";
import assert from "node:assert/strict";
import { scoreLead, evalCondition, type QualRules } from "../src/qualification.ts";

// A realistic agency lead-qual ruleset: gates reject the wrong country and a
// hobbyist revenue floor; weighted rules reward budget, urgency, decision-maker
// and the right business type. Routes send the best leads to a senior calendar.
const RULES: QualRules = {
  gates: [
    { id: "gate-country", when: { questionId: "country", op: "not_in", value: ["UK", "US"] }, reason: "unsupported country" },
    { id: "gate-revenue", when: { questionId: "monthly_revenue", op: "lt", value: 5000 }, reason: "under revenue floor" },
  ],
  scored: [
    { id: "s-owner", when: { questionId: "role", op: "equals", value: "owner" }, points: 20 },
    { id: "s-revenue", when: { questionId: "monthly_revenue", op: "gte", value: 50000 }, points: 25 },
    { id: "s-urgent", when: { questionId: "timeline", op: "equals", value: "now" }, points: 20 },
    { id: "s-budget", when: { questionId: "budget", op: "gte", value: 2000 }, points: 20 },
    { id: "s-industry", when: { questionId: "goals", op: "contains", value: "leads" }, points: 15 },
  ],
  thresholds: { qualified: 70, nurture: 40 },
  routes: [
    { id: "r-enterprise", status: "qualified", minScore: 90, destination: "calendar_enterprise" },
    { id: "r-standard", status: "qualified", destination: "calendar_standard" },
    { id: "r-nurture", status: "nurture", destination: "nurture_sequence" },
    { id: "r-reject", destination: "alt_offer" },
  ],
};

test("evalCondition: operators behave", () => {
  assert.equal(evalCondition({ questionId: "x", op: "equals", value: "a" }, { x: "a" }), true);
  assert.equal(evalCondition({ questionId: "x", op: "not_equals", value: "a" }, { x: "b" }), true);
  assert.equal(evalCondition({ questionId: "x", op: "not_equals", value: "a" }, {}), true, "absent counts as not-equal");
  assert.equal(evalCondition({ questionId: "x", op: "gte", value: 10 }, { x: 10 }), true);
  assert.equal(evalCondition({ questionId: "x", op: "lt", value: 10 }, { x: 4 }), true);
  assert.equal(evalCondition({ questionId: "x", op: "in", value: ["a", "b"] }, { x: "b" }), true);
  assert.equal(evalCondition({ questionId: "x", op: "contains", value: "leads" }, { x: ["leads", "sales"] }), true);
  assert.equal(evalCondition({ questionId: "x", op: "exists", value: undefined }, { x: "" }), false, "blank is absent");
  assert.equal(evalCondition({ questionId: "x", op: "gte", value: 10 }, {}), false, "missing numeric is false");
});

test("scoreLead: a strong owner-led lead qualifies and routes to standard", () => {
  const r = scoreLead({ country: "UK", role: "owner", monthly_revenue: 60000, timeline: "later", budget: 3000, goals: ["leads"] }, RULES);
  // 20 + 25 + 0 + 20 + 15 = 80
  assert.equal(r.score, 80);
  assert.equal(r.status, "qualified");
  assert.equal(r.route, "calendar_standard");
  assert.equal(r.maxScore, 100);
  assert.equal(r.percent, 80);
  assert.ok(r.failedGateIds.length === 0);
});

test("scoreLead: a top lead routes to the enterprise calendar", () => {
  const r = scoreLead({ country: "US", role: "owner", monthly_revenue: 80000, timeline: "now", budget: 5000, goals: ["leads"] }, RULES);
  assert.equal(r.score, 100);
  assert.equal(r.status, "qualified");
  assert.equal(r.route, "calendar_enterprise");
});

test("scoreLead: a hard gate forces reject even with a high score", () => {
  // Everything scores high, but revenue is under the floor → gate fires.
  const r = scoreLead({ country: "UK", role: "owner", monthly_revenue: 1000, timeline: "now", budget: 5000, goals: ["leads"] }, RULES);
  assert.deepEqual(r.failedGateIds, ["gate-revenue"]);
  assert.equal(r.status, "unqualified");
  assert.equal(r.route, "alt_offer");
});

test("scoreLead: an unsupported country is gated out", () => {
  const r = scoreLead({ country: "FR", role: "owner", monthly_revenue: 90000, timeline: "now", budget: 5000, goals: ["leads"] }, RULES);
  assert.ok(r.failedGateIds.includes("gate-country"));
  assert.equal(r.status, "unqualified");
});

test("scoreLead: a middling lead lands in nurture", () => {
  // owner (20) only → 20 is below qualified(70) but the nurture floor is 40...
  const low = scoreLead({ country: "UK", role: "owner", monthly_revenue: 8000 }, RULES);
  assert.equal(low.score, 20);
  assert.equal(low.status, "unqualified", "20 is below the nurture floor of 40");

  const mid = scoreLead({ country: "UK", role: "owner", monthly_revenue: 8000, timeline: "now", budget: 2500 }, RULES);
  // 20 + 20 + 20 = 60 → nurture (>=40, <70)
  assert.equal(mid.score, 60);
  assert.equal(mid.status, "nurture");
  assert.equal(mid.route, "nurture_sequence");
});

test("scoreLead: empty answers score zero and reject cleanly", () => {
  const r = scoreLead({}, RULES);
  assert.equal(r.score, 0);
  assert.equal(r.status, "unqualified");
  assert.equal(r.route, "alt_offer");
});
