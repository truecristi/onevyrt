import test from "node:test";
import assert from "node:assert/strict";
import { effectiveStatus, summarizeEnrollment, newEnrollment, capStatusByStage, remapEnrollmentLessonIds, type Enrollment, type Submission } from "../src/enrollment.ts";
import type { ProgrammeTemplate } from "../src/curriculum.ts";

function programme(): ProgrammeTemplate {
  return {
    id: "p1", name: "Test Programme", status: "published", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { id: "s1", order: 1, title: "Stage 1", outcome: "o", lessons: [
        { id: "l1", order: 1, title: "L1", outcome: "o", content: "c" },
        { id: "l2", order: 2, title: "L2", outcome: "o", content: "c" },
        { id: "l3", order: 3, title: "L3", outcome: "o", content: "c" },
      ] },
    ],
  };
}
function submission(over: Partial<Submission>): Submission {
  return { id: "sub1", submittedAt: "2026-01-01T00:00:00.000Z", evidence: "done", checklistChecked: [], reviewStatus: "pending", ...over };
}

test("effectiveStatus: the very first lesson is available with no stored state at all", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  assert.equal(effectiveStatus(programme(), e, "l1"), "available");
});

test("effectiveStatus: every lesson after the first is locked until the one before it is approved", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  assert.equal(effectiveStatus(programme(), e, "l2"), "locked");
  assert.equal(effectiveStatus(programme(), e, "l3"), "locked");
});

test("effectiveStatus: approving lesson 1 unlocks lesson 2, but not lesson 3 yet", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  e.lessons.push({ lessonId: "l1", status: "approved", submissions: [] });
  assert.equal(effectiveStatus(programme(), e, "l2"), "available");
  assert.equal(effectiveStatus(programme(), e, "l3"), "locked");
});

test("effectiveStatus: an explicit stored status always wins over the computed default", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  e.lessons.push({ lessonId: "l2", status: "in_progress", submissions: [] });
  assert.equal(effectiveStatus(programme(), e, "l2"), "in_progress");
});

test("summarizeEnrollment: a brand-new enrollment is 0% complete with lesson 1 current", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  const s = summarizeEnrollment(programme(), e);
  assert.equal(s.totalLessons, 3);
  assert.equal(s.completedLessons, 0);
  assert.equal(s.percentComplete, 0);
  assert.equal(s.currentLessonId, "l1");
  assert.deepEqual(s.awaitingReview, []);
});

test("summarizeEnrollment: counts approved lessons and rounds the percentage", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  e.lessons.push({ lessonId: "l1", status: "approved", submissions: [] });
  const s = summarizeEnrollment(programme(), e);
  assert.equal(s.completedLessons, 1);
  assert.equal(s.percentComplete, 33); // 1/3 rounded
  assert.equal(s.currentLessonId, "l2");
});

test("summarizeEnrollment: a pending submission surfaces in awaitingReview", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  e.lessons.push({ lessonId: "l1", status: "submitted", submissions: [submission({})] });
  const s = summarizeEnrollment(programme(), e);
  assert.equal(s.awaitingReview.length, 1);
  assert.equal(s.awaitingReview[0].lessonId, "l1");
});

test("summarizeEnrollment: a reviewed (approved) submission does not show up as awaiting review", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  e.lessons.push({ lessonId: "l1", status: "approved", submissions: [submission({ reviewStatus: "approved", reviewedBy: "coach@x.com" })] });
  const s = summarizeEnrollment(programme(), e);
  assert.equal(s.awaitingReview.length, 0);
});

test("summarizeEnrollment: changes-requested lessons are listed separately from awaitingReview", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "self_paced");
  e.lessons.push({ lessonId: "l1", status: "changes_requested", submissions: [submission({ reviewStatus: "changes_requested" })] });
  const s = summarizeEnrollment(programme(), e);
  assert.deepEqual(s.changesRequested, ["l1"]);
});

test("newEnrollment: starts with no lesson entries — every status is computed, nothing pre-populated", () => {
  const e = newEnrollment("e1", "p1", "ws1", "u1", "cohort");
  assert.deepEqual(e.lessons, []);
  assert.equal(e.deliveryMode, "cohort");
});

function twoStageProgramme(): ProgrammeTemplate {
  return {
    id: "p2", name: "Two Stage", status: "published", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { id: "s1", order: 0, title: "Stage 0", outcome: "o", lessons: [{ id: "l1", order: 1, title: "L1", outcome: "o", content: "c" }] },
      { id: "s2", order: 1, title: "Stage 1", outcome: "o", lessons: [{ id: "l2", order: 1, title: "L2", outcome: "o", content: "c" }] },
    ],
  };
}

