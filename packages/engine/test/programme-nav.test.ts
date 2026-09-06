import test from "node:test";
import assert from "node:assert/strict";
import { allLessons } from "../src/curriculum.ts";
import type { Enrollment, LessonStatus } from "../src/enrollment.ts";
import { LEARNER_MENU, buildProgrammeMap, nextAction } from "../src/programme-nav.ts";
import { CANONICAL_PROGRAMME } from "../src/curriculum-content.ts";

const PROGRAMME = CANONICAL_PROGRAMME;
const ALL_IDS = allLessons(PROGRAMME).map((l) => l.id);

function enrollment(statuses: Record<string, LessonStatus> = {}): Enrollment {
  return {
    id: "e", programmeId: PROGRAMME.id, workspaceId: "w", userId: "u", deliveryMode: "self_paced", startedAt: "t",
    lessons: Object.entries(statuses).map(([lessonId, status]) => ({ lessonId, status, submissions: [] })),
  };
}
const allCompleted = (): Record<string, LessonStatus> => Object.fromEntries(ALL_IDS.map((id) => [id, "completed" as LessonStatus]));
// Every module in a chapter, approved — used to open the next chapter.
const chapterModules = (stageId: string) => PROGRAMME.stages.find((s) => s.id === stageId)!.lessons.map((l) => l.id);
const approve = (stageIds: string[]): Record<string, LessonStatus> =>
  Object.fromEntries(stageIds.flatMap(chapterModules).map((id) => [id, "approved" as LessonStatus]));

// ── Menu ─────────────────────────────────────────────────────────────────────
test("LEARNER_MENU: exactly the five canonical destinations, in order", () => {
  assert.deepEqual(LEARNER_MENU.map((d) => d.id), ["home", "programme", "my-business", "coaching", "resources"]);
  assert.equal(LEARNER_MENU.length, 5);
});

// ── Programme map ─────────────────────────────────────────────────────────────
test("map: fresh learner — Start is current, its module available, every chapter after locked", () => {
  const map = buildProgrammeMap(PROGRAMME, enrollment());
  assert.deepEqual(map.nodes.map((n) => n.stageId), ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"]);
  assert.deepEqual(map.arc, ["uncertainty", "clarity", "confidence", "control", "momentum", "freedom"]);
  const start = map.nodes[0];
  assert.equal(start.status, "current");
  assert.equal(start.lessons[0].status, "available");
  assert.equal(map.nodes[1].status, "locked"); // chapter-1
  assert.equal(map.nodes[1].lessons[0].status, "locked"); // its first module locked until Start is done
  assert.equal(map.currentStageId, "start");
  assert.equal(map.currentLessonId, "m-start-assessment");
  assert.equal(map.overallPercent, 0);
});

test("map: every canonical node carries its psychological state + output name", () => {
  const map = buildProgrammeMap(PROGRAMME, enrollment());
  const byId = Object.fromEntries(map.nodes.map((n) => [n.stageId, n]));
  assert.equal(byId["chapter-1"].state, "clarity");
  assert.equal(byId["chapter-1"].output, "Business Psychology Blueprint");
  assert.equal(byId["chapter-2"].output, "Implemented Business System");
  assert.equal(byId["chapter-4"].state, "momentum");
  assert.equal(byId["chapter-4"].output, "Growth & Improvement Plan");
  assert.equal(byId["finish"].state, "freedom");
  assert.equal(byId["finish"].output, "Transformation Report");
});

test("map: fully-complete learner — all nodes complete, 100%, no current lesson", () => {
  const map = buildProgrammeMap(PROGRAMME, enrollment(allCompleted()));
  assert.ok(map.nodes.every((n) => n.status === "complete"));
  assert.equal(map.overallPercent, 100);
  assert.equal(map.currentLessonId, null);
  assert.equal(map.currentStageId, null);
});

test("map: partway — Start complete, Chapter 1 current, later chapters locked", () => {
  const map = buildProgrammeMap(PROGRAMME, enrollment(approve(["start"])));
  const byId = Object.fromEntries(map.nodes.map((n) => [n.stageId, n]));
  assert.equal(byId["start"].status, "complete");
  assert.equal(byId["chapter-1"].status, "current");
  assert.equal(byId["chapter-2"].status, "locked");
  assert.equal(map.currentStageId, "chapter-1");
  assert.equal(map.currentLessonId, "m-founder-psychology");
});

test("map: a cohort pacing cap locks chapters beyond the cap even when sequentially available", () => {
  // Start + all of Chapter 1 approved → Chapter 2 would be sequentially available…
  const done = approve(["start", "chapter-1"]);
  // …but a cap at stage order 1 (Chapter 1) keeps Chapter 2 (order 2) locked.
  const map = buildProgrammeMap(PROGRAMME, enrollment(done), 1);
  const byId = Object.fromEntries(map.nodes.map((n) => [n.stageId, n]));
  assert.equal(byId["chapter-1"].status, "complete");
  assert.equal(byId["chapter-2"].status, "locked");
  assert.ok(byId["chapter-2"].lessons.every((l) => l.status === "locked"));
});

// ── Next action ───────────────────────────────────────────────────────────────
test("nextAction: fresh learner is told to Start, pointed at the first module", () => {
  const na = nextAction(PROGRAMME, enrollment());
  assert.equal(na.ctaLabel, "Start the programme");
  assert.equal(na.currentLessonId, "m-start-assessment");
  assert.equal(na.currentLessonTitle, "Personal & Business Assessment");
  assert.equal(na.ctaHref, "/programme");
  assert.equal(na.done, false);
  assert.equal(na.overallPercent, 0);
});

test("nextAction: a learner in progress is told to Continue", () => {
  const na = nextAction(PROGRAMME, enrollment(approve(["start"])));
  assert.equal(na.ctaLabel, "Continue Programme");
  assert.equal(na.currentLessonId, "m-founder-psychology");
  assert.equal(na.done, false);
});

test("nextAction: a finished learner is pointed at the Transformation Report", () => {
  const na = nextAction(PROGRAMME, enrollment(allCompleted()));
  assert.equal(na.done, true);
  assert.equal(na.ctaLabel, "View your Transformation Report");
  assert.equal(na.currentLessonId, null);
  assert.equal(na.ctaHref, "/programme");
  assert.equal(na.overallPercent, 100);
});
