import test from "node:test";
import assert from "node:assert/strict";
import { computeJourney, newlyDone, JOURNEY_STEPS, PACE_MULT, type JourneySignals } from "../lib/studio/journey";

const START = "2026-01-01T00:00:00.000Z";
const day = (n: number) => new Date(Date.parse(START) + n * 86_400_000).toISOString();

const REQUIRED = JOURNEY_STEPS.filter((s) => !s.optional).length;

test("a fresh journey: nothing done, first step active, AI optional, rest upcoming", () => {
  const j = computeJourney({}, { startedAt: START, pace: "steady" }, START);
  assert.equal(j.done, 0);
  assert.equal(j.total, REQUIRED);              // optional steps don't count toward the total
  assert.equal(j.progress, 0);
  assert.equal(j.steps[0]!.status, "active");
  assert.equal(j.steps[1]!.status, "optional");  // Connect AI is optional
  assert.equal(j.nextStep?.title, "Write your Message");
  assert.equal(j.finished, false);
  assert.equal(j.overdueCount, 0);
});

test("done signals mark steps done and advance the active step (skipping optional AI)", () => {
  const signals: JourneySignals = { messageComplete: true };
  const j = computeJourney(signals, { startedAt: START, pace: "steady" }, day(0));
  assert.equal(j.steps[0]!.status, "done");
  assert.equal(j.steps[1]!.status, "optional"); // AI still optional, not blocking
  assert.equal(j.steps[2]!.status, "active");   // Build your Offer is next
  assert.equal(j.nextStep?.title, "Build your Offer");
  assert.equal(j.done, 1);                      // only the required Message counts
});

test("AI is optional: finishing every required step WITHOUT AI still reaches 100%", () => {
  const noAi: JourneySignals = { messageComplete: true, offerReady: true, positioningReady: true, presentationReady: true, economicsReady: true, hasFunnel: true, firstLead: true, firstBooked: true };
  const j = computeJourney(noAi, { startedAt: START, pace: "steady" }, day(30));
  assert.equal(j.finished, true);
  assert.equal(j.progress, 100);
  assert.equal(j.nextStep, null);
  assert.equal(j.overdueCount, 0); // the un-connected AI step is optional, never overdue
  assert.equal(j.steps[1]!.status, "optional");
});

test("overdue: an unfinished step past its due date lights up, evaluated on return", () => {
  // 20 days after start, nothing done → every step is overdue.
  const j = computeJourney({}, { startedAt: START, pace: "steady" }, day(20));
  assert.ok(j.overdueCount >= 1);
  assert.equal(j.steps[0]!.status, "overdue");
  assert.ok(j.steps[0]!.daysLeft < 0, "overdue step has negative daysLeft");
});

test("pace scales the deadlines: sprint is sooner than relaxed", () => {
  const steady = computeJourney({}, { startedAt: START, pace: "steady" }, START);
  const sprint = computeJourney({}, { startedAt: START, pace: "sprint" }, START);
  const relaxed = computeJourney({}, { startedAt: START, pace: "relaxed" }, START);
  const due = (j: typeof steady) => Date.parse(j.steps[2]!.dueDate); // Build your Offer, base day 3
  assert.ok(due(sprint) < due(steady), "sprint due before steady");
  assert.ok(due(relaxed) > due(steady), "relaxed due after steady");
  // sprint offer deadline ~ day 3 * 0.5 = 1.5 -> rounds to 2 days
  assert.equal(sprint.steps[2]!.dueDate, day(Math.round(3 * PACE_MULT.sprint)));
});

test("finished journey (incl. optional AI): all done, 100%, no next step", () => {
  const all: JourneySignals = { messageComplete: true, aiConnected: true, offerReady: true, positioningReady: true, presentationReady: true, economicsReady: true, hasFunnel: true, firstLead: true, firstBooked: true };
  const j = computeJourney(all, { startedAt: START, pace: "steady" }, day(30));
  assert.equal(j.progress, 100);
  assert.equal(j.finished, true);
  assert.equal(j.nextStep, null);
  assert.equal(j.overdueCount, 0);
  assert.equal(j.steps[1]!.status, "done"); // AI, when connected, shows done
});

test("missing startedAt defaults to now → nothing overdue on a brand-new journey", () => {
  const j = computeJourney({}, {}, START);
  assert.equal(j.startedAt, START);
  assert.equal(j.overdueCount, 0);
  assert.equal(j.pace, "steady");
});

test("newlyDone returns done steps not yet seen, in order", () => {
  const j = computeJourney({ messageComplete: true, offerReady: true }, { startedAt: START, pace: "steady" }, day(0));
  // nothing seen yet → both done steps are "new"
  assert.deepEqual(newlyDone(j.steps, []), ["messageComplete", "offerReady"]);
  // message already acknowledged → only the offer is new
  assert.deepEqual(newlyDone(j.steps, ["messageComplete"]), ["offerReady"]);
  // both seen → nothing new
  assert.deepEqual(newlyDone(j.steps, ["messageComplete", "offerReady"]), []);
  // a seen key that isn't done is ignored
  assert.deepEqual(newlyDone(j.steps, new Set(["hasFunnel"])), ["messageComplete", "offerReady"]);
});
