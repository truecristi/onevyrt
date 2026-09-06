import { requireAdmin } from "../../../../../../lib/admin";
import { getWorkspace, adminReassignOwner } from "../../../../../../lib/workspaces";
import { getUserById } from "../../../../../../lib/auth";
import { recordAudit } from "../../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/admin/workspaces/[id]/owner:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  let body: { newOwnerId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.newOwnerId !== "string" || !body.newOwnerId) return json({ error: "newOwnerId is required" }, 400);

  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);
  const newOwner = await getUserById(body.newOwnerId);
  if (!newOwner) return json({ error: "target user not found" }, 404);

  try {
    const updated = await adminReassignOwner(id, body.newOwnerId);
    await recordAudit({ actorEmail: admin.email, action: "workspace.reassign_owner", targetType: "workspace", targetLabel: ws.name, detail: `new owner: ${newOwner.email}` });
    return json(updated);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not reassign ownership." }, 400);
  }
});
