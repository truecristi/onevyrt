import test from "node:test";
import assert from "node:assert/strict";
import { computeProgramProgress, isLessonDone, LESSON_KEYS, type ProgramProgressCtx } from "../lib/program-progress";

function emptyCtx(over: Partial<ProgramProgressCtx> = {}): ProgramProgressCtx {
  return { definition: {}, forceActions: [], mindfulness: [], clientPromises: [], ravingFansInputs: { retentionRate: 0, referralRate: 0 }, visitedLessons: [], ...over };
}

test("computeProgramProgress: nothing done on a totally fresh project", () => {
  const p = computeProgramProgress(emptyCtx());
  assert.equal(p.doneCount, 0);
  assert.equal(p.total, LESSON_KEYS.length);
  assert.equal(p.firstIncomplete, "define");
  assert.equal(p.allDone, false);
});

test("isLessonDone: define needs both a business name and a main offer, not just one", () => {
  assert.equal(isLessonDone("define", emptyCtx({ definition: { businessName: "Acme" } })), false);
  assert.equal(isLessonDone("define", emptyCtx({ definition: { businessName: "Acme", mainOffer: "Widgets" } })), true);
});

test("isLessonDone: money/drivers/brief are done once visited, regardless of data", () => {
  assert.equal(isLessonDone("money", emptyCtx()), false);
  assert.equal(isLessonDone("money", emptyCtx({ visitedLessons: ["money"] })), true);
  assert.equal(isLessonDone("drivers", emptyCtx({ visitedLessons: ["money"] })), false);
  assert.equal(isLessonDone("brief", emptyCtx({ visitedLessons: ["brief", "money"] })), true);
});

test("isLessonDone: forces is done once any action item exists", () => {
  const ctx = emptyCtx({ forceActions: [{ id: "a", force: 1, principle: "p", actionItem: "x", status: "open", priority: "medium", createdAt: "2026-01-01T00:00:00.000Z" }] });
  assert.equal(isLessonDone("forces", ctx), true);
});

test("computeProgramProgress: firstIncomplete advances as lessons complete in order", () => {
  const ctx = emptyCtx({ definition: { businessName: "Acme", mainOffer: "Widgets" } });
  assert.equal(computeProgramProgress(ctx).firstIncomplete, "story");
});

test("computeProgramProgress: allDone is true only when every lesson is done", () => {
  const ctx: ProgramProgressCtx = {
    definition: { businessName: "Acme", mainOffer: "Widgets", currentState: "reactive", weeklyFocus: "follow up" },
    forceActions: [{ id: "a", force: 1, principle: "p", actionItem: "x", status: "open", priority: "medium", createdAt: "2026-01-01T00:00:00.000Z" }],
    mindfulness: [], clientPromises: [{ id: "c", promise: "fast reply", delivered: true, createdAt: "2026-01-01T00:00:00.000Z" }],
    ravingFansInputs: { retentionRate: 0, referralRate: 0 },
    visitedLessons: ["money", "drivers", "brief"],
  };
  const p = computeProgramProgress(ctx);
  assert.equal(p.doneCount, 8);
  assert.equal(p.allDone, true);
  assert.equal(p.firstIncomplete, null);
});
