/**
 * Enrollment: one learner's stored progress through a ProgrammeTemplate
 * (curriculum.ts) — separate from that existing 8-lesson program.ts model's
 * "done," which is derived from content and never stored. Submission/review
 * needs real stored state (a coach has to act on something that persists),
 * so this is a second, independent axis: a lesson can be content-complete
 * in the old sense and still be "submitted, awaiting review" here. Pure
 * data + pure helpers, no UI, no storage.
 */
import type { ProgrammeTemplate } from "./curriculum.ts";
import { allLessons, findLesson } from "./curriculum.ts";

export type LessonStatus = "locked" | "available" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
export type DeliveryMode = "self_paced" | "cohort" | "premium_1to1";

export interface Submission {
  id: string;
  submittedAt: string;
  evidence: string;
  checklistChecked: string[];
  /** Set once a coach acts on it — "submitted" until then. */
  reviewStatus: "pending" | "approved" | "changes_requested";
  coachFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface EnrollmentLessonEntry {
  lessonId: string;
  /** Explicit override once a learner starts or a coach acts — absent
   *  means "compute from position + prior lessons" (see effectiveStatus). */
  status?: LessonStatus;
  startedAt?: string;
  submissions: Submission[];
}

export interface Enrollment {
  id: string;
  programmeId: string;
  workspaceId: string;
  userId: string;
  deliveryMode: DeliveryMode;
  cohortId?: string;
  coachUserId?: string;
  startedAt: string;
  lessons: EnrollmentLessonEntry[];
  /** A coach's private scratchpad about this client — never shown to the
   *  learner. Gated at the API layer (only returned when the requester's
   *  workspace role is "manager," the actual invited-coach role — the
   *  workspace owner IS the client, so owner never qualifies here even
   *  though "coach" elsewhere in this app loosely means owner-or-manager). */
  coachNotes?: string;
  /** Manual access gate, independent of billing (no payment integration
   *  exists yet — see curriculum-store.ts/programme-offers.ts headers).
   *  Absent or true = normal access; false = a coach has paused this
   *  workspace's programme access. */
  accessGranted?: boolean;
}

function entryFor(enrollment: Enrollment, lessonId: string): EnrollmentLessonEntry | undefined {
  return enrollment.lessons.find((l) => l.lessonId === lessonId);
}

/** The status actually shown to the learner: an explicit stored status wins
 *  (started, submitted, reviewed); absent that, the first lesson is
 *  available and every later lesson is locked until the one before it
 *  reaches "approved" or "completed" — sequential gating is the default,
 *  not something every lesson has to opt into by hand. */
export function effectiveStatus(programme: ProgrammeTemplate, enrollment: Enrollment, lessonId: string): LessonStatus {
  const stored = entryFor(enrollment, lessonId)?.status;
  if (stored) return stored;
  const lessons = allLessons(programme);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) return "locked";
  if (idx === 0) return "available";
  const prevId = lessons[idx - 1].id;
  const prevStatus = effectiveStatus(programme, enrollment, prevId);
  return prevStatus === "approved" || prevStatus === "completed" ? "available" : "locked";
}

/** Applies a cohort's pacing cap on top of the normal sequential status: a
 *  lesson that would otherwise be "available" stays locked if its stage
 *  comes after the cohort's stageAccessLimit — a coach running a paced
 *  6-week cohort can stop learners racing ahead to unreleased content.
 *  Never re-locks a lesson with real progress on it (in_progress and
 *  beyond) — a pacing cap constrains what's NEXT, not historical work. */
export function capStatusByStage(programme: ProgrammeTemplate, lessonId: string, status: LessonStatus, maxStageOrder: number | null | undefined): LessonStatus {
  if (maxStageOrder == null || status !== "available") return status;
  const found = findLesson(programme, lessonId);
  if (!found) return status;
  return found.stage.order > maxStageOrder ? "locked" : status;
}

export interface EnrollmentSummary {
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  currentLessonId: string | null;
  awaitingReview: { lessonId: string; submission: Submission }[];
  changesRequested: string[];
}

