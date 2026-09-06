import { requireAdmin } from "../../../../../../lib/admin";
import { getWorkspace, adminSetFreeAccessMode } from "../../../../../../lib/workspaces";
import { recordAudit } from "../../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Enable or disable free-access mode for a workspace. When enabled, all lessons
 *  and chapters are unlocked, gating is bypassed, and submissions are auto-approved. */
export const POST = withRouteLogging("api/admin/workspaces/[id]/free-access:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  let body: { enabled?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.enabled !== "boolean") return json({ error: "enabled (boolean) is required" }, 400);

  const ws = await getWorkspace(id);
  if (!ws) return json({ error: "workspace not found" }, 404);

  try {
    const updated = await adminSetFreeAccessMode(id, body.enabled);
    await recordAudit({
      actorEmail: admin.email,
      action: body.enabled ? "workspace.enable_free_access" : "workspace.disable_free_access",
      targetType: "workspace",
      targetLabel: ws.name,
    });
    return json({ workspace: updated, ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not update free-access mode." }, 400);
  }
});
