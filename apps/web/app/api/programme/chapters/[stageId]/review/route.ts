import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { reviewChapterSubmission, reviewChapter4SubmissionAtomically } from "../../../../../../lib/chapter-submissions";
import { notifyLearnerOfChapterReview } from "../../../../../../lib/programme-notifications";
import { CHAPTER_4_STAGE_ID } from "../../../../../../lib/enrollments";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Coach reviews of chapter submissions. Same generous limit as chapter submit
// since coaches review and approve chapters less frequently than lessons.
const REVIEW_LIMIT = { windowMs: 60_000, max: 20 };

const DECISIONS = new Set(["approved", "changes_requested"]);

/** Coach action — owner or manager only (see lib/enrollments.ts's header for
 *  why "manager" is this slice's stand-in for a coach role). Approves or
 *  requests changes on the latest submission for a chapter; only an approval
 *  unlocks the next chapter (see chapterGates in the engine). */
export const POST = withRouteLogging("api/programme/chapters/[stageId]/review:POST", async (req: Request, ctx: { params: Promise<{ stageId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner" && role !== "manager") return json({ error: "Only the workspace owner or a manager can review chapter submissions." }, 403);

  const rl = await checkRateLimit(`chapter:review:${wsId}`, REVIEW_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { reviewStatus?: unknown; coachFeedback?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.reviewStatus !== "string" || !DECISIONS.has(body.reviewStatus)) return json({ error: "reviewStatus must be 'approved' or 'changes_requested'" }, 400);
  const coachFeedback = typeof body.coachFeedback === "string" ? body.coachFeedback : undefined;
  const decision = body.reviewStatus as "approved" | "changes_requested";

  const { stageId } = await ctx.params;

  // For Chapter 4, use the atomic function that syncs both tables under one lock.
  // For chapters 1-3, the generic reviewChapterSubmission is sufficient.
  const reviewFn = stageId === CHAPTER_4_STAGE_ID ? reviewChapter4SubmissionAtomically : reviewChapterSubmission;
  const ok = await reviewFn(wsId, stageId, { reviewStatus: decision, coachFeedback, reviewedBy: user.email });
  if (!ok) return json({ error: "No submission found for this chapter." }, 404);

  // Fire-and-forget: tell the learner the verdict. Covers every chapter
  // generically — never let a mail failure fail or delay the already-
  // committed decision.
  void notifyLearnerOfChapterReview({ workspaceId: wsId, stageId, decision, reviewerEmail: user.email, feedback: coachFeedback })
    .catch(() => { /* best-effort */ });
  return json({ ok: true });
});
