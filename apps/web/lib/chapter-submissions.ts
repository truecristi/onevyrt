/**
 * Chapter-submission storage: the coach's per-chapter approval decisions
 * (packages/engine/src/chapter-gates.ts's ChapterSubmission model), persisted
 * per workspace — the same boundary enrollment already rides, because a
 * workspace already represents one learner's business and the chapter gates
 * are read alongside that learner's enrollment.
 *
 * At the end of a chapter (a stage: start / chapter-1 / chapter-2 /
 * chapter-3 / finish) the learner submits the chapter's OUTPUT as evidence;
 * the coach approves or requests changes; only an approval unlocks the next
 * chapter. This module just records those submissions and decisions — the
 * engine's chapterGates() turns them (plus lesson progress) into the gate
 * state every surface reads.
 *
 * "Coach" reuses the existing manager role, exactly as lib/enrollments.ts
 * does (owner = the learner, manager = the coach) — see that file's header
 * for why. Mirrors enrollments.ts's storage shape: one jsonb blob per
 * workspace_id, read/mutated/written whole under one cross-container advisory
 * lock (see db.ts withAdvisoryLock) so concurrent mutations to the SAME
 * workspace serialize across every app instance.
 */
import { pgPool, withAdvisoryLock, type Queryable } from "./db";
import { chapterGates, newEnrollment, type ChapterSubmission, type ProgrammeTemplate, type Enrollment } from "@onevyrt/engine";
import { getDefaultProgramme } from "./curriculum-store";
import { effectiveStageAccessLimit } from "./cohorts";
import { getEnrollment } from "./enrollments";

// A per-workspace advisory-lock key (see db.ts withAdvisoryLock), so concurrent
// mutations to the SAME workspace's chapter submissions serialize across every
// app instance — different workspaces never contend with each other.
function chapterSubmissionsLockKey(workspaceId: string): string { return `chapter-submissions:${workspaceId}`; }

// Kept as one jsonb array per workspace_id, same pattern as enrollments — every
// call site reads/mutates/writes the whole array under one cross-container lock.
// `db` defaults to the shared pool for the lock-free read path, but a locked
// mutation passes in its lock client so the read/modify/write runs on ONE
// connection inside the lock's transaction (see db.ts withAdvisoryLock).
async function readAll(workspaceId: string, db: Queryable = pgPool()): Promise<ChapterSubmission[]> {
  const res = await db.query<{ submissions: ChapterSubmission[] }>("SELECT submissions FROM chapter_submissions WHERE workspace_id = $1", [workspaceId]);
  return res.rows[0]?.submissions ?? [];
}
async function writeAll(workspaceId: string, submissions: ChapterSubmission[], db: Queryable = pgPool()): Promise<void> {
  await db.query(
    "INSERT INTO chapter_submissions (workspace_id, submissions) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET submissions = EXCLUDED.submissions",
    [workspaceId, JSON.stringify(submissions)],
  );
}

/** The latest submission for one chapter, by submittedAt (ties broken toward
 *  the most recently added) — the same rule the engine's chapterGates() uses
 *  internally to pick a chapter's current submission (that helper isn't
 *  exported), so this file's own reachability checks agree with the engine on
 *  which submission is "current." */
function latestSubmissionFor(submissions: readonly ChapterSubmission[], stageId: string): ChapterSubmission | undefined {
  let latest: ChapterSubmission | undefined;
  for (const s of submissions) {
    if (s.stageId !== stageId) continue;
    if (!latest || s.submittedAt >= latest.submittedAt) latest = s;
  }
  return latest;
}

