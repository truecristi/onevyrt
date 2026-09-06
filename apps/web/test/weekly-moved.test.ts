import test from "node:test";
import assert from "node:assert/strict";
import { computeMoves, daysBetween, shouldResetBaseline, type ProgressSnapshot } from "../lib/studio/weekly-moved";

const base: ProgressSnapshot = { at: "2026-08-01T00:00:00Z", readinessDone: 2, leads: 10, booked: 1, funnels: 1, views: 100 };
const stats = (o: Partial<ProgressSnapshot> = {}): { readinessDone: number; leads: number; booked: number; funnels: number; views: number } =>
  ({ readinessDone: o.readinessDone ?? base.readinessDone, leads: o.leads ?? base.leads, booked: o.booked ?? base.booked, funnels: o.funnels ?? base.funnels, views: o.views ?? base.views });

test("no baseline → no moves (first visit shows nothing)", () => {
  assert.deepEqual(computeMoves(null, { readinessDone: 3, leads: 20, booked: 2, funnels: 1, views: 150 }), []);
});

test("positive deltas become moves in priority order", () => {
  const moves = computeMoves(base, { readinessDone: 3, leads: 14, booked: 2, funnels: 2, views: 130 });
  assert.deepEqual(moves.map((m) => m.key), ["booked", "leads", "funnels", "readinessDone", "views"]);
  assert.match(moves[0]!.label, /1 call booked/);
  assert.match(moves[1]!.label, /4 new leads/);
  assert.equal(moves[0]!.tone, "win");
  assert.equal(moves.find((m) => m.key === "views")!.tone, "progress");
});

test("flat or backwards deltas are never shown", () => {
  assert.deepEqual(computeMoves(base, stats()), []); // identical counts
  const moves = computeMoves(base, { readinessDone: 1, leads: 5, booked: 1, funnels: 1, views: 100 });
  assert.deepEqual(moves, []); // everything down or equal
});

test("singular vs plural wording", () => {
  const one = computeMoves(base, stats({ leads: 11 }));
  assert.match(one[0]!.label, /1 new lead came in/);
  const many = computeMoves(base, stats({ leads: 13 }));
  assert.match(many[0]!.label, /3 new leads came in/);
});

test("daysBetween + shouldResetBaseline drive the weekly window", () => {
  assert.equal(daysBetween("2026-08-01T00:00:00Z", "2026-08-08T00:00:00Z"), 7);
  assert.equal(daysBetween(undefined, "2026-08-08T00:00:00Z"), 0);
  assert.equal(shouldResetBaseline(null, "2026-08-08T00:00:00Z"), true);          // no baseline
  assert.equal(shouldResetBaseline(base, "2026-08-05T00:00:00Z"), false);         // 4 days — keep
  assert.equal(shouldResetBaseline(base, "2026-08-08T00:00:00Z"), true);          // 7 days — roll forward
});
