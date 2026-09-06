import { currentUser } from "../../../../../../lib/auth";
import { roleOf } from "../../../../../../lib/workspaces";
import { getChapter4SubmissionById } from "../../../../../../lib/chapter4-submissions";
import { getChapter4SubmissionForReview, submitChapter4Review, type Chapter4Decision } from "../../../../../../lib/coaching/chapter-4-review";
import { recordActivity } from "../../../../../../lib/activity";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const DECISIONS = new Set<Chapter4Decision>(["approve", "request_changes"]);

// Keyed by the coach's own user id (the workspace isn't known until the body
// is parsed — same reasoning as community/comments's POST_LIMIT, applied to
// the actor instead of a workspace). Generous enough for a coach clearing a
// real backlog in one sitting, bounded enough that a scripted flood of
// decisions can't hammer the DB or spam a learner with review emails.
const REVIEW_LIMIT = { windowMs: 5 * 60_000, max: 40 };

/** A coach's not-authorized / not-found distinction for
 *  getChapter4SubmissionForReview's single {error} shape — both messages are
 *  ones this module itself writes (see lib/coaching/chapter-4-review.ts), so
 *  matching on them here is safe rather than fragile string-sniffing of
 *  arbitrary text. */
function statusForReviewError(message: string): number {
  return message.includes("owner or a manager") ? 403 : 404;
}

/** Fetch one Chapter 4 submission for a coach to review: the plan, its
 *  subchapter breakdown, and the learner's wider programme context — see
 *  lib/coaching/chapter-4-review.ts's SubmissionReview. Same GET-alongside-
 *  POST shape as most single-resource routes in this app; kept in this file
 *  rather than a separate one since it's the one place a review page needs
 *  to call to load what the POST below acts on. */
export const GET = withRouteLogging("api/coaching/chapter/4/review:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const submissionId = new URL(req.url).searchParams.get("submission_id");
  if (!submissionId) return json({ error: "submission_id is required" }, 400);

  const result = await getChapter4SubmissionForReview(submissionId, user.id);
  if ("error" in result) return json({ error: result.error }, statusForReviewError(result.error));
  return json({ review: result });
});

/** Coach action — owner or manager on the submission's workspace only (see
 *  lib/enrollments.ts's header for why "manager" is this app's stand-in for
 *  a coach role). Approves or requests changes on a Chapter 4 (Growth &
 *  Improvement Plan) submission: updates chapter_4_submissions
 *  (coach_decision/coach_feedback/reviewed_at/reviewed_by — see
 *  lib/chapter4-submissions.ts's reviewChapter4Submission), notifies the
 *  learner in-app + by email, and logs the action to the workspace's
 *  activity feed. */
export const POST = withRouteLogging("api/coaching/chapter/4/review:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const rl = await checkRateLimit(`chapter4-review:${user.id}`, REVIEW_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { submission_id?: unknown; decision?: unknown; feedback?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.submission_id !== "string" || !body.submission_id) return json({ error: "submission_id is required" }, 400);
  if (typeof body.decision !== "string" || !DECISIONS.has(body.decision as Chapter4Decision)) {
    return json({ error: "decision must be 'approve' or 'request_changes'" }, 400);
  }
  const feedback = typeof body.feedback === "string" ? body.feedback : undefined;

  // Pre-check to resolve the submission's workspace for the role check —
  // same accepted small staleness window lib/chapter-submissions.ts's own
  // pre-lock reads take (see that file's header); the actual decision below
  // re-reads under an advisory lock before writing.
  const pre = await getChapter4SubmissionById(body.submission_id);
  if (!pre) return json({ error: "Submission not found." }, 404);
  const role = await roleOf(pre.workspaceId, user.id);
  if (role !== "owner" && role !== "manager") return json({ error: "Only the workspace owner or a manager can review this submission." }, 403);

  const result = await submitChapter4Review({
    submissionId: body.submission_id, decision: body.decision as Chapter4Decision, feedback, coachEmail: user.email,
  });
  if ("error" in result) return json({ error: result.error }, 400);

  await recordActivity(pre.workspaceId, { actorEmail: user.email, action: "programme.chapter4_review", detail: body.decision });
  return json({ ok: true });
});
