import test from "node:test";
import assert from "node:assert/strict";
import { launchReadiness } from "../lib/studio/launch-readiness";
import type { JourneySignals } from "../lib/studio/journey";

const ALL: JourneySignals = {
  messageComplete: true, offerReady: true, economicsReady: true,
  presentationReady: true, hasFunnel: true,
};

test("nothing done → Not started, all five gaps, 0%", () => {
  const r = launchReadiness({});
  assert.equal(r.score, 0);
  assert.equal(r.done, 0);
  assert.equal(r.total, 5);
  assert.equal(r.ready, false);
  assert.equal(r.stage, "Not started");
  assert.equal(r.gaps.length, 5);
  assert.equal(r.gaps[0]!.area, "Message"); // priority order
});

test("all essentials done → Ready to sell, no gaps, 100%", () => {
  const r = launchReadiness(ALL);
  assert.equal(r.score, 100);
  assert.equal(r.ready, true);
  assert.equal(r.stage, "Ready to sell");
  assert.deepEqual(r.gaps, []);
  assert.equal(r.done_labels.length, 5);
  assert.match(r.headline, /ready to sell/i);
});

test("ready + first call booked gives the ongoing-engine headline", () => {
  const r = launchReadiness({ ...ALL, firstBooked: true });
  assert.equal(r.ready, true);
  assert.match(r.headline, /booking calls/i);
});

test("one gap left → Almost ready with a single-step headline", () => {
  const r = launchReadiness({ ...ALL, hasFunnel: false });
  assert.equal(r.done, 4);
  assert.equal(r.stage, "Almost ready");
  assert.equal(r.gaps.length, 1);
  assert.equal(r.gaps[0]!.area, "Funnel");
  assert.match(r.headline, /one step from ready/i);
});

test("gaps always come back in the fixed priority order", () => {
  const r = launchReadiness({ offerReady: true, hasFunnel: true }); // message, numbers, presentation missing
  assert.deepEqual(r.gaps.map((g) => g.area), ["Message", "Numbers", "Presentation"]);
  assert.deepEqual(r.done_labels, ["Offer built", "Funnel live"]);
  assert.equal(r.stage, "Getting set up");
});
