/**
 * Coaching email notifications for programme review events.
 *
 * Two moments in the review loop get an email:
 *   1. A learner submits an assignment → the workspace's coach(es) hear about
 *      it, so a submission doesn't sit unreviewed just because nobody happened
 *      to look at the studio.
 *   2. A coach approves or requests changes → the learner hears the verdict
 *      (and any feedback), so they know to move on or take another pass.
 *
 * "Coach" is the workspace's manager role and "learner" is the workspace
 * owner — the same mapping lib/enrollments.ts's header explains (a workspace
 * represents one learner's business; a coach is invited into it as a manager).
 *
 * Everything here is best-effort and NEVER throws: these run fire-and-forget
 * after the API's DB write has already committed, so a missing recipient or a
 * mailer hiccup must not turn a successful submit/review into an error. When a
 * recipient email can't be resolved we simply return { sent: false } and move
 * on. The pure message builders and recipient selectors are exported so they
 * can be unit-tested without any DB or network.
 */
import { sendMail, type MailMessage, type SendResult } from "./mailer";
import { listWorkspaceMemberSummaries, type Role } from "./workspaces";
import { getDefaultProgramme } from "./curriculum-store";
import { createNotification } from "./notifications";
import { CHAPTER_4_STAGE_ID } from "./enrollments";
import { findLesson, orderedStages, type ProgrammeTemplate } from "@onevyrt/engine";

/** Where the review inbox lives in the app — relative on purpose. There's no
 *  configured absolute base URL here, so a relative path is the honest link:
 *  it resolves correctly once the recipient is signed in, and never bakes a
 *  wrong host into the mail. */
const PROGRAMME_PANEL_LINK = "/studio?panel=programme";
/** Same relative-link reasoning as PROGRAMME_PANEL_LINK above. */
const TRANSFORMATION_REPORT_LINK = "/account/transformation-report";

/** One member row as listWorkspaceMemberSummaries returns it. */
export interface MemberSummary { userId: string; email: string; role: Role }

/** Coaches to notify of a new submission: the workspace's manager(s), minus
 *  whoever actually submitted (a manager submitting their own work shouldn't
 *  email themselves about it). Deduped by email. */
