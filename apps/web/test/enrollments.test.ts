import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as enrollments from "../lib/enrollments";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

// A minimal programme with one available-by-default lesson ("l-0-1"),
// standing in for the real curriculum this store doesn't itself define.
const testProgramme = {
  id: "prog1", name: "Test", status: "published" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  stages: [{ id: "s0", order: 0, title: "Stage 0", outcome: "o", lessons: [{ id: "l-0-1", order: 0, title: "L1", outcome: "o", content: "c" }] }],
};

const PREFIX = uid("enrollments-test");
const ws = (n: string) => `${PREFIX}-ws-${n}`;

after(async () => {
  await pgPool().query("DELETE FROM enrollments WHERE workspace_id LIKE $1", [`${PREFIX}%`]);
  await pgPool().query("DELETE FROM workspaces WHERE id LIKE $1", [`${PREFIX}%`]);
});

/** submitAssignment reads the real `workspaces` row to decide hasCoach (see
 *  lib/enrollments.ts's header: self-paced + no coach auto-approves, since
 *  there's nobody to ever review it otherwise). Every test below is about the
 *  MANUAL-review path, so it needs a real workspace with a manager — without
 *  one, getWorkspace() finds nothing, hasCoach is always false, and every
 *  submission here would auto-approve regardless of what's being tested. */
async function seedWorkspaceWithCoach(workspaceId: string): Promise<void> {
  await pgPool().query(
    "INSERT INTO workspaces (id, name, owner_id, members, created_at) VALUES ($1, 'Test WS', 'u1', $2, now())",
    [workspaceId, JSON.stringify([{ userId: "u1", role: "owner" }, { userId: "coach1", role: "manager" }])],
  );
}

test("getOrCreateEnrollment: is idempotent — a second call returns the exact same enrollment, not a new one", async () => {
  const workspaceId = ws("1");
  const first = await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const second = await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  assert.equal(first.id, second.id);
});

test("submitAssignment: rejects empty evidence rather than recording a blank submission", async () => {
  const workspaceId = ws("2");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const result = await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "   ", [], testProgramme, null);
  assert.ok("error" in result);
});

test("submitAssignment: rejects a locked lesson even if the client asks anyway", async () => {
  const workspaceId = ws("3");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const result = await enrollments.submitAssignment(workspaceId, "does-not-exist-in-programme", "u1", "evidence", [], testProgramme, null);
  assert.ok("error" in result);
});

test("submitAssignment: rejects when a coach has paused access, even to an otherwise-available lesson", async () => {
  const workspaceId = ws("4");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.setAccessGranted(workspaceId, false);
  const result = await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "real evidence", [], testProgramme, null);
  assert.ok("error" in result);
});

test("submitAssignment: a cohort's stage cap locks a lesson past the cap", async () => {
  const workspaceId = ws("5");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const result = await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "evidence", [], testProgramme, -1);
  assert.ok("error" in result);
});

test("submitAssignment: a real submission is recorded pending, and moves the lesson to 'submitted'", async () => {
  const workspaceId = ws("6");
  await seedWorkspaceWithCoach(workspaceId);
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const result = await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "Revenue $5k, profit $2k", ["c1", "c2"], testProgramme, null);
  assert.ok(!("error" in result));
  assert.equal((result as { reviewStatus: string }).reviewStatus, "pending");
  const enrollment = await enrollments.getEnrollment(workspaceId);
  const entry = enrollment!.lessons.find((l) => l.lessonId === "l-0-1");
  assert.equal(entry?.status, "submitted");
  assert.equal(entry?.submissions.length, 1);
});

test("reviewSubmission: approving moves the lesson to 'approved' and stamps the reviewer", async () => {
  const workspaceId = ws("7");
  await seedWorkspaceWithCoach(workspaceId);
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "real evidence", [], testProgramme, null);
  const ok = await enrollments.reviewSubmission(workspaceId, "l-0-1", "approved", "coach@example.com", "Nice work.");
  assert.equal(ok, true);
  const enrollment = await enrollments.getEnrollment(workspaceId);
  const entry = enrollment!.lessons.find((l) => l.lessonId === "l-0-1");
  assert.equal(entry?.status, "approved");
  assert.equal(entry?.submissions[0]?.reviewStatus, "approved");
  assert.equal(entry?.submissions[0].reviewedBy, "coach@example.com");
  assert.equal(entry?.submissions[0].coachFeedback, "Nice work.");
});

