/**
 * Restore a soft-deleted funnel from the bin back into the library. Same
 * workspace/role scoping as the delete route — only a member who can edit the
 * workspace may restore, and only within their own workspace.
 */
import { restoreProject } from "../../../../../lib/store";
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { recordActivity } from "../../../../../lib/activity";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/projects/[id]/restore:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role === "viewer") return json({ error: "viewers cannot edit this workspace" }, 403);
  const { id } = await ctx.params;
  const ok = await restoreProject(wsId, id);
  if (ok) await recordActivity(wsId, { actorEmail: user.email, action: "project.restore", projectName: id });
  return json({ ok });
});
