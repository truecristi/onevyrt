import test, { after } from "node:test";
import assert from "node:assert/strict";
import { getStreak, saveStreak, sanitizeStreak } from "../lib/studio/streak-store";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS = uid("streak-ws");

after(async () => {
  await pgPool().query("DELETE FROM workspace_business WHERE workspace_id = $1", [WS]);
});

test("sanitizeStreak coerces junk to a valid record (no NaN / negatives; best >= weeks)", () => {
  assert.deepEqual(sanitizeStreak(undefined), { weeks: 0, best: 0 });
  assert.deepEqual(sanitizeStreak({ weeks: 3, best: 5, lastScoredAt: "2026-08-01T00:00:00Z" }), { weeks: 3, best: 5, lastScoredAt: "2026-08-01T00:00:00Z" });
  assert.deepEqual(sanitizeStreak({ weeks: -2, best: -9 }), { weeks: 0, best: 0 });
  assert.deepEqual(sanitizeStreak({ weeks: "4", best: 1 }), { weeks: 4, best: 4 }); // best floored up to weeks
  assert.deepEqual(sanitizeStreak({ weeks: 2.9, best: "x" }), { weeks: 2, best: 2 });
  assert.equal(Object.prototype.hasOwnProperty.call(sanitizeStreak({ weeks: 1 }), "lastScoredAt"), false);
});

test("getStreak returns an empty record before anything is saved", async () => {
  assert.deepEqual(await getStreak(WS), { weeks: 0, best: 0 });
});

test("saveStreak persists and getStreak reads it back (survives a fresh read)", async () => {
  const saved = await saveStreak(WS, { weeks: 4, best: 6, lastScoredAt: "2026-08-18T00:00:00Z" });
  assert.deepEqual(saved, { weeks: 4, best: 6, lastScoredAt: "2026-08-18T00:00:00Z" });
  assert.deepEqual(await getStreak(WS), { weeks: 4, best: 6, lastScoredAt: "2026-08-18T00:00:00Z" });
});

test("saveStreak sanitizes on write, and never lowers the all-time best", async () => {
  // Prior test left {weeks:4, best:6}. A quiet-week reset with a lower best must
  // keep best at 6 (best is never lowered) while weeks drops to 0.
  await saveStreak(WS, { weeks: -1, best: 3, lastScoredAt: "2026-08-25T00:00:00Z" });
  assert.deepEqual(await getStreak(WS), { weeks: 0, best: 6, lastScoredAt: "2026-08-25T00:00:00Z" });
});
