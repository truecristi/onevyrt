/**
 * Enrollment storage: one learner's progress through a programme
 * (packages/engine/src/enrollment.ts's pure model), persisted per
 * workspace — a workspace already represents one learner's business, the
 * same scope goals/definition/Money Machine already use, so enrollment
 * rides the same boundary instead of inventing a new one.
 *
 * "Coach" reuses the existing manager role rather than a new one: this
 * repo's role model (owner/manager/editor/viewer) is workspace-scoped with
 * no cross-workspace grant, and a manager already means "everything short
 * of ownership transfer" — inviting a coach via the existing add-member
 * flow, as a manager, is real reuse, not a workaround. A true external
 * coach who serves many workspaces they don't own is a bigger data-model
 * change (a cross-workspace grant, like report-shares.ts's token but for
 * a person instead of a link) that this slice deliberately does not build.
 */
import { randomBytes } from "node:crypto";
import { pgPool, withAdvisoryLock, type Queryable } from "./db";
import { getWorkspace, type Workspace } from "./workspaces";
import { newEnrollment, effectiveStatus, capStatusByStage, type Enrollment, type DeliveryMode, type Submission, type LessonStatus, type ProgrammeTemplate, type ChapterGate, type ChapterSubmission } from "@onevyrt/engine";
import { validateLessonSubmission } from "./lesson-requirements";

/** The Start-of-journey Readiness Score, captured once and never overwritten —
 *  the "before" the Finish module compares against. Stored on the enrollment
 *  blob (journey-scoped data riding the journey's own record). */
export interface ReadinessBaseline { score: number; capturedAt: string }
type EnrollmentStored = Enrollment & { readinessBaseline?: ReadinessBaseline };

/** The stored baseline off an already-loaded enrollment, or null. */
export function readinessBaselineOf(enrollment: Enrollment): ReadinessBaseline | null {
  return (enrollment as EnrollmentStored).readinessBaseline ?? null;
}

/** Chapter 4 (IMPROVE & SCALE)'s canonical stage id — see
 *  packages/engine/src/curriculum-chapters.ts's CANONICAL_STAGES. Exported so
 *  callers never re-type the string literal. */
export const CHAPTER_4_STAGE_ID = "chapter-4";

/** Chapter 4's own approval gate — the engine's generic ChapterGate (see
 *  chapterGates() in @onevyrt/engine) narrowed to the "chapter-4" stage. Chapter
 *  4 is gated exactly like chapters 1-3 (a coach approves its submitted OUTPUT,
 *  the Growth & Improvement Plan, before Finish unlocks) — this is a typed
 *  convenience over that SAME generic mechanism, not a second gate system.
 *  Callers already hold a computed ChapterGate[] (from GET
 *  /api/programme/chapters or /api/programme/enrollment); this just picks
 *  Chapter 4's out of that list by id. */
export interface Chapter4Gate extends ChapterGate {
  stageId: typeof CHAPTER_4_STAGE_ID;
}

/** Finds Chapter 4's gate in an already-computed ChapterGate[], or null if
 *  the programme has no "chapter-4" stage (e.g. a curriculum row that hasn't
 *  been migrated to CURRICULUM_SCHEMA_VERSION 4 yet). */
export function chapter4GateOf(gates: readonly ChapterGate[]): Chapter4Gate | null {
  const gate = gates.find((g) => g.stageId === CHAPTER_4_STAGE_ID);
  return gate ? (gate as Chapter4Gate) : null;
}

/** Whether Chapter 4 has cleared coach approval — the single boolean the
 *  Finish chapter, the Transformation Report, and the programme journey's
 *  "unlock Finish" check all need, without each re-deriving gate-state logic
 *  of its own. `approvedAt`/`submission` are null until a real approval
 *  exists (or the programme has no chapter-4 stage at all). */
export interface Chapter4Completion {
  approved: boolean;
  approvedAt: string | null;
  submission: ChapterSubmission | null;
}

export function chapter4Completion(gates: readonly ChapterGate[]): Chapter4Completion {
  const gate = chapter4GateOf(gates);
  const submission = gate?.submission ?? null;
  return {
    approved: gate?.state === "approved",
    approvedAt: gate?.state === "approved" ? (submission?.reviewedAt ?? null) : null,
    submission,
  };
}

/** Modify chapter gates for free-access mode: all gates are immediately "approved"
 *  and "unlockNext" is true, so all content is available. Returns the modified
 *  gates if free-access is enabled, otherwise returns the gates unchanged. */