/** Everything chapterGates() needs besides the submissions array itself, to
 *  compute a chapter's CURRENT gate state for the reachability checks in
 *  addChapterSubmission / reviewChapterSubmission below: the programme (stage
 *  order + lesson layout), the workspace's cohort pacing cap, and its
 *  enrollment (for lesson completion). Mirrors what lib/enrollments.ts's
 *  submitAssignment already reads to gate lessons via capStatusByStage(),
 *  applied here to chapters.
 *
 *  MUST be called and awaited BEFORE taking the chapter-submissions advisory
 *  lock, never from inside it: each of these does its own pgPool() read, and
 *  checking out a second connection while the lock's connection is held is a
 *  pool-starvation deadlock (see db.ts withAdvisoryLock) — the same reason
 *  submitAssignment reads its own pre-lock state (workspace/hasCoach) before
 *  calling withAdvisoryLock rather than from inside it. A small staleness
 *  window follows (enrollment/programme/pacing could change between this read
 *  and the lock), the same tradeoff submitAssignment already accepts for its
 *  pre-lock reads — the chapter_submissions data itself (what this lock
 *  actually protects) is still read fresh, under the lock, by the caller.
 *
 *  A workspace with no enrollment yet gets a fresh in-memory Enrollment
 *  (never persisted) — chapterGates() only reads its lesson list, and an
 *  unset one computes the same "nothing done yet" statuses a real brand-new
 *  enrollment would (see engine/enrollment.ts effectiveStatus). */
async function chapterGateInputs(workspaceId: string): Promise<{ programme: ProgrammeTemplate; stageAccessLimit: number | null; enrollment: Enrollment }> {
  const [programme, stageAccessLimit, enrollment] = await Promise.all([
    getDefaultProgramme(),
    effectiveStageAccessLimit(workspaceId),
    getEnrollment(workspaceId),
  ]);
  return { programme, stageAccessLimit, enrollment: enrollment ?? newEnrollment("", programme.id, workspaceId, "", "self_paced") };
}

// Cap evidence/feedback length like enrollments does, and cap the total number
// of submissions so a workspace's blob can't grow without bound.
// resetChapterSubmissions (below) is the recovery path once a workspace hits
// MAX_SUBMISSIONS with stuck pending submissions — there was none before.
const MAX_EVIDENCE_LENGTH = 4000;
const MAX_SUBMISSIONS = 200;

/** Every chapter submission for a workspace, oldest first — empty array if the
 *  workspace has never submitted a chapter (no row yet). Lock-free read. */
export async function listChapterSubmissions(workspaceId: string): Promise<ChapterSubmission[]> {
  return readAll(workspaceId);
}

/** A learner submits a chapter's output for coach review: appends a new
 *  {reviewStatus:"submitted", submittedAt:now} entry under an advisory lock.
 *  Rejects empty evidence rather than recording a blank submission.
 *
 *  Also rejects (mirroring lib/enrollments.ts's submitAssignment on lessons):
 *   - a duplicate submission while the chapter's latest one is still
 *     unresolved (reviewStatus "submitted", not yet reviewed) — otherwise a
 *     learner, a double-click, or a retried request can stack another
 *     pending submission on top of one no coach has looked at yet;
 *   - a submission for a chapter that isn't CURRENTLY reachable — i.e. whose
 *     engine-computed gate state (chapterGates()) isn't "ready_to_submit" or
 *     "changes_requested" right now. Before this check any stageId was
 *     accepted regardless of whether its previous chapter was approved, a
 *     cohort's pacing cap, or whether this chapter was already approved — so
 *     an out-of-order or stale submission could sit in storage and only take
 *     effect later, once the read side (chapterGates(), which recomputes
 *     purely from the latest submission per stage on every read) found it
 *     reachable, with nobody having reviewed it in that context. */
