import { verifyPending2faLogin, getUserById, createSession, sessionCookie } from "../../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";
import { track } from "../../../../../lib/analytics";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// A 6-digit code has a 1-in-a-million search space per guess — tight even
// without a limit, but a per-IP throttle here costs nothing and removes the
// theoretical brute-force window entirely.
const VERIFY_LIMIT = { windowMs: 60_000, max: 10 };

/** Second step of login when the account has 2FA enabled: exchanges a
 *  pending-2FA token (proof the password already checked out) plus a real
 *  6-digit code (or backup code) for an actual session. The pending token
 *  tolerates a few wrong guesses (see verifyPending2faLogin) rather than
 *  burning on the first typo — it's still single-use on success and capped
 *  at a handful of attempts before it's invalidated either way. */
export const POST = withRouteLogging("api/auth/2fa/login-verify:POST", async (req: Request): Promise<Response> => {
  const limit = await checkRateLimit(`2fa-verify:ip:${clientIp(req)}`, VERIFY_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again shortly." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { pendingToken?: unknown; code?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.pendingToken !== "string" || !body.pendingToken) return json({ error: "pendingToken is required" }, 400);
  if (typeof body.code !== "string" || !body.code) return json({ error: "code is required" }, 400);

  const result = await verifyPending2faLogin(body.pendingToken, body.code);
  if ("error" in result) return json({ error: result.error }, result.error === "Incorrect code." ? 401 : 400);

  const user = await getUserById(result.userId);
  if (!user || user.disabled) return json({ error: "Account is unavailable." }, 403);

  const token = await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined });
  void track("user_login", { userId: user.id });
  return json({ id: user.id, email: user.email }, 200, { "set-cookie": sessionCookie(token) });
});
