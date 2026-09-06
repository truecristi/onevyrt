import { currentUser, disable2fa } from "../../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Same limit as change-password/change-email/delete-account — this route
// re-verifies currentPassword too, and without a limiter a valid session
// cookie (with no known password) is an unthrottled password-guessing oracle.
const CHANGE_LIMIT = { windowMs: 60 * 60 * 1000, max: 20 };

export const POST = withRouteLogging("api/auth/2fa/disable:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const limit = await checkRateLimit(`2fa-disable:ip:${clientIp(req)}`, CHANGE_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));
  let body: { currentPassword?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.currentPassword !== "string" || !body.currentPassword) return json({ error: "currentPassword is required" }, 400);
  try {
    await disable2fa(user.id, body.currentPassword);
    return json({ ok: true });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not disable 2FA" }, 400); }
});
