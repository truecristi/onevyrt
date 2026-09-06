/**
 * A single broadcast with its per-recipient send log — so the owner can see
 * exactly what went out and what failed. Any workspace member may read.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getBroadcast, cancelBroadcast } from "../../../../lib/outreach/broadcasts";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/broadcasts/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  const { id } = await ctx.params;
  const found = await getBroadcast(wsId, id);
  if (!found) return json({ error: "broadcast not found" }, 404);
  return json(found);
});

// Cancel a scheduled broadcast before it fires. Owner/manager only, matching
// the send gate — a scheduled send is an outbound action, so calling it off is
// one too. A no-op (already sent/sending, or not found) returns cancelled:false.
export const DELETE = withRouteLogging("api/broadcasts/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can cancel a broadcast" }, 403);
  const { id } = await ctx.params;
  return json({ ok: true, cancelled: await cancelBroadcast(wsId, id) });
});