export function summarizeEnrollment(programme: ProgrammeTemplate, enrollment: Enrollment): EnrollmentSummary {
  const lessons = allLessons(programme);
  let completedLessons = 0;
  let currentLessonId: string | null = null;
  const awaitingReview: { lessonId: string; submission: Submission }[] = [];
  const changesRequested: string[] = [];

  for (const lesson of lessons) {
    const status = effectiveStatus(programme, enrollment, lesson.id);
    if (status === "approved" || status === "completed") completedLessons++;
    else if (currentLessonId === null && status !== "locked") currentLessonId = lesson.id;

    const entry = entryFor(enrollment, lesson.id);
    const latest = entry?.submissions[entry.submissions.length - 1];
    if (latest?.reviewStatus === "pending") awaitingReview.push({ lessonId: lesson.id, submission: latest });
    if (status === "changes_requested") changesRequested.push(lesson.id);
  }
  if (currentLessonId === null && lessons.length > 0 && completedLessons < lessons.length) currentLessonId = lessons[completedLessons]?.id ?? null;

  return {
    totalLessons: lessons.length,
    completedLessons,
    percentComplete: lessons.length === 0 ? 0 : Math.round((completedLessons / lessons.length) * 100),
    currentLessonId,
    awaitingReview,
    changesRequested,
  };
}

/** A fresh enrollment for a new learner — no lesson entries yet; every
 *  status is computed on demand by effectiveStatus. */
export function newEnrollment(id: string, programmeId: string, workspaceId: string, userId: string, deliveryMode: DeliveryMode, startedAt = new Date().toISOString()): Enrollment {
  return { id, programmeId, workspaceId, userId, deliveryMode, startedAt, lessons: [] };
}

/** How "advanced" each stored status is — used only when two old lesson entries
 *  collapse onto one new module and we must keep a single status. */
const STATUS_RANK: Readonly<Record<LessonStatus, number>> = Object.freeze({
  locked: 0, available: 1, in_progress: 2, changes_requested: 3, submitted: 4, completed: 5, approved: 6,
});
function statusRank(s: LessonStatus | undefined): number {
  return s === undefined ? -1 : STATUS_RANK[s];
}
function earliestIso(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a <= b ? a : b;
}
/** Merge two enrollment entries that now point at the same lesson id: keep the
 *  most-advanced status, the earliest startedAt, and the union of submissions
 *  (deduped by id, oldest first) — so consolidating lessons never drops a
 *  learner's real work. */
function mergeLessonEntries(a: EnrollmentLessonEntry, b: EnrollmentLessonEntry): EnrollmentLessonEntry {
  const status = statusRank(b.status) > statusRank(a.status) ? b.status : a.status;
  const seen = new Set<string>();
  const submissions: Submission[] = [...a.submissions, ...b.submissions]
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((x, y) => (x.submittedAt < y.submittedAt ? -1 : x.submittedAt > y.submittedAt ? 1 : 0));
  return { lessonId: a.lessonId, ...(status !== undefined ? { status } : {}), ...(earliestIso(a.startedAt, b.startedAt) !== undefined ? { startedAt: earliestIso(a.startedAt, b.startedAt) } : {}), submissions };
}

/**
 * Rewrite a stored enrollment's lesson ids through a mapping (old id → new id),
 * merging any entries that collapse onto the same new id. Ids absent from the
 * mapping are kept as-is (an admin/legacy lesson keeps its own id). Pure: the
 * input enrollment is not mutated. This is the v2→v3 progress bridge the
 * curriculum-module migration applies to every stored enrollment so a learner's
 * place and submissions survive the module-id change.
 */
export function remapEnrollmentLessonIds(enrollment: Enrollment, mapping: Readonly<Record<string, string>>): Enrollment {
  const byNewId = new Map<string, EnrollmentLessonEntry>();
  const order: string[] = [];
  for (const entry of enrollment.lessons) {
    const newId = mapping[entry.lessonId] ?? entry.lessonId;
    const remapped: EnrollmentLessonEntry = { ...entry, lessonId: newId, submissions: [...entry.submissions] };
    const existing = byNewId.get(newId);
    if (existing) {
      byNewId.set(newId, mergeLessonEntries(existing, remapped));
    } else {
      byNewId.set(newId, remapped);
      order.push(newId);
    }
  }
  return { ...enrollment, lessons: order.map((id) => byNewId.get(id)!) };
}
