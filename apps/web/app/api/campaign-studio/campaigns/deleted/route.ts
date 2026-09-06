/**
 * The campaigns bin: campaigns this workspace soft-deleted within the last 30
 * days, still recoverable. Gated behind campaign_studio; scoped to the caller's
 * own workspace.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { hasEntitlement } from "../../../../../lib/entitlements";
import { listDeletedRows, restoreRow } from "../../../../../lib/soft-delete";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function scope(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can manage campaigns" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/campaign-studio/campaigns/deleted:GET", async (req: Request): Promise<Response> => {
  const s = await scope(req, false);
  if (s instanceof Response) return s;
  return json({ deleted: await listDeletedRows("campaigns", s.wsId) });
});

/** Restore a binned campaign (owner/manager). */
export const POST = withRouteLogging("api/campaign-studio/campaigns/deleted:POST", async (req: Request): Promise<Response> => {
  const s = await scope(req, true);
  if (s instanceof Response) return s;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "a campaign id is required" }, 400);
  return json({ ok: await restoreRow("campaigns", s.wsId, id) });
});
