/**
 * The bin: funnels this workspace soft-deleted within the last 30 days, still
 * recoverable. Any member may read it (same as listing live projects); scoped
 * to the caller's own workspace.
 */
import { listDeletedProjects } from "../../../../lib/store";
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/projects/deleted:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return json(await listDeletedProjects(wsId));
});
