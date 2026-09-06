/**
 * Campaign Studio — entitlements read endpoint. Unlike the brand/route.ts
 * endpoints, this one deliberately does NOT gate on hasEntitlement itself —
 * its whole purpose is to tell the frontend whether the workspace has
 * Campaign Studio at all, so a "not enabled" screen can be shown instead of
 * every gated endpoint just 403ing with no way to explain why.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { listEntitlements } from "../../../../lib/entitlements";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/campaign-studio/entitlements:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return json(await listEntitlements(wsId));
});
