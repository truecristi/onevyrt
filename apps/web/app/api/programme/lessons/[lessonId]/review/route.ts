import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { reviewSubmission } from "../../../../../../lib/enrollments";
import { recordActivity } from "../../../../../../lib/activity";
import { notifyLearnerOfReview } from "../../../../../../lib/programme-notifications";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Coach reviews of lesson submissions. Slightly more generous than chapter
// reviews, since coaches review many individual lessons and time-shift.
const REVIEW_LIMIT = { windowMs: 60_000, max: 50 };

const DECISIONS = new Set(["approved", "changes_requested"]);

/** Coach action — owner or manager only (see lib/enrollments.ts's header
 *  for why "manager" is this slice's stand-in for a coach role). */
export const POST = withRouteLogging("api/programme/lessons/[lessonId]/review:POST", async (req: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner" && role !== "manager") return json({ error: "Only the workspace owner or a manager can review submissions." }, 403);

  const rl = await checkRateLimit(`lesson:review:${wsId}`, REVIEW_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { decision?: unknown; feedback?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.decision !== "string" || !DECISIONS.has(body.decision)) return json({ error: "decision must be 'approved' or 'changes_requested'" }, 400);
  const feedback = typeof body.feedback === "string" ? body.feedback : undefined;

  const { lessonId } = await ctx.params;
  const ok = await reviewSubmission(wsId, lessonId, body.decision as "approved" | "changes_requested", user.email, feedback);
  if (!ok) return json({ error: "No pending submission found for this lesson." }, 404);
  await recordActivity(wsId, { actorEmail: user.email, action: `programme.review.${body.decision}`, detail: lessonId });
  // Fire-and-forget: tell the learner the verdict (and feedback, if any).
  // Never let a mail failure fail or delay the (already-committed) review.
  void notifyLearnerOfReview({ workspaceId: wsId, lessonId, decision: body.decision as "approved" | "changes_requested", reviewerEmail: user.email, feedback })
    .catch(() => { /* best-effort */ });
  return json({ ok: true });
});
