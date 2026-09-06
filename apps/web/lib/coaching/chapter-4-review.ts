/**
 * Coach review for Chapter 4 (IMPROVE & SCALE) — the Growth & Improvement
 * Plan. This is the read/decide surface over lib/chapter4-submissions.ts's
 * `chapter_4_submissions` table (one row per workspace_id, structured `data`
 * — current position, bottleneck, actions, 90-day impact — built up across
 * subchapters 4.1-4.6), whose own header reserves the coach_decision /
 * coach_feedback / reviewed_at / reviewed_by columns for exactly this slice.
 *
 * IMPORTANT — this is deliberately NOT the same mechanism chapters 1-3 use.
 * Chapters 1-3's coach approval rides the engine's chapterGates() against a
 * generic `chapter_submissions` table (lib/chapter-submissions.ts) — a
 * free-text evidence blob per chapter, gated on lesson completion. Chapter
 * 4's output is structured data an artifact renders directly, and the engine
 * doesn't carry a "chapter-4" stage yet (packages/engine/src/
 * curriculum-chapters.ts's CANONICAL_STAGES — that's a separate, parallel
 * workstream). So Chapter 4 approval here is workspace-membership-gated
 * only, exactly like the learner-facing submit/get routes
 * (app/api/programme/chapter/4/submit, .../get) already are — never gated on
 * chapterGates()/engine reachability. Learner PROGRESS through the engine
 * (Start/Chapters 1-3) is still read for context (getLearnerContext below),
 * since that part of the journey is real and worth showing a coach.
 *
 * "Coach" = the workspace's manager role (or its owner reviewing their own
 * workspace) — see lib/enrollments.ts's header for why; "coach's cohorts"
 * means every workspace they are owner/manager of, the same definition
 * app/api/programme/coach-workspaces/route.ts already uses (a formal
 * `cohorts` row is for session scheduling/pacing, not access control).
 */
import { chapterGates, newEnrollment, type Enrollment } from "@onevyrt/engine";
import { getDefaultProgramme } from "../curriculum-store";
import { effectiveStageAccessLimit } from "../cohorts";
import { getEnrollment, CHAPTER_4_STAGE_ID } from "../enrollments";
import { listChapterSubmissions, reviewChapter4SubmissionAtomically } from "../chapter-submissions";
import { getWorkspace, roleOf, listWorkspaceMemberSummaries } from "../workspaces";
import {
  getChapter4SubmissionById,
  CHAPTER_4_SUBCHAPTERS, type Chapter4Submission, type Chapter4Subchapter,
} from "../chapter4-submissions";
import { notifyLearnerOfChapter4Review } from "../programme-notifications";

/** Human-facing titles for the 4.1-4.6 subchapters, per
 *  docs/IMPLEMENTATION_ROADMAP.md's Chapter 4 curriculum table. Storage
 *  (lib/chapter4-submissions.ts) only tracks IDs + which are done — the
 *  titles are a presentation concern, kept here alongside the coach-review
 *  surface that needs to label them. */
const SUBCHAPTER_TITLE: Record<Chapter4Subchapter, string> = {
  "4.1": "Find the Bottleneck",
  "4.2": "Improve Conversion",
  "4.3": "Improve Profit",
  "4.4": "Systemise & Automate",
  "4.5": "Build the Growth Plan",
  "4.6": "Team & Capacity (optional)",
};

export type Chapter4Decision = "approve" | "request_changes";
const DECISION_TO_REVIEW_STATUS: Record<Chapter4Decision, "approved" | "changes_requested"> = {
  approve: "approved",
  request_changes: "changes_requested",
};

/** One subchapter's completion state, for the coach's "all subchapter
 *  responses" view. `fields` is the relevant slice of the plan's structured
 *  data for that subchapter — a subchapter with no fields of its own (4.2,
 *  4.4) just reports whether the learner has marked it done. */
export interface SubchapterResponse {
  id: Chapter4Subchapter;
  title: string;
  completed: boolean;
  fields: Record<string, unknown> | null;
}

export interface LearnerContext {
  userId: string;
  email: string;
  percentComplete: number;
  completedLessons: number;
  totalLessons: number;
  /** Chapters 1-3's own engine-gated approval state — "did this learner
   *  actually clear the chapters before Chapter 4?" at a glance. Chapter 4
   *  itself is intentionally absent (see file header — it isn't an engine
   *  stage). */
  previousChapters: { stageId: string; title: string; order: number; state: string }[];
}

export interface SubmissionReview {
  submissionId: string;
  workspaceId: string;
  workspaceName: string;
  learner: LearnerContext | null;
  submission: Chapter4Submission | null;
  subchapters: SubchapterResponse[];
  /** True once the submission is actionable right now — status is
   *  "submitted" (awaiting review). False (and the review form should be
   *  disabled) when there's nothing submitted yet ("in_progress") or a
   *  decision has already been made ("approved"/"changes_requested") and the
   *  learner hasn't resubmitted since. */
  reviewable: boolean;
}

function subchaptersOf(submission: Chapter4Submission | null): SubchapterResponse[] {
  const completed = new Set(submission?.data.completedSubchapters ?? []);
  const d = submission?.data;
  const fieldsFor: Record<Chapter4Subchapter, Record<string, unknown> | null> = {
    "4.1": d?.bottleneck ? { ...d.bottleneck } : null,
    "4.2": null, // conversion-improvement actions live under 4.5's action plan, not a field of their own
    "4.3": d?.currentPosition ? { ...d.currentPosition } : null,
    "4.4": null, // systemise/automate actions likewise fold into 4.5's action plan
    "4.5": d?.actions && d.actions.length > 0 ? { actions: d.actions, impact: d.impact ?? null } : null,
    "4.6": null, // optional; no dedicated data field yet
  };
  return CHAPTER_4_SUBCHAPTERS.map((id) => ({
    id, title: SUBCHAPTER_TITLE[id], completed: completed.has(id), fields: fieldsFor[id],
  }));
}

