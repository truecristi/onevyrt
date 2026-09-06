import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as chapters from "../lib/chapter-submissions";
import type { ChapterSubmission, Enrollment, ProgrammeTemplate } from "@onevyrt/engine";
import { pgPool } from "../lib/db";
import { getDefaultProgramme } from "../lib/curriculum-store";
import { uid } from "./helpers/pg";

// Each test file gets its own collision-safe workspace_id prefix, and cleans
// up whatever rows it created via an `after` hook — same isolation the other
// Postgres-backed store tests use (see test/helpers/pg.ts).
const PREFIX = uid("chapter-submissions-test");
const ws = (n: string) => `${PREFIX}-ws-${n}`;

after(async () => {
  await pgPool().query("DELETE FROM chapter_submissions WHERE workspace_id LIKE $1", [`${PREFIX}%`]);
  await pgPool().query("DELETE FROM enrollments WHERE workspace_id LIKE $1", [`${PREFIX}%`]);
});

// addChapterSubmission/reviewChapterSubmission now gate on the SAME live
// chapterGates() the app itself reads (see lib/chapter-submissions.ts) — a
// stage only accepts a submission when it's actually reachable. "start" is
// the one canonical chapter that's never locked (chapterGates: "the first
// chapter has no predecessor to gate it"), so every test below drives it —
// which chapter is used doesn't matter for what these tests actually check
// (storage/review mechanics, not the cross-chapter unlock chain itself,
// which packages/engine/test/chapter-gates.test.ts already covers in full).
// Marking its lessons "approved" directly (bypassing the real lesson
// submit/review flow, which isn't this file's concern) is exactly what the
// engine's own chapter-gates test does with its `approveAll` helper — this
// just persists the same shape for the real, live default programme instead
// of an in-memory fixture.
let programmeCache: ProgrammeTemplate | null = null;
async function programme(): Promise<ProgrammeTemplate> {
  return (programmeCache ??= await getDefaultProgramme());
}

async function seedStartReady(workspaceId: string): Promise<void> {
  const prog = await programme();
  const start = prog.stages.find((s) => s.id === "start");
  assert.ok(start && start.lessons.length > 0, "the live programme's canonical 'start' stage is missing or has no lessons");
  const enrollment: Enrollment = {
    id: "e", programmeId: prog.id, workspaceId, userId: "u", deliveryMode: "self_paced", startedAt: new Date().toISOString(),
    lessons: start.lessons.map((l) => ({ lessonId: l.id, status: "approved", submissions: [] })),
  };
  await pgPool().query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
    [workspaceId, JSON.stringify(enrollment)],
  );
}

test("listChapterSubmissions: a workspace with no submissions returns [] rather than throwing", async () => {
  const submissions = await chapters.listChapterSubmissions(ws("empty"));
  assert.deepEqual(submissions, []);
});

test("addChapterSubmission: appends a 'submitted' entry stamped with submittedAt, and listing returns it", async () => {
  const workspaceId = ws("1");
  await seedStartReady(workspaceId);
  const result = await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "Business Psychology Blueprint v1" });
  assert.ok(!("error" in result), `expected success, got ${JSON.stringify(result)}`);
  const submission = result as ChapterSubmission;
  assert.equal(submission.stageId, "start");
  assert.equal(submission.reviewStatus, "submitted");
  assert.equal(submission.evidence, "Business Psychology Blueprint v1");
  assert.ok(submission.submittedAt, "submittedAt should be stamped");
  assert.equal(submission.reviewedAt, undefined);

  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.evidence, "Business Psychology Blueprint v1");
  assert.equal(listed[0]!.reviewStatus, "submitted");
});

test("addChapterSubmission: rejects empty evidence rather than recording a blank submission", async () => {
  // No seeding needed — empty evidence is refused before any gate/reachability
  // check runs (see addChapterSubmission), so an unreachable/unknown stage id
  // would never even come into play here.
  const workspaceId = ws("2");
  const result = await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "   " });
  assert.ok("error" in result);
  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed.length, 0);
});

test("addChapterSubmission: rejects a chapter that isn't reachable yet, and an unknown chapter id", async () => {
  const workspaceId = ws("2b");
  // "chapter-1" is a real canonical stage, but its predecessor ("start")
  // hasn't been approved yet — this is exactly the out-of-order case Finding
  // 2 closes.
  const locked = await chapters.addChapterSubmission(workspaceId, { stageId: "chapter-1", evidence: "evidence" });
  assert.ok("error" in locked && /available to submit/.test(locked.error));
  const unknown = await chapters.addChapterSubmission(workspaceId, { stageId: "not-a-real-chapter", evidence: "evidence" });
  assert.ok("error" in unknown && /Unknown chapter/.test(unknown.error));
  assert.deepEqual(await chapters.listChapterSubmissions(workspaceId), []);
});

test("addChapterSubmission: rejects a duplicate submission while one is still awaiting review", async () => {
  const workspaceId = ws("2c");
  await seedStartReady(workspaceId);
  const first = await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "v1" });
  assert.ok(!("error" in first));
  const second = await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "v2" });
  assert.ok("error" in second && /already has a submission awaiting review/.test(second.error));
  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed.length, 1, "the duplicate must not be recorded");
  assert.equal(listed[0]!.evidence, "v1");
});

