import test from "node:test";
import assert from "node:assert/strict";
import { orderedStages, orderedLessons, allLessons, findLesson, totalLessonCount, type ProgrammeTemplate } from "../src/curriculum.ts";

function programme(): ProgrammeTemplate {
  return {
    id: "p1", name: "Test Programme", status: "published", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { id: "s2", order: 2, title: "Second", outcome: "o", lessons: [{ id: "l2b", order: 2, title: "L2b", outcome: "o", content: "c" }, { id: "l2a", order: 1, title: "L2a", outcome: "o", content: "c" }] },
      { id: "s1", order: 1, title: "First", outcome: "o", lessons: [{ id: "l1a", order: 1, title: "L1a", outcome: "o", content: "c" }] },
    ],
  };
}

test("orderedStages: sorts by order regardless of array insertion order", () => {
  const stages = orderedStages(programme());
  assert.deepEqual(stages.map((s) => s.id), ["s1", "s2"]);
});

test("orderedLessons: sorts a stage's lessons by order", () => {
  const stages = orderedStages(programme());
  const s2 = stages.find((s) => s.id === "s2")!;
  assert.deepEqual(orderedLessons(s2).map((l) => l.id), ["l2a", "l2b"]);
});

test("allLessons: flattens every stage's lessons in curriculum order", () => {
  const lessons = allLessons(programme());
  assert.deepEqual(lessons.map((l) => l.id), ["l1a", "l2a", "l2b"]);
});

test("findLesson: locates a lesson and its owning stage by id", () => {
  const found = findLesson(programme(), "l2b");
  assert.equal(found?.stage.id, "s2");
  assert.equal(found?.lesson.title, "L2b");
});

test("findLesson: returns null for an unknown lesson id", () => {
  assert.equal(findLesson(programme(), "nonexistent"), null);
});

test("totalLessonCount: sums lessons across every stage", () => {
  assert.equal(totalLessonCount(programme()), 3);
});
