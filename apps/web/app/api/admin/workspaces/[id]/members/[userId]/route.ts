import { requireAdmin } from "../../../../../../../lib/admin";
import { getWorkspace, adminRemoveMember } from "../../../../../../../lib/workspaces";
import { getUserById } from "../../../../../../../lib/auth";
import { recordAudit } from "../../../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const DELETE = withRouteLogging("api/admin/workspaces/[id]/members/[userId]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string; userId: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id, userId } = await ctx.params;

  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);
  const target = await getUserById(userId);

  try {
    const updated = await adminRemoveMember(id, userId);
    await recordAudit({ actorEmail: admin.email, action: "workspace.remove_member", targetType: "workspace", targetLabel: ws.name, detail: target ? `removed ${target.email}` : `removed ${userId}` });
    return json(updated);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not remove that member." }, 400);
  }
});