/** Learner's progress through Start/Chapters 1-3, for the coach's context
 *  panel — the same defensive "no enrollment yet" fallback
 *  lib/chapter-submissions.ts's chapterGateInputs() uses, so a coach opening
 *  a brand-new workspace's Chapter 4 submission sees "nothing done yet," not
 *  a crash. */
async function getLearnerContext(workspaceId: string): Promise<LearnerContext | null> {
  const members = await listWorkspaceMemberSummaries(workspaceId);
  const owner = members.find((m) => m.role === "owner" && m.email.trim());
  if (!owner) return null;

  const [programme, stageAccessLimit, enrollment, chapterSubmissions] = await Promise.all([
    getDefaultProgramme(),
    effectiveStageAccessLimit(workspaceId),
    getEnrollment(workspaceId),
    listChapterSubmissions(workspaceId),
  ]);
  const eff: Enrollment = enrollment ?? newEnrollment("", programme.id, workspaceId, "", "self_paced");
  const gates = chapterGates(programme, eff, chapterSubmissions, stageAccessLimit);
  const totalLessons = gates.reduce((n, g) => n + g.lessonsTotal, 0);
  const completedLessons = gates.reduce((n, g) => n + g.lessonsComplete, 0);

  return {
    userId: owner.userId, email: owner.email,
    percentComplete: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    completedLessons, totalLessons,
    previousChapters: gates.filter((g) => g.stageId.startsWith("chapter-"))
      .map((g) => ({ stageId: g.stageId, title: g.title, order: g.order, state: g.state })),
  };
}

/** Fetch one Chapter 4 submission for a coach to review — the whole payload
 *  a review page needs in one call: the plan itself, its subchapter
 *  breakdown, and the learner's wider programme context. Enforces that
 *  `coachId` is the workspace's owner or manager (see file header). Looks up
 *  by the submission's own stable `id` (lib/chapter4-submissions.ts), not by
 *  workspace id — that's what a review page/request actually has. */
export async function getChapter4SubmissionForReview(submissionId: string, coachId: string): Promise<SubmissionReview | { error: string }> {
  if (!submissionId) return { error: "A submission id is required." };
  const submission = await getChapter4SubmissionById(submissionId);
  if (!submission) return { error: "Submission not found." };

  const role = await roleOf(submission.workspaceId, coachId);
  if (role !== "owner" && role !== "manager") return { error: "Only the workspace owner or a manager can review this submission." };

  const workspace = await getWorkspace(submission.workspaceId);
  if (!workspace) return { error: "Workspace not found." };

  const learner = await getLearnerContext(submission.workspaceId);

  return {
    submissionId: submission.id,
    workspaceId: submission.workspaceId,
    workspaceName: workspace.name,
    learner,
    submission,
    subchapters: subchaptersOf(submission),
    reviewable: submission.status === "submitted",
  };
}

/** A coach approves or requests changes on a Chapter 4 submission. Uses the
 *  atomic function reviewChapter4SubmissionAtomically() to keep both
 *  chapter_submissions (authoritative gating table) and chapter_4_submissions
 *  (enriched plan data) in sync within one advisory lock. On success, notifies
 *  the learner. Permission is NOT re-checked here: the caller (the API route)
 *  already validated coach access against the submission's workspace, the same
 *  layering app/api/programme/chapters/[stageId]/review/route.ts uses around
 *  the analogous reviewChapterSubmission() call. */
export async function submitChapter4Review(input: {
  submissionId: string;
  decision: Chapter4Decision;
  feedback?: string;
  coachEmail: string;
}): Promise<{ ok: true } | { error: string }> {
  const reviewStatus = DECISION_TO_REVIEW_STATUS[input.decision];
  if (!reviewStatus) return { error: "decision must be 'approve' or 'request_changes'." };

  // First resolve the workspace id from the submission's id.
  const submission = await getChapter4SubmissionById(input.submissionId);
  if (!submission) return { error: "Submission not found." };

  // Use atomic function that updates both tables in one lock.
  const ok = await reviewChapter4SubmissionAtomically(submission.workspaceId, CHAPTER_4_STAGE_ID, {
    reviewStatus, coachFeedback: input.feedback, reviewedBy: input.coachEmail,
  });
  if (!ok) return { error: "This plan isn't currently awaiting review." };

  await notifyLearnerOfReview(submission.workspaceId, reviewStatus, input.feedback);
  return { ok: true };
}

/** Notify the learner (workspace owner) that their Growth & Improvement Plan
 *  was reviewed — in-app bell notification + email (see
 *  lib/programme-notifications.ts's notifyLearnerOfChapter4Review, the
 *  shared implementation). Best-effort; never throws — a mailer hiccup must
 *  never turn a successful review into a failed request. */
export async function notifyLearnerOfReview(workspaceId: string, decision: "approved" | "changes_requested", feedback?: string): Promise<void> {
  await notifyLearnerOfChapter4Review({ workspaceId, decision, feedback }).catch(() => { /* best-effort, see header */ });
}
