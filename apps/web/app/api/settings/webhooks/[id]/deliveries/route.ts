import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { listDeliveries } from "../../../../../../lib/webhooks";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// The delivery log for one webhook. Same auth gate as the rest of the webhooks
// API — a member can read; only an owner/manager manages. Reading the log is a
// management view (it exposes receiving-URL behaviour), so it takes the manage
// gate too, matching DELETE on the sibling route.
export const GET = withRouteLogging("api/settings/webhooks/[id]/deliveries:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const { id } = await ctx.params;
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can view webhook deliveries" }, 403);
  return json(await listDeliveries(wsId, id));
});