export async function addChapterSubmission(workspaceId: string, input: { stageId: string; evidence: string }): Promise<ChapterSubmission | { error: string }> {
  const stageId = input.stageId?.trim();
  if (!stageId) return { error: "A chapter is required." };
  const clean = input.evidence.trim().slice(0, MAX_EVIDENCE_LENGTH);
  if (!clean) return { error: "Evidence is required." };
  const { programme, stageAccessLimit, enrollment } = await chapterGateInputs(workspaceId);
  return withAdvisoryLock(chapterSubmissionsLockKey(workspaceId), async (db) => {
    const submissions = await readAll(workspaceId, db);
    const gate = chapterGates(programme, enrollment, submissions, stageAccessLimit).find((g) => g.stageId === stageId);
    if (!gate) return { error: "Unknown chapter." };
    const latest = latestSubmissionFor(submissions, stageId);
    if (latest?.reviewStatus === "submitted") {
      return { error: "This chapter already has a submission awaiting review — wait for your coach's decision before submitting again." };
    }
    if (gate.state !== "ready_to_submit" && gate.state !== "changes_requested") {
      return { error: `This chapter isn't available to submit right now (currently ${gate.state.replace(/_/g, " ")}).` };
    }
    if (submissions.length >= MAX_SUBMISSIONS) return { error: "Too many chapter submissions for this workspace — contact your coach." };
    const submission: ChapterSubmission = {
      stageId,
      submittedAt: new Date().toISOString(),
      evidence: clean,
      reviewStatus: "submitted",
    };
    submissions.push(submission);
    await writeAll(workspaceId, submissions, db);
    return submission;
  });
}

/** A coach (owner/manager — see file header) approves or requests changes on
 *  the LATEST submission for a chapter, stamping reviewedAt/reviewedBy (and
 *  optional feedback). "Latest" matches the engine's chapterGates: the
 *  highest submittedAt, ties broken toward the most recently added.
 *
 *  Returns false — a no-op, not a crash — if there's no submission for that
 *  chapter, OR if that chapter isn't CURRENTLY the one awaiting review: its
 *  engine-computed gate state (chapterGates()) must be "awaiting_review"
 *  right now. Without this a decision could be recorded against a chapter
 *  that isn't reachable yet (previous chapter still unapproved, a cohort's
 *  pacing cap) and then take silent effect later with no fresh review, the
 *  moment chapterGates() — which recomputes purely from the latest submission
 *  per stage on every read — finds it reachable; e.g. an approval cast early
 *  would flip a later-reached chapter straight to "approved" once its
 *  predecessor finally clears, with nobody having looked at it in that
 *  context. */
export async function reviewChapterSubmission(
  workspaceId: string,
  stageId: string,
  input: { reviewStatus: "approved" | "changes_requested"; coachFeedback?: string; reviewedBy: string },
): Promise<boolean> {
  const { programme, stageAccessLimit, enrollment } = await chapterGateInputs(workspaceId);
  return withAdvisoryLock(chapterSubmissionsLockKey(workspaceId), async (db) => {
    const submissions = await readAll(workspaceId, db);
    const latest = latestSubmissionFor(submissions, stageId);
    if (!latest) return false;
    const gate = chapterGates(programme, enrollment, submissions, stageAccessLimit).find((g) => g.stageId === stageId);
    if (gate?.state !== "awaiting_review") return false;
    latest.reviewStatus = input.reviewStatus;
    latest.reviewedAt = new Date().toISOString();
    latest.reviewedBy = input.reviewedBy;
    if (input.coachFeedback?.trim()) latest.coachFeedback = input.coachFeedback.trim().slice(0, MAX_EVIDENCE_LENGTH);
    await writeAll(workspaceId, submissions, db);
    return true;
  });
}

/** Coach/admin recovery valve: removes every PENDING (i.e.
 *  reviewStatus:"submitted", not yet reviewed) submission for one chapter, so
 *  a workspace stuck at MAX_SUBMISSIONS — or blocked by addChapterSubmission's
 *  duplicate-pending check above — has a way back to a submittable chapter.
 *  Reviewed submissions (approved / changes_requested) are left untouched;
 *  this only drops what a coach never acted on. Unlike lessons, a chapter has
 *  no separate stored status to reconcile — chapterGates() derives it purely
 *  from the submissions array, so removing the pending entries is the whole
 *  fix. Not wired to a route/UI yet — exported so a coach or admin surface
 *  can call it; wiring an API route with a role check (owner/manager only,
 *  the same bar as reviewChapterSubmission) is a follow-up.
 *  Returns the number of pending submissions removed. */
