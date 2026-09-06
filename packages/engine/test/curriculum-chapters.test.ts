import test from "node:test";
import assert from "node:assert/strict";
import type { ProgrammeTemplate, LessonTemplate } from "../src/curriculum.ts";
import { allLessons, totalLessonCount } from "../src/curriculum.ts";
import {
  CURRICULUM_SCHEMA_VERSION,
  CANONICAL_STAGES,
  CANONICAL_LESSON_LAYOUT,
  LESSON_TO_STAGE,
  LEGACY_STAGE_ID,
  reconcileToChapters,
  remapStageAccessLimit,
  remapStageAccessLimitForChapter4,
  canonicalStageOrderOfLesson,
  isCanonical,
} from "../src/curriculum-chapters.ts";
import { CANONICAL_PROGRAMME, buildCanonicalProgramme } from "../src/curriculum-content.ts";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Every module id in the canonical layout (25 modules across the six stages). */
const ALL_MODULE_IDS = CANONICAL_LESSON_LAYOUT.flatMap((g) => g.lessonIds);

/** A fresh, un-stamped copy of the canonical programme (schemaVersion absent, so
 *  isCanonical() is false until reconcileToChapters stamps it). */
function canonicalRaw(): ProgrammeTemplate {
  return structuredClone(buildCanonicalProgramme());
}

// ── reconcileToChapters ─────────────────────────────────────────────────────

test("reconcile: produces exactly the six canonical stages in order", () => {
  const out = reconcileToChapters(canonicalRaw());
  assert.deepEqual(
    out.stages.map((s) => s.id),
    ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"],
  );
  assert.deepEqual(out.stages.map((s) => s.order), [0, 1, 2, 3, 4, 5]);
  // titles come from the canonical metadata
  assert.equal(out.stages[1].title, CANONICAL_STAGES[1].title);
});

test("reconcile: preserves every module id exactly once — nothing lost or duplicated", () => {
  const out = reconcileToChapters(canonicalRaw());
  const ids = allLessons(out).map((l) => l.id).sort();
  assert.equal(ids.length, 25);
  assert.deepEqual(ids, [...ALL_MODULE_IDS].sort());
  assert.equal(new Set(ids).size, 25); // no duplicates
  assert.equal(totalLessonCount(out), 25);
});

test("reconcile: preserves assignment + checklist ids (modules are moved, not rewritten)", () => {
  const out = reconcileToChapters(canonicalRaw());
  const start = allLessons(out).find((l) => l.id === "m-start-assessment");
  assert.ok(start);
  assert.equal(start.assignment?.id, "a-start-assessment");
  assert.deepEqual(start.assignment?.checklist.map((c) => c.id), ["c1", "c2", "c3", "c4"]);
  // content untouched — same as the authored module
  const authored = CANONICAL_PROGRAMME.stages.flatMap((s) => s.lessons).find((l) => l.id === "m-start-assessment");
  assert.equal(start.content, authored?.content);
});

test("reconcile: modules land in the intended chapter", () => {
  const out = reconcileToChapters(canonicalRaw());
  const stageOf = (lessonId: string) => out.stages.find((s) => s.lessons.some((l) => l.id === lessonId))?.id;
  assert.equal(stageOf("m-start-assessment"), "start");
  assert.equal(stageOf("m-customer-psychology"), "chapter-1");
  assert.equal(stageOf("m-offer"), "chapter-2");
  assert.equal(stageOf("m-personal-freedom-number"), "chapter-3");
  assert.equal(stageOf("m-bottleneck"), "chapter-4");
  assert.equal(stageOf("m-growth-plan"), "chapter-4");
  assert.equal(stageOf("m-finish-transformation"), "finish");
});

test("reconcile: within every stage, lesson.order is contiguous from 1", () => {
  const out = reconcileToChapters(canonicalRaw());
  for (const stage of out.stages) {
    const orders = stage.lessons.map((l) => l.order);
    assert.deepEqual(orders, orders.map((_, i) => i + 1), `stage ${stage.id} orders`);
  }
});