export function applyFreeAccessMode(gates: readonly ChapterGate[], isFreeAccess: boolean): ChapterGate[] {
  if (!isFreeAccess) return Array.from(gates);
  return gates.map((gate) => ({
    ...gate,
    state: "approved" as const,
    unlocksNext: true,
  }));
}

// A per-workspace advisory-lock key (see db.ts withAdvisoryLock), so concurrent
// mutations to the SAME workspace's enrollment serialize across every app
// instance — different workspaces never contend with each other.
function enrollmentLockKey(workspaceId: string): string { return `enrollment:${workspaceId}`; }

// Was one file per workspace holding a single Enrollment object; kept as one
// jsonb blob per workspace_id, same shape as tracking_journeys — every call
// site reads/mutates/writes the whole object under one cross-container lock.
// `db` defaults to the shared pool for lock-free reads, but a locked mutation
// passes in its lock client so the read/modify/write runs on ONE connection
// inside the lock's transaction (see db.ts withAdvisoryLock).
async function readOne(workspaceId: string, db: Queryable = pgPool()): Promise<Enrollment | null> {
  const res = await db.query<{ enrollment: Enrollment }>("SELECT enrollment FROM enrollments WHERE workspace_id = $1", [workspaceId]);
  return res.rows[0]?.enrollment ?? null;
}
async function writeOne(workspaceId: string, enrollment: Enrollment, db: Queryable = pgPool()): Promise<void> {
  await db.query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment",
    [workspaceId, JSON.stringify(enrollment)],
  );
}

/** Idempotent — a workspace's first touch of the programme creates its one
 *  enrollment; every call after that returns the same one. */
export async function getOrCreateEnrollment(workspaceId: string, userId: string, programmeId: string, deliveryMode: DeliveryMode = "self_paced"): Promise<Enrollment> {
  const existing = await readOne(workspaceId);
  if (existing) return existing;
  const created = newEnrollment(randomBytes(8).toString("hex"), programmeId, workspaceId, userId, deliveryMode);
  // workspace_id is the primary key, so this is race-free without any lock: a
  // concurrent first-touch from another request (or another container) loses
  // the insert (DO NOTHING); re-read to return whichever enrollment landed.
  await pgPool().query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) ON CONFLICT (workspace_id) DO NOTHING",
    [workspaceId, JSON.stringify(created)],
  );
  return (await readOne(workspaceId)) ?? created;
}

export async function getEnrollment(workspaceId: string): Promise<Enrollment | null> {
  return readOne(workspaceId);
}

const MAX_EVIDENCE_LENGTH = 4000;
const MAX_SUBMISSIONS_PER_LESSON = 50;

/** A learner submits an assignment: appends a new pending Submission and
 *  moves the lesson's stored status to "submitted." Rejects if the lesson
 *  is locked (either by normal sequential gating or a cohort's pacing
 *  cap), if a coach has paused this workspace's access, or if the lesson's
 *  latest submission is still pending review — submitting into a lesson you
 *  can't access yet isn't a valid state regardless of what the client sends,
 *  and neither is stacking a second pending submission on top of one a coach
 *  hasn't looked at yet. (A "submitted" lesson isn't "locked" — before this
 *  check that gap let a learner, a double-click, or a retried request push
 *  another pending Submission and re-notify every coach each time, with no
 *  way back once MAX_SUBMISSIONS_PER_LESSON was hit; see
 *  resetLessonSubmissions below for the recovery path.)
 *
 *  In free-access mode, all lessons are immediately approved without review. */
