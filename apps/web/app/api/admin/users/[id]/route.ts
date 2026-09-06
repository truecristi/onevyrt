import { requireAdmin } from "../../../../../lib/admin";
import { getUserById, purgeUser } from "../../../../../lib/auth";
import { recordAudit } from "../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Permanent, irreversible. Distinct from status:POST (soft delete) — this
// actually removes the account and anything it exclusively owned. Blocked
// entirely if the account owns a shared workspace (see lib/auth.purgeUser);
// the admin must reassign or clear that first rather than this route
// guessing what to do with other people's access.
export const DELETE = withRouteLogging("api/admin/users/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  const target = await getUserById(id);
  if (!target) return json({ error: "user not found" }, 404);
  if (target.id === admin.id) return json({ error: "You can't delete your own account." }, 400);

  try {
    const result = await purgeUser(id);
    await recordAudit({ actorEmail: admin.email, action: "user.purge", targetType: "user", targetLabel: result.email, detail: `deleted ${result.deletedWorkspaces} owned workspace(s)` });
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not delete the account." }, 400);
  }
});