export async function resetChapterSubmissions(workspaceId: string, stageId: string): Promise<number> {
  return withAdvisoryLock(chapterSubmissionsLockKey(workspaceId), async (db) => {
    const submissions = await readAll(workspaceId, db);
    const kept = submissions.filter((s) => !(s.stageId === stageId && s.reviewStatus === "submitted"));
    const removed = submissions.length - kept.length;
    if (removed === 0) return 0;
    await writeAll(workspaceId, kept, db);
    return removed;
  });
}

/** Atomically approve or request changes on a Chapter 4 submission, keeping
 *  both chapter_submissions (authoritative, used for gating) and
 *  chapter_4_submissions (enriched data for the Growth & Improvement Plan
 *  artifact) in sync within a single advisory lock. Eliminates the race
 *  condition where coach approval could succeed in one table but fail to
 *  propagate to the other.
 *
 *  This function is ONLY called for Chapter 4 (CHAPTER_4_STAGE_ID = "chapter-4").
 *  For chapters 1-3, the generic reviewChapterSubmission is sufficient since
 *  there's no secondary table to keep in sync.
 *
 *  Returns false (a no-op, not a crash) if:
 *   - There's no submission for that chapter
 *   - That chapter isn't CURRENTLY awaiting review (engine-computed gate state)
 *   - The Chapter 4 submission isn't in "submitted" status (best-effort safety —
 *     if there's a mismatch between the two tables, sync just skips the update)
 *  On success, BOTH tables are updated together and the advisory lock ensures
 *  nobody else reads a half-updated state. */
export async function reviewChapter4SubmissionAtomically(
  workspaceId: string,
  stageId: string,
  input: { reviewStatus: "approved" | "changes_requested"; coachFeedback?: string; reviewedBy: string },
): Promise<boolean> {
  // Pre-lock reads (see reviewChapterSubmission's comment) — small staleness
  // window is accepted for the same tradeoff other pre-lock reads take.
  const { programme, stageAccessLimit, enrollment } = await chapterGateInputs(workspaceId);

  return withAdvisoryLock(chapterSubmissionsLockKey(workspaceId), async (db) => {
    // Step 1: Update chapter_submissions (the authoritative table)
    const submissions = await readAll(workspaceId, db);
    const latest = latestSubmissionFor(submissions, stageId);
    if (!latest) return false;
    const gate = chapterGates(programme, enrollment, submissions, stageAccessLimit).find((g) => g.stageId === stageId);
    if (gate?.state !== "awaiting_review") return false;

    latest.reviewStatus = input.reviewStatus;
    latest.reviewedAt = new Date().toISOString();
    latest.reviewedBy = input.reviewedBy;
    if (input.coachFeedback?.trim()) latest.coachFeedback = input.coachFeedback.trim().slice(0, MAX_EVIDENCE_LENGTH);
    await writeAll(workspaceId, submissions, db);

    // Step 2: Sync to chapter_4_submissions in the SAME transaction —
    // still inside the lock, so neither reader nor concurrent learner save
    // sees a half-updated state. If the row doesn't exist or isn't awaiting
    // review, just skip (best-effort safety).
    try {
      const res = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM chapter_4_submissions WHERE workspace_id = $1`,
        [workspaceId],
      );
      const c4 = res.rows[0];
      if (c4 && c4.status === "submitted") {
        const feedback = input.coachFeedback?.trim().slice(0, MAX_EVIDENCE_LENGTH) || null;
        await db.query(
          `UPDATE chapter_4_submissions
           SET status = $2, coach_decision = $2, coach_feedback = $3, reviewed_at = now(), reviewed_by = $4, updated_at = now()
           WHERE id = $1`,
          [c4.id, input.reviewStatus, feedback, input.reviewedBy],
        );
      }
    } catch {
      // If the Chapter 4 sync fails, we still succeeded on the gate side
      // (step 1 is committed). This is the atomic-from-gating perspective that
      // matters — the learner is unblocked, even if the artifact's own
      // approval status needs a manual reconciliation (next logical task).
      // Silent catch keeps the exception from bubbling up and rolling back the
      // already-committed gate update.
    }

    return true;
  });
}