export async function submitAssignment(workspaceId: string, lessonId: string, _userId: string, evidence: string, checklistChecked: string[], programme: ProgrammeTemplate, stageAccessLimit: number | null, workspace?: Workspace): Promise<Submission | { error: string }> {
  const clean = evidence.trim().slice(0, MAX_EVIDENCE_LENGTH);
  if (!clean) return { error: "Evidence is required." };

  // Load workspace if not provided, for validation
  const ws = workspace ?? (await getWorkspace(workspaceId).catch(() => null));

  // Server-side validation: check lesson requirements (evidence length, checklist, artifacts)
  const validationError = await validateLessonSubmission(lessonId, clean, checklistChecked, ws);
  if (validationError) return { error: validationError };
  // Self-paced track with no coach on the workspace: the submission approves
  // itself, or the learner is stuck forever — the next lesson only unlocks on
  // "approved", and with no manager there is nobody to ever grant it (the
  // notification helper literally no-ops). A workspace WITH a coach keeps the
  // real review flow regardless of delivery mode. Checked before taking the
  // lock: coach membership changing mid-submit is harmless, and reads inside
  // the lock double connection demand (see workspaces.ts addMember note).
  const hasCoach = ws?.members.some((m) => m.role === "manager") ?? false;
  const isFreeAccess = ws?.freeAccessMode ?? false;
  return withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    if (!enrollment) return { error: "No enrollment found for this workspace." };
    if (enrollment.accessGranted === false) return { error: "Programme access has been paused for this workspace — contact your coach." };
    // In free-access mode, skip the lock check entirely
    if (!isFreeAccess) {
      const status = capStatusByStage(programme, lessonId, effectiveStatus(programme, enrollment, lessonId), stageAccessLimit);
      if (status === "locked") return { error: "This lesson is locked." };
    }
    let entry = enrollment.lessons.find((l) => l.lessonId === lessonId);
    if (!entry) { entry = { lessonId, submissions: [] }; enrollment.lessons.push(entry); }
    // A "submitted" lesson is awaiting coach review, not locked — the status
    // check above doesn't catch a resubmit while one is already pending.
    const latestSubmission = entry.submissions[entry.submissions.length - 1];
    if (latestSubmission?.reviewStatus === "pending") {
      return { error: "This lesson already has a submission awaiting review — wait for your coach's decision before submitting again." };
    }
    if (entry.submissions.length >= MAX_SUBMISSIONS_PER_LESSON) return { error: "Too many submissions for this lesson — contact your coach." };
    const submission: Submission = {
      id: randomBytes(6).toString("hex"), submittedAt: new Date().toISOString(),
      evidence: clean, checklistChecked, reviewStatus: "pending",
    };
    entry.submissions.push(submission);
    entry.status = "submitted";
    if (!entry.startedAt) entry.startedAt = submission.submittedAt;
    // Auto-approve if: free-access mode, OR self-paced with no coach
    if (isFreeAccess || (enrollment.deliveryMode === "self_paced" && !hasCoach)) {
      submission.reviewStatus = "approved";
      submission.reviewedAt = submission.submittedAt;
      submission.reviewedBy = isFreeAccess ? "auto (free-access)" : "auto (self-paced)";
      entry.status = "approved";
    }
    await writeOne(workspaceId, enrollment, db);
    return submission;
  });
}

/** Write-once capture of the Start-of-journey Readiness Score. The first time
 *  a non-null score is seen for a workspace, it becomes the permanent baseline;
 *  every later call returns the stored value untouched. Returns null only when
 *  there is no enrollment yet, or no baseline exists and no score to seed one. */
export async function ensureReadinessBaseline(workspaceId: string, score: number | null): Promise<ReadinessBaseline | null> {
  const existing = (await readOne(workspaceId)) as EnrollmentStored | null;
  if (!existing) return null;
  if (existing.readinessBaseline) return existing.readinessBaseline;
  if (score == null) return null;
  return withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = (await readOne(workspaceId, db)) as EnrollmentStored | null;
    if (!enrollment) return null;
    if (enrollment.readinessBaseline) return enrollment.readinessBaseline;
    const baseline: ReadinessBaseline = { score, capturedAt: new Date().toISOString() };
    enrollment.readinessBaseline = baseline;
    await writeOne(workspaceId, enrollment, db);
    return baseline;
  });
}

/** A coach (owner/manager — see file header) approves or requests changes
 *  on the most recent pending submission for a lesson. */
export async function reviewSubmission(workspaceId: string, lessonId: string, decision: "approved" | "changes_requested", coachEmail: string, feedback?: string): Promise<boolean> {
  return withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    if (!enrollment) return false;
    const entry = enrollment.lessons.find((l) => l.lessonId === lessonId);
    const pending = entry?.submissions.filter((s) => s.reviewStatus === "pending").slice(-1)[0];
    if (!entry || !pending) return false;
    pending.reviewStatus = decision;
    pending.reviewedAt = new Date().toISOString();
    pending.reviewedBy = coachEmail;
    if (feedback?.trim()) pending.coachFeedback = feedback.trim().slice(0, MAX_EVIDENCE_LENGTH);
    entry.status = decision as LessonStatus;
    await writeOne(workspaceId, enrollment, db);
    return true;
  });
}