test("capStatusByStage: no cap (null/undefined) leaves status untouched", () => {
  const p = twoStageProgramme();
  assert.equal(capStatusByStage(p, "l2", "available", null), "available");
  assert.equal(capStatusByStage(p, "l2", "available", undefined), "available");
});

test("capStatusByStage: locks an otherwise-available lesson whose stage is past the cap", () => {
  const p = twoStageProgramme();
  assert.equal(capStatusByStage(p, "l2", "available", 0), "locked");
});

test("capStatusByStage: leaves a lesson within the cap alone", () => {
  const p = twoStageProgramme();
  assert.equal(capStatusByStage(p, "l1", "available", 0), "available");
  assert.equal(capStatusByStage(p, "l2", "available", 1), "available");
});

test("capStatusByStage: never re-locks a lesson that already has real progress", () => {
  const p = twoStageProgramme();
  assert.equal(capStatusByStage(p, "l2", "in_progress", 0), "in_progress");
  assert.equal(capStatusByStage(p, "l2", "submitted", 0), "submitted");
  assert.equal(capStatusByStage(p, "l2", "approved", 0), "approved");
});

test("capStatusByStage: an unknown lesson id is left untouched rather than throwing", () => {
  const p = twoStageProgramme();
  assert.equal(capStatusByStage(p, "does-not-exist", "available", 0), "available");
});

// ── remapEnrollmentLessonIds (the v2→v3 progress bridge) ─────────────────────
test("remapEnrollmentLessonIds: renames ids and leaves unmapped ones untouched", () => {
  const e: Enrollment = {
    id: "e", programmeId: "p", workspaceId: "w", userId: "u", deliveryMode: "self_paced", startedAt: "t",
    lessons: [
      { lessonId: "l-0-1", status: "approved", submissions: [] },
      { lessonId: "adm-custom", status: "in_progress", submissions: [] },
    ],
  };
  const out = remapEnrollmentLessonIds(e, { "l-0-1": "m-start-assessment" });
  assert.deepEqual(out.lessons.map((l) => l.lessonId), ["m-start-assessment", "adm-custom"]);
  assert.equal(out.lessons[0].status, "approved");
  // pure: input not mutated
  assert.equal(e.lessons[0].lessonId, "l-0-1");
});

test("remapEnrollmentLessonIds: collapses two old lessons onto one module — keeps the most-advanced status and unions submissions", () => {
  const e: Enrollment = {
    id: "e", programmeId: "p", workspaceId: "w", userId: "u", deliveryMode: "self_paced", startedAt: "t",
    lessons: [
      { lessonId: "l-7-1", status: "in_progress", startedAt: "2026-02-01T00:00:00Z",
        submissions: [submission({ id: "s-a", submittedAt: "2026-02-02T00:00:00Z" })] },
      { lessonId: "l-7-2", status: "approved", startedAt: "2026-01-15T00:00:00Z",
        submissions: [submission({ id: "s-b", submittedAt: "2026-01-20T00:00:00Z", reviewStatus: "approved" })] },
    ],
  };
  const out = remapEnrollmentLessonIds(e, { "l-7-1": "m-sales-system", "l-7-2": "m-sales-system" });
  assert.equal(out.lessons.length, 1);
  const merged = out.lessons[0];
  assert.equal(merged.lessonId, "m-sales-system");
  assert.equal(merged.status, "approved"); // most-advanced of in_progress vs approved
  assert.equal(merged.startedAt, "2026-01-15T00:00:00Z"); // earliest
  assert.deepEqual(merged.submissions.map((s) => s.id), ["s-b", "s-a"]); // union, oldest first
});

test("remapEnrollmentLessonIds: dedupes submissions by id when merging", () => {
  const e: Enrollment = {
    id: "e", programmeId: "p", workspaceId: "w", userId: "u", deliveryMode: "self_paced", startedAt: "t",
    lessons: [
      { lessonId: "l-9-1", status: "submitted", submissions: [submission({ id: "dup" })] },
      { lessonId: "l-9-2", status: "in_progress", submissions: [submission({ id: "dup" })] },
    ],
  };
  const out = remapEnrollmentLessonIds(e, { "l-9-1": "m-improvement-loop", "l-9-2": "m-improvement-loop" });
  assert.equal(out.lessons.length, 1);
  assert.equal(out.lessons[0].submissions.length, 1);
});