test("reconcile: stamps the schema version and reports canonical", () => {
  const out = reconcileToChapters(canonicalRaw());
  assert.equal(out.schemaVersion, CURRICULUM_SCHEMA_VERSION);
  assert.equal(isCanonical(out), true);
  assert.equal(isCanonical(canonicalRaw()), false);
});

test("reconcile: is idempotent — running twice equals running once", () => {
  const once = reconcileToChapters(canonicalRaw());
  const twice = reconcileToChapters(once);
  assert.deepEqual(twice, once);
});

test("reconcile: the shipped CANONICAL_PROGRAMME is already at the canonical shape (reconcile is a no-op on it)", () => {
  const out = reconcileToChapters(CANONICAL_PROGRAMME);
  assert.deepEqual(out.stages.map((s) => s.id), ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"]);
  assert.equal(totalLessonCount(out), 25);
});

test("reconcile: does not mutate its input", () => {
  const input = canonicalRaw();
  const snapshot = structuredClone(input);
  reconcileToChapters(input);
  assert.deepEqual(input, snapshot);
});

test("reconcile: an admin/unmapped lesson is preserved in the legacy stage, not dropped", () => {
  const p = canonicalRaw();
  const custom: LessonTemplate = { id: "adm-abc123", order: 3, title: "Custom", outcome: "o", content: "c" };
  p.stages[2].lessons.push(custom); // admin added an extra lesson to a stage
  const out = reconcileToChapters(p);

  const legacy = out.stages.find((s) => s.id === LEGACY_STAGE_ID);
  assert.ok(legacy, "legacy stage exists");
  assert.equal(legacy.order, 6);
  assert.ok(legacy.lessons.some((l) => l.id === "adm-abc123"));
  // the 25 canonical modules are still all present and correctly homed
  const canonicalIds = allLessons(out).map((l) => l.id).filter((id) => id !== "adm-abc123");
  assert.equal(canonicalIds.length, 25);
});

test("reconcile: idempotent even with an unmapped lesson present", () => {
  const p = canonicalRaw();
  p.stages[0].lessons.push({ id: "adm-xyz", order: 3, title: "X", outcome: "o", content: "c" });
  const once = reconcileToChapters(p);
  assert.deepEqual(reconcileToChapters(once), once);
});

test("reconcile: tolerates a missing standard module without crashing", () => {
  const p = canonicalRaw();
  for (const stage of p.stages) stage.lessons = stage.lessons.filter((l) => l.id !== "m-customer-journey");
  const out = reconcileToChapters(p);
  assert.equal(totalLessonCount(out), 24);
  assert.ok(!allLessons(out).some((l) => l.id === "m-customer-journey"));
  assert.ok(allLessons(out).some((l) => l.id === "m-offer")); // its neighbours still placed
});

test("reconcile: legacy v2 lessons (old l-*-* ids) are preserved in legacy, never discarded", () => {
  // A programme still on the old 22-lesson ids, run through the NEW layout: every
  // old lesson is unmapped, so all are preserved in the legacy stage for the
  // enrollment-remap migration to bridge — none are dropped.
  const p: ProgrammeTemplate = {
    id: "onevyrt-growth-programme", name: "P", status: "published", createdAt: "x", updatedAt: "x",
    stages: [{ id: "stage-0", order: 0, title: "S0", outcome: "o", lessons: [
      { id: "l-0-1", order: 1, title: "old", outcome: "o", content: "c" },
      { id: "l-4-1", order: 2, title: "old", outcome: "o", content: "c" },
    ] }],
  };
  const out = reconcileToChapters(p);
  const legacy = out.stages.find((s) => s.id === LEGACY_STAGE_ID);
  assert.ok(legacy);
  assert.deepEqual(legacy.lessons.map((l) => l.id).sort(), ["l-0-1", "l-4-1"]);
});

test("reconcile: a wholly-custom programme keeps all lessons (in legacy) — none discarded", () => {
  const p: ProgrammeTemplate = {
    id: "custom", name: "Custom", status: "draft",
    createdAt: "x", updatedAt: "x",
    stages: [{ id: "s", order: 0, title: "S", outcome: "o", lessons: [{ id: "z1", order: 1, title: "Z", outcome: "o", content: "c" }] }],
  };
  const out = reconcileToChapters(p);
  assert.equal(totalLessonCount(out), 1);
  assert.equal(out.stages.find((s) => s.id === LEGACY_STAGE_ID)?.lessons[0].id, "z1");
});

// ── Layout sanity ───────────────────────────────────────────────────────────

test("layout: covers all 25 modules, each mapped exactly once", () => {
  const laidOut = CANONICAL_LESSON_LAYOUT.flatMap((g) => g.lessonIds);
  assert.equal(laidOut.length, 25);
  assert.equal(new Set(laidOut).size, 25);
  for (const id of ALL_MODULE_IDS) assert.ok(LESSON_TO_STAGE[id], `${id} mapped`);
});

test("canonicalStageOrderOfLesson: known modules vs unmapped", () => {
  assert.equal(canonicalStageOrderOfLesson("m-start-assessment"), 0);
  assert.equal(canonicalStageOrderOfLesson("m-bottleneck"), 4);
  assert.equal(canonicalStageOrderOfLesson("m-finish-transformation"), 5);
  assert.equal(canonicalStageOrderOfLesson("nope"), null);
});

// ── remapStageAccessLimit (the historical v1→v2 cohort-pacing remap) ─────────
// This maps a cohort cap from the old 11-stage order space (0..10) to the new
// five-stage space (0..4). It is validated against the v2 lesson placement (the
// arc the old lessons landed in), which is fixed history — kept here as a local
// map since those old ids are no longer part of the live layout.

const V2_LAYOUT: Readonly<Record<number, readonly string[]>> = {
  0: ["l-0-1", "l-0-2"],
  1: ["l-1-1", "l-1-2", "l-2-1", "l-2-2", "l-3-1", "l-4-1"],
  2: ["l-4-2", "l-5-1", "l-5-2", "l-6-1", "l-6-2", "l-7-1", "l-7-2", "l-8-1", "l-8-2"],
  3: ["l-3-2", "l-9-1", "l-9-2", "l-10-1"],
  4: ["l-10-2"],
};
const ALL_SEED_LESSON_IDS = Object.values(V2_LAYOUT).flat();
const v2StageOrderOf = (id: string): number =>
  Number(Object.entries(V2_LAYOUT).find(([, ids]) => ids.includes(id))![0]);

test("remap: table values match the documented mapping", () => {
  assert.deepEqual(remapStageAccessLimit(null), { value: null, exact: true });
  assert.deepEqual(remapStageAccessLimit(undefined), { value: null, exact: true });
  assert.deepEqual(remapStageAccessLimit(0), { value: 0, exact: true });
  assert.deepEqual(remapStageAccessLimit(1), { value: 0, exact: false });
  assert.deepEqual(remapStageAccessLimit(3), { value: 0, exact: false });
  assert.deepEqual(remapStageAccessLimit(4), { value: 1, exact: false });
  assert.deepEqual(remapStageAccessLimit(7), { value: 1, exact: false });
  assert.deepEqual(remapStageAccessLimit(8), { value: 2, exact: false });
  assert.deepEqual(remapStageAccessLimit(9), { value: 2, exact: false });
  assert.deepEqual(remapStageAccessLimit(10), { value: 4, exact: true });
  assert.deepEqual(remapStageAccessLimit(12), { value: 4, exact: true }); // out-of-range high
  assert.deepEqual(remapStageAccessLimit(-1), { value: -1, exact: false }); // anomalous
});

test("remap: INVARIANT — a remapped cap never unlocks a lesson the old cap kept locked", () => {
  // Old semantics: lesson allowed iff its old stage order (the s in l-s-n) <= oldCap.
  // New semantics: lesson allowed iff its v2 canonical stage order <= newCap.
  // For every old cap, no lesson may become allowed that wasn't before.
  const oldStageOrderOf = (id: string) => Number(id.split("-")[1]);
  for (let oldCap = 0; oldCap <= 10; oldCap++) {
    const { value: newCap } = remapStageAccessLimit(oldCap);
    assert.notEqual(newCap, null);
    for (const id of ALL_SEED_LESSON_IDS) {
      const wasAllowed = oldStageOrderOf(id) <= oldCap;
      const nowAllowed = v2StageOrderOf(id) <= (newCap as number);
      if (nowAllowed) {
        assert.ok(wasAllowed, `oldCap=${oldCap} would newly unlock ${id} (newCap=${newCap})`);
      }
    }
  }
});

test("remap: exact:true only when the lesson sets match precisely", () => {
  // For the two exact caps (0 and >=10), the new cap admits EXACTLY the old set.
  const oldStageOrderOf = (id: string) => Number(id.split("-")[1]);
  for (const oldCap of [0, 10]) {
    const { value: newCap, exact } = remapStageAccessLimit(oldCap);
    assert.equal(exact, true);
    for (const id of ALL_SEED_LESSON_IDS) {
      const wasAllowed = oldStageOrderOf(id) <= oldCap;
      const nowAllowed = v2StageOrderOf(id) <= (newCap as number);
      assert.equal(nowAllowed, wasAllowed, `cap ${oldCap}: ${id} allowed-set mismatch`);
    }
  }
});

// ── remapStageAccessLimitForChapter4 (the v3→v4 Chapter 4 insertion remap) ───
// Chapter 4 is inserted purely additively between chapter-3 (order 3) and
// finish (which moves from order 4 to order 5). Unlike the v1→v2 remap above,
// this one is always exact — no lesson set can ever straddle the insertion in
// a way the old cap didn't already predict.

test("remapStageAccessLimitForChapter4: boundaries below the insertion point are unchanged", () => {
  assert.equal(remapStageAccessLimitForChapter4(0), 0);
  assert.equal(remapStageAccessLimitForChapter4(1), 1);
  assert.equal(remapStageAccessLimitForChapter4(2), 2);
  assert.equal(remapStageAccessLimitForChapter4(3), 3);
});

test("remapStageAccessLimitForChapter4: the old 'everything, including Finish' cap (4) becomes the new one (5)", () => {
  assert.equal(remapStageAccessLimitForChapter4(4), 5);
});

test("remapStageAccessLimitForChapter4: null (uncapped) stays null", () => {
  assert.equal(remapStageAccessLimitForChapter4(null), null);
  assert.equal(remapStageAccessLimitForChapter4(undefined), null);
});

test("remapStageAccessLimitForChapter4: INVARIANT — never re-locks a stage a cohort could already reach", () => {
  // Old semantics (v3, five stages: start=0..finish=4): stage reachable iff
  // its order <= oldCap. New semantics (v4, six stages: start=0..finish=5,
  // chapter-4 inserted at 4): stage reachable iff its NEW order <= newCap.
  // OLD_ORDER_TO_NEW mirrors exactly how each v3 stage's order maps into the
  // v4 space (chapter-4 has no old order at all — it didn't exist yet).
  const OLD_ORDER_TO_NEW: Readonly<Record<number, number>> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 5 };
  for (let oldCap = 0; oldCap <= 4; oldCap++) {
    const newCap = remapStageAccessLimitForChapter4(oldCap);
    assert.notEqual(newCap, null);
    for (const [oldOrderStr, newOrder] of Object.entries(OLD_ORDER_TO_NEW)) {
      const oldOrder = Number(oldOrderStr);
      const wasAllowed = oldOrder <= oldCap;
      const nowAllowed = newOrder <= (newCap as number);
      if (nowAllowed) assert.ok(wasAllowed, `oldCap=${oldCap} would newly unlock old-order ${oldOrder} (newCap=${newCap})`);
    }
  }
});