export function selectCoachRecipients(members: MemberSummary[], submitterEmail?: string): string[] {
  const submitter = submitterEmail?.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of members) {
    if (m.role !== "manager") continue;
    const email = m.email.trim();
    const key = email.toLowerCase();
    if (!email || key === submitter || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

/** The learner to notify of a review: the workspace owner. Returns undefined
 *  if there's no owner row, or if the owner is the reviewer themselves (a solo
 *  owner reviewing their own submission — no point emailing yourself). */
export function selectLearnerRecipient(members: MemberSummary[], reviewerEmail?: string): string | undefined {
  const reviewer = reviewerEmail?.trim().toLowerCase();
  const owner = members.find((m) => m.role === "owner" && m.email.trim());
  if (!owner) return undefined;
  const email = owner.email.trim();
  return email.toLowerCase() === reviewer ? undefined : email;
}

/** Human-readable lesson title, falling back to the raw id if the lesson
 *  can't be found in the programme (shouldn't happen, but never block a mail
 *  on it). */
export function lessonTitleOf(programme: ProgrammeTemplate, lessonId: string): string {
  return findLesson(programme, lessonId)?.lesson.title ?? lessonId;
}

/** Pure: the email a coach gets when a learner submits an assignment. */
export function buildSubmissionEmail(params: { to: string; learnerEmail: string; lessonTitle: string }): MailMessage {
  const { to, learnerEmail, lessonTitle } = params;
  return {
    to,
    subject: `New submission to review — ${lessonTitle}`,
    text:
      `${learnerEmail} just submitted work for review on "${lessonTitle}".\n\n` +
      `Open the programme to review it: ${PROGRAMME_PANEL_LINK}`,
  };
}

/** Pure: the email a learner gets when a coach reviews their submission. */
export function buildReviewEmail(params: {
  to: string;
  decision: "approved" | "changes_requested";
  lessonTitle: string;
  feedback?: string;
}): MailMessage {
  const { to, decision, lessonTitle, feedback } = params;
  const approved = decision === "approved";
  const subject = approved
    ? `Approved — ${lessonTitle}`
    : `Changes requested — ${lessonTitle}`;
  const headline = approved
    ? `Your submission for "${lessonTitle}" was approved. Nice work.`
    : `Your coach requested changes on "${lessonTitle}".`;
  const feedbackClean = feedback?.trim();
  const text =
    `${headline}\n\n` +
    (feedbackClean ? `Coach feedback:\n${feedbackClean}\n\n` : "") +
    `Open the programme: ${PROGRAMME_PANEL_LINK}`;
  return { to, subject, text };
}

/** Notify the workspace's coach(es) that a learner submitted an assignment.
 *  Best-effort; never throws. Returns { sent: true } if at least one coach
 *  email went out (or was handed to the mailer), else { sent: false }. */
export async function notifyCoachOfSubmission(params: {
  workspaceId: string;
  lessonId: string;
  learnerEmail: string;
}): Promise<SendResult> {
  try {
    const [members, programme] = await Promise.all([
      listWorkspaceMemberSummaries(params.workspaceId),
      getDefaultProgramme(),
    ]);
    const coaches = selectCoachRecipients(members, params.learnerEmail);
    if (coaches.length === 0) return { sent: false, reason: "No coach to notify." };
    const lessonTitle = lessonTitleOf(programme, params.lessonId);
    const results = await Promise.all(
      coaches.map((to) => sendMail(buildSubmissionEmail({ to, learnerEmail: params.learnerEmail, lessonTitle }))),
    );
    return results.some((r) => r.sent) ? { sent: true } : { sent: false, reason: "No coach email delivered." };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Failed to notify coach." };
  }
}

/** Pure: the email a coach gets when a learner submits their Chapter 4 Growth
 *  & Improvement Plan for review. Mirrors buildSubmissionEmail, but Chapter
 *  4's output isn't a lesson (see lib/chapter4-submissions.ts) — there's no
 *  lesson title to look up, just the one named artifact. */
export function buildChapter4SubmissionEmail(params: { to: string; learnerEmail: string }): MailMessage {
  const { to, learnerEmail } = params;
  return {
    to,
    subject: "New submission to review — Growth & Improvement Plan",
    text:
      `${learnerEmail} just submitted their Growth & Improvement Plan (Chapter 4: Improve & Scale) for review.\n\n` +
      `Open the programme to review it: ${PROGRAMME_PANEL_LINK}`,
  };
}

/** Notify the workspace's coach(es) that a learner submitted their Chapter 4
 *  Growth & Improvement Plan for review. Best-effort; never throws — same
 *  fire-and-forget contract as notifyCoachOfSubmission. */
export async function notifyCoachOfChapter4Submission(params: {
  workspaceId: string;
  learnerEmail: string;
}): Promise<SendResult> {
  try {
    const members = await listWorkspaceMemberSummaries(params.workspaceId);
    const coaches = selectCoachRecipients(members, params.learnerEmail);
    if (coaches.length === 0) return { sent: false, reason: "No coach to notify." };
    const results = await Promise.all(
      coaches.map((to) => sendMail(buildChapter4SubmissionEmail({ to, learnerEmail: params.learnerEmail }))),
    );
    return results.some((r) => r.sent) ? { sent: true } : { sent: false, reason: "No coach email delivered." };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Failed to notify coach." };
  }
}

/** Pure: the email a learner gets when a coach reviews their Chapter 4 Growth
 *  & Improvement Plan. Mirrors buildReviewEmail, but — like
 *  buildChapter4SubmissionEmail above — Chapter 4's output isn't a lesson, so
 *  there's no lesson title to look up. */
export function buildChapter4ReviewEmail(params: { to: string; decision: "approved" | "changes_requested"; feedback?: string }): MailMessage {
  const { to, decision, feedback } = params;
  const approved = decision === "approved";
  const subject = approved ? "Approved — Growth & Improvement Plan" : "Changes requested — Growth & Improvement Plan";
  const headline = approved
    ? "Your Growth & Improvement Plan (Chapter 4: Improve & Scale) was approved. Nice work."
    : "Your coach requested changes on your Growth & Improvement Plan (Chapter 4: Improve & Scale).";
  const feedbackClean = feedback?.trim();
  const text =
    `${headline}\n\n` +
    (feedbackClean ? `Coach feedback:\n${feedbackClean}\n\n` : "") +
    `Open the programme: ${PROGRAMME_PANEL_LINK}`;
  return { to, subject, text };
}

/** Notify the learner (workspace owner) that their Chapter 4 Growth &
 *  Improvement Plan was reviewed — an in-app bell notification (see
 *  lib/notifications.ts) AND email, the two channels every coaching review
 *  event should reach the learner on. The lesson/Chapter 1-3 review path
 *  below (notifyLearnerOfReview) predates the in-app bell and has never been
 *  wired to it; this one carries both from the start rather than repeating
 *  that gap for Chapter 4. Best-effort; never throws — the in-app write and
 *  the email are independent (one failing never blocks the other), and
 *  neither has a dedupeKey, matching every other review notification in this
 *  file (see header) — a genuine double-send needs a retried request within
 *  the same review action, a risk this file already accepts elsewhere. */
export async function notifyLearnerOfChapter4Review(params: {
  workspaceId: string;
  decision: "approved" | "changes_requested";
  reviewerEmail?: string;
  feedback?: string;
}): Promise<SendResult> {
  try {
    const members = await listWorkspaceMemberSummaries(params.workspaceId);
    const owner = members.find((m) => m.role === "owner" && m.email.trim());
    const learner = selectLearnerRecipient(members, params.reviewerEmail);
    if (!learner || !owner) return { sent: false, reason: "No learner to notify." };
    const approved = params.decision === "approved";
    await createNotification({
      userId: owner.userId, workspaceId: params.workspaceId, type: "chapter4_review",
      title: approved ? "Growth & Improvement Plan approved" : "Changes requested on your Growth & Improvement Plan",
      body: approved
        ? "Your coach approved your Growth & Improvement Plan."
        : (params.feedback?.trim() || "Your coach asked for changes — open the programme to see their notes."),
      linkUrl: PROGRAMME_PANEL_LINK,
    }).catch(() => null); // in-app notification is a bonus channel — never let it block the email below
    return await sendMail(buildChapter4ReviewEmail({ to: learner, decision: params.decision, feedback: params.feedback }));
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Failed to notify learner." };
  }
}

/** Human-readable stage/chapter title, falling back to the raw id if the
 *  stage isn't found — mirrors lessonTitleOf, one level up (a chapter, not a
 *  lesson within it). Used by the CHAPTER-level submit/review notifications
 *  below, which cover every chapter's OUTPUT submission (start/chapter-1-4/
 *  finish — see @onevyrt/engine chapter-gates.ts's ChapterSubmission), not
 *  just Chapter 4's. */
export function chapterTitleOf(programme: ProgrammeTemplate, stageId: string): string {
  return orderedStages(programme).find((s) => s.id === stageId)?.title ?? stageId;
}

/** Pure: the email a coach gets when a learner submits a CHAPTER's output
 *  (e.g. the Business Psychology Blueprint, or Chapter 4's Growth &
 *  Improvement Plan) for review — the chapter-level analogue of
 *  buildSubmissionEmail. Generic over every chapter id, including
 *  "chapter-4": once it's a real canonical stage (see
 *  packages/engine/src/curriculum-chapters.ts), its coach-approval
 *  submissions go through the SAME chapter_submissions storage and the SAME
 *  /api/programme/chapters/[stageId]/submit route every other chapter uses,
 *  so they get this same notification for free. */
export function buildChapterSubmissionEmail(params: { to: string; learnerEmail: string; chapterTitle: string }): MailMessage {
  const { to, learnerEmail, chapterTitle } = params;
  return {
    to,
    subject: `New submission to review — ${chapterTitle}`,
    text:
      `${learnerEmail} just submitted "${chapterTitle}" for review.\n\n` +
      `Open the programme to review it: ${PROGRAMME_PANEL_LINK}`,
  };
}

/** Pure: the email a learner gets when a coach reviews a chapter's submitted
 *  output — the chapter-level analogue of buildReviewEmail. */
export function buildChapterReviewEmail(params: {
  to: string;
  decision: "approved" | "changes_requested";
  chapterTitle: string;
  feedback?: string;
}): MailMessage {
  const { to, decision, chapterTitle, feedback } = params;
  const approved = decision === "approved";
  const subject = approved ? `Approved — ${chapterTitle}` : `Changes requested — ${chapterTitle}`;
  const headline = approved
    ? `Your submission for "${chapterTitle}" was approved. Nice work.`
    : `Your coach requested changes on "${chapterTitle}".`;
  const feedbackClean = feedback?.trim();
  const text =
    `${headline}\n\n` +
    (feedbackClean ? `Coach feedback:\n${feedbackClean}\n\n` : "") +
    `Open the programme: ${PROGRAMME_PANEL_LINK}`;
  return { to, subject, text };
}

/** Notify the workspace's coach(es) that a learner submitted a CHAPTER's
 *  output (not a single lesson) for review — fired from
 *  api/programme/chapters/[stageId]/submit, covering every chapter including
 *  Chapter 4 once it exists as a canonical stage. Best-effort; never throws,
 *  same contract as notifyCoachOfSubmission. */
export async function notifyCoachOfChapterSubmission(params: {
  workspaceId: string;
  stageId: string;
  learnerEmail: string;
}): Promise<SendResult> {
  try {
    const [members, programme] = await Promise.all([
      listWorkspaceMemberSummaries(params.workspaceId),
      getDefaultProgramme(),
    ]);
    const coaches = selectCoachRecipients(members, params.learnerEmail);
    if (coaches.length === 0) return { sent: false, reason: "No coach to notify." };
    const chapterTitle = chapterTitleOf(programme, params.stageId);
    const results = await Promise.all(
      coaches.map((to) => sendMail(buildChapterSubmissionEmail({ to, learnerEmail: params.learnerEmail, chapterTitle }))),
    );
    return results.some((r) => r.sent) ? { sent: true } : { sent: false, reason: "No coach email delivered." };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Failed to notify coach." };
  }
}

/** Pure: the email a learner gets once their Transformation Report is ready
 *  to view — fired alongside (not instead of) the ordinary Chapter 4 approval
 *  email, only on the one review that actually unlocks Finish (see
 *  chapterGates() in the engine: Chapter 4 approved -> Finish unlocked). */
export function buildReportReadyEmail(params: { to: string }): MailMessage {
  return {
    to: params.to,
    subject: "Your Transformation Report is ready",
    text:
      "Your Chapter 4 (Improve & Scale) plan was approved — your Transformation Report is now ready, " +
      "compiled from your whole journey plus a Next 90-Day Plan pulled straight from your approved Growth & Improvement Plan.\n\n" +
      `View it here: ${TRANSFORMATION_REPORT_LINK}`,
  };
}

/** Notify the learner (workspace owner) of a coach's decision on a CHAPTER's
 *  submitted output — fired from api/programme/chapters/[stageId]/review.
 *  Carries both an in-app bell notification and an email, the same two-channel
 *  contract notifyLearnerOfChapter4Review established (chapter-level review
 *  events reaching the learner on both channels, not just email). Best-effort;
 *  never throws. */
export async function notifyLearnerOfChapterReview(params: {
  workspaceId: string;
  stageId: string;
  decision: "approved" | "changes_requested";
  reviewerEmail?: string;
  feedback?: string;
}): Promise<SendResult> {
  try {
    const [members, programme] = await Promise.all([
      listWorkspaceMemberSummaries(params.workspaceId),
      getDefaultProgramme(),
    ]);
    const owner = members.find((m) => m.role === "owner" && m.email.trim());
    const learner = selectLearnerRecipient(members, params.reviewerEmail);
    if (!learner || !owner) return { sent: false, reason: "No learner to notify." };
    const chapterTitle = chapterTitleOf(programme, params.stageId);
    const approved = params.decision === "approved";
    await createNotification({
      userId: owner.userId, workspaceId: params.workspaceId, type: "chapter_review",
      title: approved ? `Approved — ${chapterTitle}` : `Changes requested — ${chapterTitle}`,
      body: approved
        ? `Your coach approved "${chapterTitle}".`
        : (params.feedback?.trim() || `Your coach asked for changes on "${chapterTitle}" — open the programme to see their notes.`),
      linkUrl: PROGRAMME_PANEL_LINK,
    }).catch(() => null); // in-app notification is a bonus channel — never let it block the email below

    // Chapter 4 approval is the one review that also unlocks Finish — the
    // learner's Transformation Report becomes viewable at that moment, so
    // tell them, ALONGSIDE (not instead of) the ordinary approval email
    // above. dedupeKey means a coach re-reviewing an already-approved
    // Chapter 4 (e.g. after a resubmission) never re-announces this.
    if (approved && params.stageId === CHAPTER_4_STAGE_ID) {
      await createNotification({
        userId: owner.userId, workspaceId: params.workspaceId, type: "report_ready",
        title: "Your Transformation Report is ready",
        body: "Chapter 4 approved — your full journey report and Next 90-Day Plan are ready to view.",
        linkUrl: TRANSFORMATION_REPORT_LINK,
        dedupeKey: `report_ready:${params.workspaceId}`,
      }).catch(() => null);
      await sendMail(buildReportReadyEmail({ to: learner })).catch(() => null);
    }

    return await sendMail(buildChapterReviewEmail({ to: learner, decision: params.decision, chapterTitle, feedback: params.feedback }));
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Failed to notify learner." };
  }
}

/** Notify the learner (workspace owner) of a coach's review decision.
 *  Best-effort; never throws. */
export async function notifyLearnerOfReview(params: {
  workspaceId: string;
  lessonId: string;
  decision: "approved" | "changes_requested";
  reviewerEmail?: string;
  feedback?: string;
}): Promise<SendResult> {
  try {
    const [members, programme] = await Promise.all([
      listWorkspaceMemberSummaries(params.workspaceId),
      getDefaultProgramme(),
    ]);
    const learner = selectLearnerRecipient(members, params.reviewerEmail);
    if (!learner) return { sent: false, reason: "No learner to notify." };
    const lessonTitle = lessonTitleOf(programme, params.lessonId);
    return await sendMail(buildReviewEmail({ to: learner, decision: params.decision, lessonTitle, feedback: params.feedback }));
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Failed to notify learner." };
  }
}
