import { requireAdmin } from "../../../../../../lib/admin";
import { getWorkspace } from "../../../../../../lib/workspaces";
import { grantEntitlement, revokeEntitlement, listEntitlements, type Entitlement } from "../../../../../../lib/entitlements";
import { recordAudit } from "../../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const ENTITLEMENTS: Entitlement[] = ["campaign_studio"];

// Admin-only override for add-on entitlements (see lib/entitlements.ts) —
// the manual-grant escape hatch for a workspace that hasn't (or won't) go
// through checkout, same posture as adminSetPlan next to the real billing
// webhook.
export const GET = withRouteLogging("api/admin/workspaces/[id]/entitlements:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;
  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);
  return json(await listEntitlements(id));
});

export const POST = withRouteLogging("api/admin/workspaces/[id]/entitlements:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  let body: { entitlement?: unknown; action?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.entitlement !== "string" || !ENTITLEMENTS.includes(body.entitlement as Entitlement)) return json({ error: `entitlement must be one of ${ENTITLEMENTS.join(", ")}` }, 400);
  if (body.action !== "grant" && body.action !== "revoke") return json({ error: "action must be 'grant' or 'revoke'" }, 400);

  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);

  const entitlement = body.entitlement as Entitlement;
  if (body.action === "grant") await grantEntitlement(id, entitlement);
  else await revokeEntitlement(id, entitlement);
  await recordAudit({ actorEmail: admin.email, action: "workspace.entitlement", targetType: "workspace", targetLabel: ws.name, detail: `${entitlement} -> ${body.action}` });
  return json(await listEntitlements(id));
});
