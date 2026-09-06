import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { addChapterSubmission } from "../../../../../../lib/chapter-submissions";
import { recordActivity } from "../../../../../../lib/activity";
import { notifyCoachOfChapterSubmission } from "../../../../../../lib/programme-notifications";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Same shape/reasoning as api/programme/chapter/4/submit's SUBMIT_LIMIT: the
// workspace is the meaningful actor identity (authenticated + role-gated
// already), generous for a learner revising and resubmitting in one sitting,
// bounded enough that a retried/looping request can't flood a coach's inbox.
const SUBMIT_LIMIT = { windowMs: 60_000, max: 20 };

/** A learner submits a chapter's OUTPUT (e.g. the Business Psychology
 *  Blueprint) as evidence for coach review — the chapter-level analogue of a
 *  lesson submission. Same role bar as a lesson submit: any workspace member
 *  except a viewer. The coach's decision (see the review route) is what
 *  actually unlocks the next chapter — see chapterGates in the engine. */
export const POST = withRouteLogging("api/programme/chapters/[stageId]/submit:POST", async (req: Request, ctx: { params: Promise<{ stageId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer") return json({ error: "viewers cannot submit chapters" }, 403);

  const rl = await checkRateLimit(`chapter:submit:${wsId}`, SUBMIT_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { evidence?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.evidence !== "string" || !body.evidence.trim()) return json({ error: "evidence is required" }, 400);

  const { stageId } = await ctx.params;
  const result = await addChapterSubmission(wsId, { stageId, evidence: body.evidence });
  if ("error" in result) return json({ error: result.error }, 400);
  // Record activity like the lesson-submit route does — submitting a chapter is
  // real learner presence, so the engagement classifier (lib/coach/engagement)
  // must not flag someone who just submitted work as idle / "gone quiet".
  await recordActivity(wsId, { actorEmail: user.email, action: "programme.chapter_submit", detail: stageId });
  // Fire-and-forget: tell the workspace's coach there's a chapter output to
  // review. Covers every chapter (start/chapter-1-4/finish) generically —
  // never let a mail failure fail or delay the already-committed submission.
  void notifyCoachOfChapterSubmission({ workspaceId: wsId, stageId, learnerEmail: user.email }).catch(() => { /* best-effort */ });
  return json({ submission: result });
});
