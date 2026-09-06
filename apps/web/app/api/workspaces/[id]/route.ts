import { getWorkspace, roleOf, renameWorkspace } from "../../../../lib/workspaces";
import { currentUser } from "../../../../lib/auth";
import { recordActivity } from "../../../../lib/activity";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/workspaces/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { id } = await ctx.params;
  const role = await roleOf(id, user.id);
  if (!role) return json({ error: "not a member" }, 403);
  const ws = await getWorkspace(id);
  return ws ? json({ ...ws, myRole: role }) : json({ error: "not found" }, 404);
});

export const PATCH = withRouteLogging("api/workspaces/[id]:PATCH", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { id } = await ctx.params;
  let body: { name?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.name !== "string") return json({ error: "name is required" }, 400);
  try {
    const before = await getWorkspace(id);
    const ws = await renameWorkspace(id, user.id, body.name);
    if (before && before.name !== ws.name) await recordActivity(id, { actorEmail: user.email, action: "workspace.rename", detail: `"${before.name}" → "${ws.name}"` });
    return json(ws);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not rename workspace" }, 400); }
});
