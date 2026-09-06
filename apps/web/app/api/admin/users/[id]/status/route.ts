import { requireAdmin } from "../../../../../../lib/admin";
import { setUserDisabled, getUserById } from "../../../../../../lib/auth";
import { recordAudit } from "../../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Soft delete only: this disables login and kills existing sessions (see
// currentUser in lib/auth.ts) but never touches what the account owns —
// workspaces and projects are untouched, so reactivating restores everything.
// A permanent purge is deliberately a separate, not-yet-built action; this
// route only ever flips a flag, which is why it's safe to expose as a single click.
export const POST = withRouteLogging("api/admin/users/[id]/status:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  let body: { disabled?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.disabled !== "boolean") return json({ error: "disabled (boolean) is required" }, 400);

  const target = await getUserById(id);
  if (!target) return json({ error: "user not found" }, 404);
  if (target.id === admin.id && body.disabled) return json({ error: "You can't deactivate your own account." }, 400);

  try {
    const user = await setUserDisabled(id, body.disabled);
    await recordAudit({ actorEmail: admin.email, action: body.disabled ? "user.deactivate" : "user.reactivate", targetType: "user", targetLabel: target.email });
    return json({ user });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not update the account." }, 400);
  }
});
