import { currentUser, currentSessionId, revokeSession, clearSessionCookie, currentImpersonator, readImpersonatorToken, sessionIdFromToken, clearImpersonatorCookie } from "../../../../lib/auth";
import { withRouteLogging, logError } from "../../../../lib/logger";
export const runtime = "nodejs";
export const POST = withRouteLogging("api/auth/logout:POST", async (req: Request): Promise<Response> => {
  const cookie = req.headers.get("cookie");
  const user = await currentUser(cookie);
  const sessionId = currentSessionId(cookie);
  // Without this, the cookie is gone client-side but the server-side session
  // record stays valid until its 30-day expiry — a captured/leaked token
  // would keep working right through a "logout", and the account's own
  // "active sessions" list would still show it as live. We still clear the
  // cookie regardless, but a revoke that FAILS is security-relevant (the token
  // stays live), so log it instead of swallowing it silently.
  if (user && sessionId) {
    await revokeSession(user.id, sessionId).catch((err) => logError("api/auth/logout:revoke", err, { userId: user.id, sessionId }));
  }
  // An in-progress impersonation parks the ADMIN's own still-valid session in
  // gb_impersonator so "Stop impersonating" can restore it later. An ordinary
  // "Log out" while impersonating only ends the CURRENT (impersonated-user)
  // session above — without this, the admin's parked session stays live in
  // the DB, and anyone who later holds that gb_impersonator cookie (a shared
  // machine, a copied cookie store) can POST /api/auth/stop-impersonating
  // with no credentials at all and be handed a fresh admin session. Revoking
  // the underlying session row (not just clearing the cookie) closes this for
  // any copy of that token, not only this browser.
  const impersonatorToken = readImpersonatorToken(cookie);
  if (impersonatorToken) {
    const admin = await currentImpersonator(cookie);
    const adminSid = sessionIdFromToken(impersonatorToken);
    if (admin && adminSid) {
      await revokeSession(admin.id, adminSid).catch((err) => logError("api/auth/logout:revoke-impersonator", err, { userId: admin.id, sessionId: adminSid }));
    }
  }
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", clearSessionCookie());
  headers.append("set-cookie", clearImpersonatorCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
