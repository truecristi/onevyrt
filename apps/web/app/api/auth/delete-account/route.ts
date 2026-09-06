import { currentUser, authenticate, purgeUser, clearSessionCookie } from "../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const DELETE_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

/** Self-service account deletion (GDPR right to erasure) — same password
 *  confirmation bar as change-password, since this is irreversible.
 *  purgeUser already refuses to delete an account that owns a shared
 *  workspace with other members still in it, so ownership gets reassigned
 *  first rather than silently orphaning a team. purgeUser itself now owns the
 *  full right-to-erasure cascade (cohorts, cohort rosters, enrollments,
 *  entitlements, leads/bookings/lead-events — see lib/auth.ts and
 *  lib/workspaces.ts adminDeleteWorkspace), so this route no longer needs to
 *  run any of it directly. */
export const POST = withRouteLogging("api/auth/delete-account:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const limit = await checkRateLimit(`delete-account:ip:${clientIp(req)}`, DELETE_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.password !== "string" || !body.password) return json({ error: "password is required" }, 400);

  const verified = await authenticate(user.email, body.password);
  if (!verified) return json({ error: "Incorrect password." }, 401);

  try {
    const result = await purgeUser(user.id);
    await recordAudit({ actorEmail: user.email, action: "user.self_delete", targetType: "user", targetLabel: result.email });
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not delete account" }, 400); }
});
