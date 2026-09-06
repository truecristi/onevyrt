import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { getChapter4Submission } from "../../../../../../lib/chapter4-submissions";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** The current Chapter 4 (Growth & Improvement Plan) submission for this
 *  workspace: `{ submission: null }` if Chapter 4 has never been saved, else
 *  the stored submission — whatever its status (in_progress / submitted /
 *  changes_requested / approved). Any workspace member can view, same bar as
 *  the chapters/enrollment GET routes; the artifact and its numbers are
 *  workspace-shared, not learner-private. Returns the raw stored shape (see
 *  lib/chapter4-submissions.ts's Chapter4Submission) — callers transform it
 *  for display via lib/growth-plan-utils.ts's formatPlan(). */
export const GET = withRouteLogging("api/programme/chapter/4/get:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const submission = await getChapter4Submission(wsId);
  return json({ submission });
});