test("reviewSubmission: requesting changes is a distinct outcome from approval, and both are terminal for that submission", async () => {
  const workspaceId = ws("8");
  await seedWorkspaceWithCoach(workspaceId);
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "real evidence", [], testProgramme, null);
  await enrollments.reviewSubmission(workspaceId, "l-0-1", "changes_requested", "coach@example.com", "Add your conversion rate too.");
  const enrollment = await enrollments.getEnrollment(workspaceId);
  const entry = enrollment!.lessons.find((l) => l.lessonId === "l-0-1");
  assert.equal(entry?.status, "changes_requested");
});

test("reviewSubmission: reviewing a lesson with no pending submission is a no-op, not a crash", async () => {
  const workspaceId = ws("9");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const ok = await enrollments.reviewSubmission(workspaceId, "l-0-1", "approved", "coach@example.com");
  assert.equal(ok, false);
});

test("startLesson: marks an untouched lesson in_progress, but never regresses a lesson that's already further along", async () => {
  const workspaceId = ws("10");
  await seedWorkspaceWithCoach(workspaceId);
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.submitAssignment(workspaceId, "l-0-1", "u1", "real evidence", [], testProgramme, null);
  await enrollments.startLesson(workspaceId, "l-0-1", testProgramme, null); // already "submitted" — must not overwrite
  const enrollment = await enrollments.getEnrollment(workspaceId);
  const entry = enrollment!.lessons.find((l) => l.lessonId === "l-0-1");
  assert.equal(entry?.status, "submitted");
});

test("startLesson: is a no-op on a locked lesson", async () => {
  const workspaceId = ws("11");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.startLesson(workspaceId, "does-not-exist-in-programme", testProgramme, null);
  const enrollment = await enrollments.getEnrollment(workspaceId);
  assert.equal(enrollment?.lessons.length, 0);
});

test("setCoachNotes: sets and clears a private note, independent of anything the learner touches", async () => {
  const workspaceId = ws("12");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.setCoachNotes(workspaceId, "Struggling with pricing confidence.");
  let enrollment = await enrollments.getEnrollment(workspaceId);
  assert.equal(enrollment?.coachNotes, "Struggling with pricing confidence.");
  await enrollments.setCoachNotes(workspaceId, "   ");
  enrollment = await enrollments.getEnrollment(workspaceId);
  assert.equal(enrollment?.coachNotes, undefined);
});

test("setAccessGranted: revoking then restoring access round-trips cleanly", async () => {
  const workspaceId = ws("13");
  await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  await enrollments.setAccessGranted(workspaceId, false);
  let enrollment = await enrollments.getEnrollment(workspaceId);
  assert.equal(enrollment?.accessGranted, false);
  await enrollments.setAccessGranted(workspaceId, true);
  enrollment = await enrollments.getEnrollment(workspaceId);
  assert.equal(enrollment?.accessGranted, undefined);
});

// Same read-modify-write shape as every other store in this app. Lessons
// are pre-seeded as "in_progress" (an explicit stored status effectiveStatus
// honours immediately) so the race under test is the lock, not the
// unrelated question of whether each lesson happens to be unlocked yet.
test("submitAssignment: concurrent submissions to different lessons in the same workspace don't lose any of them", async () => {
  const workspaceId = ws("14");
  const enrollment = await enrollments.getOrCreateEnrollment(workspaceId, "u1", "prog1");
  const LESSON_COUNT = 30;
  enrollment.lessons = Array.from({ length: LESSON_COUNT }, (_, i) => ({ lessonId: `lesson-${i}`, status: "in_progress" as const, submissions: [] }));
  await pgPool().query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
    [workspaceId, JSON.stringify(enrollment)],
  );
  await Promise.all(Array.from({ length: LESSON_COUNT }, (_, i) => enrollments.submitAssignment(workspaceId, `lesson-${i}`, "u1", `evidence ${i}`, [], testProgramme, null)));
  const after = await enrollments.getEnrollment(workspaceId);
  assert.equal(after?.lessons.length, LESSON_COUNT, "some concurrent submissions were lost to a write race");
});
