import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, getWorkspace } from "../../../../../../lib/workspaces";
import { submitAssignment } from "../../../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../../../lib/curriculum-store";
import { effectiveStageAccessLimit } from "../../../../../../lib/cohorts";
import { recordActivity } from "../../../../../../lib/activity";
import { notifyCoachOfSubmission } from "../../../../../../lib/programme-notifications";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Lesson submissions are more granular than chapter submissions, so slightly
// more generous. Same workspace-identity logic as chapters — a learner might
// submit multiple lessons in one sitting (different lessons in different windows).
const SUBMIT_LIMIT = { windowMs: 60_000, max: 40 };

export const POST = withRouteLogging("api/programme/lessons/[lessonId]/submit:POST", async (req: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer") return json({ error: "viewers cannot submit assignments" }, 403);

  const rl = await checkRateLimit(`lesson:submit:${wsId}`, SUBMIT_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { evidence?: unknown; checklistChecked?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.evidence !== "string") return json({ error: "evidence is required" }, 400);
  const checklistChecked = Array.isArray(body.checklistChecked) ? body.checklistChecked.filter((c): c is string => typeof c === "string") : [];

  const { lessonId } = await ctx.params;
  const [programme, stageAccessLimit, workspace] = await Promise.all([getDefaultProgramme(), effectiveStageAccessLimit(wsId), getWorkspace(wsId)]);
  const result = await submitAssignment(wsId, lessonId, user.id, body.evidence, checklistChecked, programme, stageAccessLimit, workspace ?? undefined);
  if ("error" in result) return json({ error: result.error }, 400);
  await recordActivity(wsId, { actorEmail: user.email, action: "programme.submit", detail: lessonId });
  // Fire-and-forget: tell the workspace's coach there's something to review.
  // Never let a mail failure fail or delay the (already-committed) submission.
  void notifyCoachOfSubmission({ workspaceId: wsId, lessonId, learnerEmail: user.email }).catch(() => { /* best-effort */ });
  return json({ submission: result });
});
