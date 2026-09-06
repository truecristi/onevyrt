import { currentImpersonator, readImpersonatorToken, verifySession, signSession, sessionIdFromToken, sessionCookie, clearImpersonatorCookie } from "../../../../lib/auth";
import { isAdminEmail } from "../../../../lib/admin";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Headers | Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: h instanceof Headers ? h : { "content-type": "application/json", ...h } });

// Restores the admin's own session from gb_impersonator and clears it — the
// return half of /api/admin/impersonate. Deliberately not gated by
// requireAdmin (the impersonated user's session is what's active right now,
// and they're the point of this call): trust is anchored to gb_impersonator
// itself being a validly signed token for someone who was an admin when
// impersonation started, re-verified as still an admin before restoring.
export const POST = withRouteLogging("api/auth/stop-impersonating:POST", async (req: Request): Promise<Response> => {
  const cookie = req.headers.get("cookie");
  const token = readImpersonatorToken(cookie);
  if (!token || !verifySession(token)) return json({ error: "not currently impersonating anyone" }, 400);

  const admin = await currentImpersonator(cookie);
  if (!admin || admin.disabled || !isAdminEmail(admin.email)) return json({ error: "your admin session is no longer valid — log back in directly" }, 403);

  await recordAudit({ actorEmail: admin.email, action: "user.impersonate_stop" });

  // Restores the admin's own original session id (from the parked
  // gb_impersonator token) rather than minting a new one.
  const adminSid = sessionIdFromToken(token) ?? undefined;
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", sessionCookie(signSession(admin.id, undefined, adminSid)));
  headers.append("set-cookie", clearImpersonatorCookie());
  return json({ ok: true, email: admin.email }, 200, headers);
});
