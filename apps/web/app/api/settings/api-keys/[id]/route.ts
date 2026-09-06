import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { revokeApiKey } from "../../../../../lib/api-keys";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const DELETE = withRouteLogging("api/settings/api-keys/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const { id } = await ctx.params;
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can manage API keys" }, 403);
  await revokeApiKey(wsId, id);
  return json({ ok: true });
});
