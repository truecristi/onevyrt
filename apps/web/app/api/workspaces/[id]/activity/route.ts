import { listActivity } from "../../../../../lib/activity";
import { currentUser } from "../../../../../lib/auth";
import { roleOf } from "../../../../../lib/workspaces";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Any workspace member (including viewers) can read the activity feed. */
export const GET = withRouteLogging("api/workspaces/[id]/activity:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { id } = await ctx.params;
  const role = await roleOf(id, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return json({ activity: await listActivity(id) });
});
