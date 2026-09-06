import test from "node:test";
import assert from "node:assert/strict";
import { scoreWeek, streakLabel, EMPTY_STREAK, type StreakRecord } from "../lib/studio/streak";

test("first moved week starts the streak", () => {
  const u = scoreWeek(null, true, "2026-08-01T00:00:00Z");
  assert.equal(u.record.weeks, 1);
  assert.equal(u.record.best, 1);
  assert.equal(u.event, "started");
});

test("consecutive moved weeks extend it and track best", () => {
  let r: StreakRecord = EMPTY_STREAK;
  r = scoreWeek(r, true, "2026-08-01T00:00:00Z").record;
  r = scoreWeek(r, true, "2026-08-08T00:00:00Z").record;
  const u = scoreWeek(r, true, "2026-08-15T00:00:00Z");
  assert.equal(u.record.weeks, 3);
  assert.equal(u.record.best, 3);
  assert.equal(u.event, "extended");
});

test("a quiet week resets to 0 but keeps best", () => {
  let r: StreakRecord = EMPTY_STREAK;
  r = scoreWeek(r, true, "2026-08-01T00:00:00Z").record;
  r = scoreWeek(r, true, "2026-08-08T00:00:00Z").record; // best now 2
  const u = scoreWeek(r, false, "2026-08-15T00:00:00Z");
  assert.equal(u.record.weeks, 0);
  assert.equal(u.record.best, 2);
  assert.equal(u.event, "reset");
});

test("a quiet week with no prior run is a no-op, not a reset", () => {
  const u = scoreWeek(EMPTY_STREAK, false, "2026-08-01T00:00:00Z");
  assert.equal(u.record.weeks, 0);
  assert.equal(u.event, "none");
});

test("the same baseline is never scored twice", () => {
  const first = scoreWeek(null, true, "2026-08-01T00:00:00Z").record;
  const again = scoreWeek(first, true, "2026-08-01T00:00:00Z");
  assert.equal(again.record.weeks, 1); // unchanged
  assert.equal(again.event, "none");
});

test("streakLabel reads naturally or stays empty", () => {
  assert.equal(streakLabel({ weeks: 0, best: 3 }), "");
  assert.equal(streakLabel({ weeks: 1, best: 1 }), "1-week streak");
  assert.equal(streakLabel({ weeks: 5, best: 5 }), "5-week streak");
});
