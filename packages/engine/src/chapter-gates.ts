/**
 * Chapter approval gates (Phase 2 spec §6/§10): the coach approves the
 * *business decision* at the end of each chapter — not whether a lesson was
 * opened. A chapter is submitted as one output, the coach reviews it, and only
 * an approval unlocks the next chapter.
 *
 * This is the pure model: given the curriculum, the learner's enrollment (for
 * lesson completion) and the coach's per-chapter decisions, it computes each
 * chapter's gate state and whether it unlocks the next one. The chapter
 * submissions are a new, small overlay the coaching layer persists later; the
 * engine owns the state machine so every surface reads one answer.
 *
 * Pure: no storage, no I/O.
 */
import type { ProgrammeTemplate } from "./curriculum.ts";
import { orderedStages, orderedLessons } from "./curriculum.ts";
import { CANONICAL_STAGES } from "./curriculum-chapters.ts";
import type { Enrollment } from "./enrollment.ts";
import { effectiveStatus, capStatusByStage } from "./enrollment.ts";

/** The coach's decision on a submitted chapter output. */
export type ChapterReviewStatus = "submitted" | "approved" | "changes_requested";

/** One submission of a chapter's output for coach review — the chapter-level
 *  analogue of a lesson Submission. Persisted by the coaching layer. */
export interface ChapterSubmission {
  stageId: string;
  submittedAt: string;
  /** The chapter output the coach reviews (e.g. the Business Psychology Blueprint). */
  evidence: string;
  reviewStatus: ChapterReviewStatus;
  coachFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type ChapterGateState =
  | "locked" // the previous chapter isn't approved yet
  | "in_progress" // lessons still to finish
  | "ready_to_submit" // all lessons done, output not yet submitted
  | "awaiting_review" // submitted, waiting on the coach
  | "changes_requested" // coach asked for changes
  | "approved"; // coach approved — unlocks the next chapter

export interface ChapterGate {
  stageId: string;
  title: string;
  order: number;
  /** The output document this chapter compiles toward, if it's a canonical chapter. */
  output: string | null;
  state: ChapterGateState;
  lessonsComplete: number;
  lessonsTotal: number;
  /** True once approved — the signal the next chapter reads to unlock. */
  unlocksNext: boolean;
  /** The latest submission for this chapter, if any. */
  submission?: ChapterSubmission;
}

const OUTPUT_BY_STAGE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(CANONICAL_STAGES.map((s) => [s.id, s.output] as const)),
);

function latestSubmissionFor(subs: readonly ChapterSubmission[], stageId: string): ChapterSubmission | undefined {
  let latest: ChapterSubmission | undefined;
  for (const s of subs) {
    if (s.stageId !== stageId) continue;
    if (!latest || s.submittedAt >= latest.submittedAt) latest = s;
  }
  return latest;
}

/**
 * Compute the gate for every chapter, in order. A chapter is locked until the
 * one before it is approved (the first chapter is never locked). Within an
 * unlocked chapter the state follows lesson completion, then the coach's
 * decision on the submitted output.
 */
export function chapterGates(
  programme: ProgrammeTemplate,
  enrollment: Enrollment,
  submissions: readonly ChapterSubmission[] = [],
  stageAccessLimit: number | null | undefined = null,
): ChapterGate[] {
  const gates: ChapterGate[] = [];
  let prevApproved = true; // the first chapter has no predecessor to gate it

  for (const stage of orderedStages(programme)) {
    const lessons = orderedLessons(stage);
    const lessonsTotal = lessons.length;
    const lessonsComplete = lessons.filter((l) => {
      const status = capStatusByStage(programme, l.id, effectiveStatus(programme, enrollment, l.id), stageAccessLimit);
      return status === "approved" || status === "completed";
    }).length;

    const submission = latestSubmissionFor(submissions, stage.id);

    let state: ChapterGateState;
    if (!prevApproved) {
      state = "locked";
    } else if (submission?.reviewStatus === "approved") {
      state = "approved";
    } else if (submission?.reviewStatus === "changes_requested") {
      state = "changes_requested";
    } else if (submission?.reviewStatus === "submitted") {
      state = "awaiting_review";
    } else if (lessonsTotal > 0 && lessonsComplete === lessonsTotal) {
      state = "ready_to_submit";
    } else {
      state = "in_progress";
    }

    const unlocksNext = state === "approved";
    gates.push({
      stageId: stage.id,
      title: stage.title,
      order: stage.order,
      output: OUTPUT_BY_STAGE[stage.id] ?? null,
      state,
      lessonsComplete,
      lessonsTotal,
      unlocksNext,
      ...(submission ? { submission } : {}),
    });
    prevApproved = unlocksNext;
  }

  return gates;
}
