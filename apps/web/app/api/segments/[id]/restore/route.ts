/**
 * Restore a soft-deleted segment from the bin. Owner/manager only, scoped to the
 * caller's own workspace — same as deleting it.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { restoreRow } from "../../../../../lib/soft-delete";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/segments/[id]/restore:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  const { id } = await ctx.params;
  return json({ ok: await restoreRow("segments", wsId, id) });
});