test("reviewChapterSubmission: approving flips the latest entry to 'approved' and stamps the reviewer + reviewedAt", async () => {
  const workspaceId = ws("3");
  await seedStartReady(workspaceId);
  await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "evidence" });
  const ok = await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "approved", coachFeedback: "Nice work.", reviewedBy: "coach@example.com" });
  assert.equal(ok, true);
  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed[0]!.reviewStatus, "approved");
  assert.equal(listed[0]!.reviewedBy, "coach@example.com");
  assert.equal(listed[0]!.coachFeedback, "Nice work.");
  assert.ok(listed[0]!.reviewedAt, "reviewedAt should be stamped");
});

test("reviewChapterSubmission: requesting changes is a distinct terminal outcome from approval", async () => {
  const workspaceId = ws("4");
  await seedStartReady(workspaceId);
  await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "evidence" });
  const ok = await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "changes_requested", coachFeedback: "Add your conversion rate.", reviewedBy: "coach@example.com" });
  assert.equal(ok, true);
  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed[0]!.reviewStatus, "changes_requested");
  assert.equal(listed[0]!.coachFeedback, "Add your conversion rate.");
});

test("reviewChapterSubmission: reviews the LATEST submission for the stage, leaving earlier ones untouched", async () => {
  // A second submission on the SAME stage is only reachable once the first is
  // resolved as changes_requested (see the duplicate-pending test above) — the
  // real-world shape this now enforces: v1 rejected, learner resubmits v2,
  // coach approves v2, v1 stays exactly as it was reviewed.
  const workspaceId = ws("5");
  await seedStartReady(workspaceId);
  await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "v1" });
  await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "changes_requested", reviewedBy: "coach@example.com" });
  await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "v2" });
  const ok = await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "approved", reviewedBy: "coach@example.com" });
  assert.equal(ok, true);
  const listed = await chapters.listChapterSubmissions(workspaceId);
  const v1 = listed.find((s) => s.evidence === "v1");
  const v2 = listed.find((s) => s.evidence === "v2");
  assert.equal(v2?.reviewStatus, "approved", "the latest submission should be the one reviewed");
  assert.equal(v1?.reviewStatus, "changes_requested", "the earlier submission should be left exactly as it was reviewed");
});

test("reviewChapterSubmission: reviewing a chapter with no submission is a no-op (false), not a crash", async () => {
  const workspaceId = ws("6");
  const ok = await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "approved", reviewedBy: "coach@example.com" });
  assert.equal(ok, false);
});

test("reviewChapterSubmission: a decision on a chapter that isn't currently awaiting review is refused", async () => {
  // The chapter has a submission on file, but it's already been decided — a
  // second review call must not silently re-decide it (out-of-order/stale
  // review, Finding 2's other half).
  const workspaceId = ws("6b");
  await seedStartReady(workspaceId);
  await chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: "evidence" });
  await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "approved", reviewedBy: "coach@example.com" });
  const again = await chapters.reviewChapterSubmission(workspaceId, "start", { reviewStatus: "changes_requested", reviewedBy: "coach@example.com" });
  assert.equal(again, false, "an already-approved chapter is no longer 'awaiting_review'");
  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed[0]!.reviewStatus, "approved", "the earlier decision must stand");
});

// Same read-modify-write shape as every other store in this app: concurrent
// writes to the SAME workspace must serialize under the per-workspace
// advisory lock rather than racing. Previously this fired 20 concurrent
// submissions across 20 distinct (mostly synthetic) stage ids to prove none
// were lost; addChapterSubmission now also refuses a second pending
// submission on the same stage (see the dedicated duplicate test above), so
// the meaningful race to prove safe is 20 concurrent submissions AT THE SAME
// reachable stage: the lock must serialize them so exactly one is accepted
// and the other 19 correctly see it as a pending duplicate — never zero
// accepted (a lost write) and never more than one (a lost duplicate check).
test("addChapterSubmission: concurrent submissions to the same stage serialize — exactly one is accepted, none are lost or double-accepted", async () => {
  const workspaceId = ws("7");
  await seedStartReady(workspaceId);
  const COUNT = 20;
  const results = await Promise.all(
    Array.from({ length: COUNT }, (_, i) => chapters.addChapterSubmission(workspaceId, { stageId: "start", evidence: `evidence ${i}` })),
  );
  const accepted = results.filter((r) => !("error" in r));
  const duplicates = results.filter((r) => "error" in r && /already has a submission awaiting review/.test(r.error));
  assert.equal(accepted.length, 1, "exactly one concurrent submission should be accepted");
  assert.equal(duplicates.length, COUNT - 1, "every other concurrent submission should be correctly refused as a duplicate, not silently lost");
  const listed = await chapters.listChapterSubmissions(workspaceId);
  assert.equal(listed.length, 1, "the stored array must end with exactly the one accepted submission");
});
