import test from "node:test";
import assert from "node:assert/strict";
import type { Enrollment, LessonStatus } from "../src/enrollment.ts";
import { chapterGates, type ChapterSubmission } from "../src/chapter-gates.ts";
import { CANONICAL_PROGRAMME } from "../src/curriculum-content.ts";

const PROGRAMME = CANONICAL_PROGRAMME;

function enrollment(statuses: Record<string, LessonStatus> = {}): Enrollment {
  return {
    id: "e", programmeId: PROGRAMME.id, workspaceId: "w", userId: "u", deliveryMode: "self_paced", startedAt: "t",
    lessons: Object.entries(statuses).map(([lessonId, status]) => ({ lessonId, status, submissions: [] })),
  };
}
const lessonsIn = (stageId: string) => PROGRAMME.stages.find((s) => s.id === stageId)!.lessons.map((l) => l.id);
const approveAll = (stageIds: string[]): Record<string, LessonStatus> =>
  Object.fromEntries(stageIds.flatMap(lessonsIn).map((id) => [id, "approved" as LessonStatus]));
const sub = (stageId: string, reviewStatus: ChapterSubmission["reviewStatus"]): ChapterSubmission =>
  ({ stageId, submittedAt: "2026-01-01T00:00:00Z", evidence: "the output", reviewStatus });
const gateFor = (gates: ReturnType<typeof chapterGates>, id: string) => gates.find((g) => g.stageId === id)!;

test("gates: fresh learner — Start is in progress, every later chapter is locked", () => {
  const g = chapterGates(PROGRAMME, enrollment(), []);
  assert.deepEqual(g.map((x) => x.stageId), ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"]);
  assert.equal(gateFor(g, "start").state, "in_progress");
  assert.equal(gateFor(g, "chapter-1").state, "locked");
  assert.equal(gateFor(g, "chapter-4").state, "locked");
  assert.equal(gateFor(g, "finish").state, "locked");
});

test("gates: all of a chapter's lessons done, no submission → ready_to_submit (next still locked)", () => {
  const g = chapterGates(PROGRAMME, enrollment(approveAll(["start"])), []);
  assert.equal(gateFor(g, "start").state, "ready_to_submit");
  assert.equal(gateFor(g, "start").lessonsComplete, gateFor(g, "start").lessonsTotal);
  assert.equal(gateFor(g, "chapter-1").state, "locked");
});

test("gates: a submitted chapter awaits coach review", () => {
  const g = chapterGates(PROGRAMME, enrollment(approveAll(["start"])), [sub("start", "submitted")]);
  assert.equal(gateFor(g, "start").state, "awaiting_review");
  assert.equal(gateFor(g, "chapter-1").state, "locked"); // still gated until approved
});

test("gates: coach approval unlocks the next chapter", () => {
  const g = chapterGates(PROGRAMME, enrollment(approveAll(["start"])), [sub("start", "approved")]);
  assert.equal(gateFor(g, "start").state, "approved");
  assert.equal(gateFor(g, "start").unlocksNext, true);
  assert.equal(gateFor(g, "chapter-1").state, "in_progress"); // unlocked, lessons still to do
  assert.equal(gateFor(g, "chapter-2").state, "locked"); // but chapter-2 stays gated
});

test("gates: changes_requested does NOT unlock the next chapter", () => {
  const g = chapterGates(PROGRAMME, enrollment(approveAll(["start"])), [sub("start", "changes_requested")]);
  assert.equal(gateFor(g, "start").state, "changes_requested");
  assert.equal(gateFor(g, "start").unlocksNext, false);
  assert.equal(gateFor(g, "chapter-1").state, "locked");
});

test("gates: approving every chapter in turn walks the gate open to Finish", () => {
  const all = ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"];
  const g = chapterGates(
    PROGRAMME,
    enrollment(approveAll(all)),
    all.map((id) => sub(id, "approved")),
  );
  assert.ok(g.every((x) => x.state === "approved"));
  assert.ok(g.every((x) => x.unlocksNext));
});

test("gates: Chapter 4 unlocks only after Chapter 3 is approved, and gates Finish behind its own approval", () => {
  // Chapter 3 done and approved, Chapter 4's lessons not started yet.
  const approvedThroughCh3 = ["start", "chapter-1", "chapter-2", "chapter-3"];
  let g = chapterGates(
    PROGRAMME,
    enrollment(approveAll(approvedThroughCh3)),
    approvedThroughCh3.map((id) => sub(id, "approved")),
  );
  assert.equal(gateFor(g, "chapter-4").state, "in_progress"); // unlocked, lessons still to do
  assert.equal(gateFor(g, "finish").state, "locked"); // Finish still gated on Chapter 4

  // Chapter 4's lessons all done, output submitted but not yet reviewed.
  g = chapterGates(
    PROGRAMME,
    enrollment(approveAll([...approvedThroughCh3, "chapter-4"])),
    [...approvedThroughCh3.map((id) => sub(id, "approved")), sub("chapter-4", "submitted")],
  );
  assert.equal(gateFor(g, "chapter-4").state, "awaiting_review");
  assert.equal(gateFor(g, "finish").state, "locked");

  // Coach approves Chapter 4 — Finish unlocks.
  g = chapterGates(
    PROGRAMME,
    enrollment(approveAll([...approvedThroughCh3, "chapter-4"])),
    [...approvedThroughCh3.map((id) => sub(id, "approved")), sub("chapter-4", "approved")],
  );
  assert.equal(gateFor(g, "chapter-4").state, "approved");
  assert.equal(gateFor(g, "chapter-4").unlocksNext, true);
  assert.equal(gateFor(g, "finish").state, "in_progress"); // unlocked
});

test("gates: the latest submission for a chapter wins", () => {
  const subs: ChapterSubmission[] = [
    { stageId: "start", submittedAt: "2026-01-01T00:00:00Z", evidence: "v1", reviewStatus: "changes_requested" },
    { stageId: "start", submittedAt: "2026-02-01T00:00:00Z", evidence: "v2", reviewStatus: "approved" },
  ];
  const g = chapterGates(PROGRAMME, enrollment(approveAll(["start"])), subs);
  assert.equal(gateFor(g, "start").state, "approved");
  assert.equal(gateFor(g, "start").submission?.evidence, "v2");
});
