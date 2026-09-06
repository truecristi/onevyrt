import { currentUser, revokeSession } from "../../../../../lib/auth";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Revokes one of the signed-in user's own sessions. Scoped server-side to
 *  their own account — see revokeSession in lib/auth. */
export const DELETE = withRouteLogging("api/auth/sessions/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { id } = await ctx.params;
  try {
    await revokeSession(user.id, id);
    return json({ ok: true });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not revoke session" }, 400); }
});
