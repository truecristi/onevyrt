import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, getWorkspace } from "../../../../../../lib/workspaces";
import { startLesson } from "../../../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../../../lib/curriculum-store";
import { effectiveStageAccessLimit } from "../../../../../../lib/cohorts";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Lesson start is a lightweight state transition, but still needs protection
// from rapid re-requests or buggy clients.
const START_LIMIT = { windowMs: 60_000, max: 60 };

/** Marks a lesson in_progress — viewers can look but this app's usual
 *  "viewer can't change state" bar applies here too. */
export const POST = withRouteLogging("api/programme/lessons/[lessonId]/start:POST", async (req: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer") return json({ error: "viewers cannot start a lesson" }, 403);

  const rl = await checkRateLimit(`lesson:start:${wsId}`, START_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  const { lessonId } = await ctx.params;
  const [programme, stageAccessLimit, workspace] = await Promise.all([getDefaultProgramme(), effectiveStageAccessLimit(wsId), getWorkspace(wsId)]);
  await startLesson(wsId, lessonId, programme, stageAccessLimit, workspace ?? undefined);
  return json({ ok: true });
});
