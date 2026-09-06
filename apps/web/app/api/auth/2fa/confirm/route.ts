import { currentUser, confirm2fa } from "../../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Same reasoning as the login-time 2FA check — a 6-digit code is a narrow
// enough space that an unlimited-guess endpoint shouldn't exist anywhere.
const CONFIRM_LIMIT = { windowMs: 60_000, max: 10 };

/** Confirms 2FA setup with a real 6-digit code, enabling it and returning
 *  one-time backup codes — shown to the user exactly once, here. */
export const POST = withRouteLogging("api/auth/2fa/confirm:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const limit = await checkRateLimit(`2fa-confirm:ip:${clientIp(req)}`, CONFIRM_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again shortly." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.token !== "string" || !body.token) return json({ error: "token is required" }, 400);
  try {
    const backupCodes = await confirm2fa(user.id, body.token);
    return json({ backupCodes });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not confirm 2FA" }, 400); }
});
