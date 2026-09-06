import test from "node:test";
import assert from "node:assert/strict";
import { weeklyPlan, weeklyPhase } from "../lib/studio/weekly-plan";
import type { JourneySignals } from "../lib/studio/journey";

const LIVE: JourneySignals = { messageComplete: true, offerReady: true, hasFunnel: true };

test("weeklyPhase walks setup → outreach → convert → grow", () => {
  assert.equal(weeklyPhase({}), "setup");
  assert.equal(weeklyPhase({ messageComplete: true, offerReady: true }), "setup"); // no funnel yet
  assert.equal(weeklyPhase(LIVE), "outreach");
  assert.equal(weeklyPhase({ ...LIVE, firstLead: true }), "convert");
  assert.equal(weeklyPhase({ ...LIVE, firstLead: true, firstBooked: true }), "grow");
});

test("setup phase surfaces only unfinished essentials, capped at 3", () => {
  const plan = weeklyPlan({}); // nothing done
  assert.equal(plan.phase, "setup");
  assert.ok(plan.actions.length <= 3);
  assert.equal(plan.actions[0]!.id, "w-message"); // message first
  // once message + offer are done, they drop off and numbers/funnel remain
  const later = weeklyPlan({ messageComplete: true, offerReady: true });
  const ids = later.actions.map((a) => a.id);
  assert.ok(!ids.includes("w-message"));
  assert.ok(!ids.includes("w-offer"));
  assert.ok(ids.includes("w-funnel"));
});

test("outreach phase is the free acquisition rhythm plus a first-lead push", () => {
  const plan = weeklyPlan(LIVE);
  assert.equal(plan.phase, "outreach");
  const ids = plan.actions.map((a) => a.id);
  assert.ok(ids.includes("w-outreach"));
  assert.ok(ids.includes("w-content"));
  assert.ok(ids.includes("w-firstlead"));
  // the rhythm actions carry a weekly target count
  const outreach = plan.actions.find((a) => a.id === "w-outreach");
  assert.equal(outreach?.target, 10);
});

test("convert phase leads with fast follow-up and booking", () => {
  const plan = weeklyPlan({ ...LIVE, firstLead: true });
  assert.equal(plan.phase, "convert");
  assert.equal(plan.actions[0]!.id, "w-followup");
  assert.ok(plan.actions.some((a) => a.id === "w-book"));
});

test("grow phase keeps the rhythm and adds nurture + a winner", () => {
  const plan = weeklyPlan({ ...LIVE, firstLead: true, firstBooked: true });
  assert.equal(plan.phase, "grow");
  const ids = plan.actions.map((a) => a.id);
  assert.ok(ids.includes("w-outreach"));
  assert.ok(ids.includes("w-nurture"));
  assert.ok(ids.includes("w-winner"));
});

test("every action has a title, href and cta so the card can render it", () => {
  for (const sig of [{}, LIVE, { ...LIVE, firstLead: true }, { ...LIVE, firstLead: true, firstBooked: true }]) {
    for (const a of weeklyPlan(sig as JourneySignals).actions) {
      assert.ok(a.title && a.href && a.cta, `action ${a.id} is missing a field`);
    }
  }
});
