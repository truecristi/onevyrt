/**
 * The contacts a saved segment resolves to — the list a workflow acts on
 * (export CSV, email list, SMS list, call list). GET returns up to `limit`
 * (default 500, max 5000) newest-first; any workspace member may read.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getSegment, listContacts } from "../../../../../lib/segments/store";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/segments/[id]/contacts:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const url = new URL(req.url);
  const wsId = url.searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const { id } = await ctx.params;
  const seg = await getSegment(wsId, id);
  if (!seg) return json({ error: "segment not found" }, 404);
  const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get("limit")) || 500));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const contacts = await listContacts(wsId, seg.rules, limit, offset);
  return json({ contacts });
});
