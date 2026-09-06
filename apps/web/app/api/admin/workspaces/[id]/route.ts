import { requireAdmin } from "../../../../../lib/admin";
import { getWorkspace, adminDeleteWorkspace } from "../../../../../lib/workspaces";
import { recordAudit } from "../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Deletes the workspace AND every project it owns (see lib/store.deleteScope
// via adminDeleteWorkspace). Irreversible, no confirmation server-side —
// the admin UI must have already confirmed with the operator before calling this.
export const DELETE = withRouteLogging("api/admin/workspaces/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);

  try {
    await adminDeleteWorkspace(id);
    await recordAudit({ actorEmail: admin.email, action: "workspace.delete", targetType: "workspace", targetLabel: ws.name });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not delete the workspace." }, 400);
  }
});