/** Coach/admin recovery valve: clears every PENDING (not yet reviewed)
 *  submission for one lesson, so a learner stuck at MAX_SUBMISSIONS_PER_LESSON
 *  — or blocked by submitAssignment's duplicate-pending check above — has a
 *  way back to a submittable lesson. Reviewed submissions (approved /
 *  changes_requested) are left untouched; this only drops what a coach never
 *  acted on. The lesson's stored status is recomputed from whatever's left:
 *  the last remaining (reviewed) submission's decision, or cleared entirely —
 *  falling back to effectiveStatus's position-based compute — if nothing
 *  remains. Not wired to a route/UI yet — exported so a coach or admin
 *  surface can call it; wiring an API route with a role check (owner/manager
 *  only, the same bar as reviewSubmission) is a follow-up.
 *  Returns the number of pending submissions removed (0 if none were pending,
 *  the lesson has no entry, or there's no enrollment at all). */
export async function resetLessonSubmissions(workspaceId: string, lessonId: string): Promise<number> {
  return withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    const entry = enrollment?.lessons.find((l) => l.lessonId === lessonId);
    if (!enrollment || !entry) return 0;
    const before = entry.submissions.length;
    entry.submissions = entry.submissions.filter((s) => s.reviewStatus !== "pending");
    const removed = before - entry.submissions.length;
    if (removed === 0) return 0;
    const lastReviewed = entry.submissions[entry.submissions.length - 1];
    if (lastReviewed) entry.status = lastReviewed.reviewStatus as LessonStatus;
    else delete entry.status;
    await writeOne(workspaceId, enrollment, db);
    return removed;
  });
}

/** A learner marks a lesson as started, without submitting anything yet —
 *  moves an "available" lesson to "in_progress" so a coach can see
 *  someone's actually working on it, not just idle. No-op if the lesson
 *  already has a further-along status, is locked, or access is paused.
 *  In free-access mode, lessons are never locked. */
export async function startLesson(workspaceId: string, lessonId: string, programme: ProgrammeTemplate, stageAccessLimit: number | null, workspace?: Workspace): Promise<void> {
  await withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    if (!enrollment || enrollment.accessGranted === false) return;
    const ws = workspace ?? (await getWorkspace(workspaceId).catch(() => null));
    const isFreeAccess = ws?.freeAccessMode ?? false;
    // In free-access mode, skip the lock check entirely
    if (!isFreeAccess) {
      const status = capStatusByStage(programme, lessonId, effectiveStatus(programme, enrollment, lessonId), stageAccessLimit);
      if (status === "locked") return;
    }
    let entry = enrollment.lessons.find((l) => l.lessonId === lessonId);
    if (!entry) { entry = { lessonId, submissions: [] }; enrollment.lessons.push(entry); }
    if (entry.status) return;
    entry.status = "in_progress";
    entry.startedAt = new Date().toISOString();
    await writeOne(workspaceId, enrollment, db);
  });
}

/** Sets/clears a coach's private note about this client. Never returned to
 *  the learner — see Enrollment.coachNotes and the API route that gates it
 *  to role === "manager". */
export async function setCoachNotes(workspaceId: string, notes: string): Promise<void> {
  await withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    if (!enrollment) return;
    const clean = notes.trim().slice(0, MAX_EVIDENCE_LENGTH);
    if (clean) enrollment.coachNotes = clean; else delete enrollment.coachNotes;
    await writeOne(workspaceId, enrollment, db);
  });
}

/** Manual access gate — a coach pausing/resuming a workspace's programme
 *  access with no billing integration behind it (see Enrollment.accessGranted). */
export async function setAccessGranted(workspaceId: string, granted: boolean): Promise<void> {
  await withAdvisoryLock(enrollmentLockKey(workspaceId), async (db) => {
    const enrollment = await readOne(workspaceId, db);
    if (!enrollment) return;
    if (granted) delete enrollment.accessGranted; else enrollment.accessGranted = false;
    await writeOne(workspaceId, enrollment, db);
  });
}

/** GDPR cascade (account deletion): delete the enrollment blobs for the given
 *  (deleted) workspaces. Deleting a workspace only removes the workspace row +
 *  its projects (see store.ts deleteScope) — the enrollment, keyed by
 *  workspace_id, is orphaned otherwise. No advisory lock: the workspace is
 *  already gone, so nothing else is mutating it. Idempotent; returns the count.
 *  See app/api/auth/delete-account. */
export async function deleteEnrollmentsForWorkspaces(workspaceIds: string[]): Promise<number> {
  if (workspaceIds.length === 0) return 0;
  const res = await pgPool().query("DELETE FROM enrollments WHERE workspace_id = ANY($1)", [workspaceIds]);
  return res.rowCount ?? 0;
}
