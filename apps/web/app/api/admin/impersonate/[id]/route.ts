import { requireAdmin, isAdminEmail } from "../../../../../lib/admin";
import { getUserById, signSession, currentSessionId, createSession, sessionCookie, impersonatorCookie } from "../../../../../lib/auth";
import { recordAudit } from "../../../../../lib/audit-log";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Swaps gb_session to the target user's token, but keeps the admin's own
// token safe in a second cookie (gb_impersonator) so /api/auth/stop-impersonating
// can restore it exactly. Never lets an admin impersonate another admin —
// that's a privilege-escalation path (acting-as-admin-B while actually being
// admin-A, with admin-B's audit trail now showing actions they didn't take)
// this instance has no reason to allow.
export const POST = withRouteLogging("api/admin/impersonate/[id]:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { id } = await ctx.params;

  if (id === admin.id) return json({ error: "You're already signed in as yourself." }, 400);
  const target = await getUserById(id);
  if (!target) return json({ error: "user not found" }, 404);
  if (target.disabled) return json({ error: "That account is deactivated." }, 400);
  if (isAdminEmail(target.email)) return json({ error: "You can't impersonate another admin." }, 400);

  // Object.fromEntries(headers) would collapse both Set-Cookie lines into
  // one (Headers dedupes plain-object keys) — pass the Headers instance
  // itself so both cookies actually reach the response.
  // The admin's own session just moves to a different cookie — same session
  // id, not a new login. The target side is a genuinely new session on
  // their account, so it gets its own record (visible in their "active
  // sessions" list like any other sign-in).
  const adminSid = currentSessionId(req.headers.get("cookie")) ?? undefined;
  const targetToken = await createSession(target.id, { userAgent: req.headers.get("user-agent") ?? undefined });

  // Recorded only after the session actually exists — logging it first
  // would leave a false "impersonation started" audit entry if createSession
  // itself failed (disk error, etc.) with nothing having actually happened.
  await recordAudit({ actorEmail: admin.email, action: "user.impersonate_start", targetType: "user", targetLabel: target.email });

  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", impersonatorCookie(signSession(admin.id, undefined, adminSid)));
  headers.append("set-cookie", sessionCookie(targetToken));
  return new Response(JSON.stringify({ ok: true, email: target.email }), { status: 200, headers });
});
