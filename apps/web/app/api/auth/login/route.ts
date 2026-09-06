import { authenticate, createSession, sessionCookie, loginLockRemainingMs, recordLoginFailure, clearLoginFailures, is2faEnabled, createPending2faLogin } from "../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
import { track } from "../../../../lib/analytics";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Complementary to the per-email lockout in lib/auth.ts: that one alone doesn't stop
// one IP from cycling through many *different* emails (enumeration/credential stuffing).
const LOGIN_IP_LIMIT = { windowMs: 60_000, max: 20 };

export const POST = withRouteLogging("api/auth/login:POST", async (req: Request): Promise<Response> => {
  const ipLimit = await checkRateLimit(`login:ip:${clientIp(req)}`, LOGIN_IP_LIMIT);
  if (!ipLimit.allowed) return json({ error: "Too many attempts from this location. Try again shortly." }, 429, retryAfterHeader(ipLimit.retryAfterMs!));

  let body: { email?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.email !== "string" || typeof body.password !== "string") return json({ error: "email and password are required" }, 400);

  // Lockout is keyed by (email, ip) so an attacker can't lock a victim out of
  // their own account by burning attempts on the victim's email from elsewhere.
  const ip = clientIp(req);
  const remaining = await loginLockRemainingMs(body.email, ip);
  if (remaining > 0) {
    const mins = Math.ceil(remaining / 60000);
    return json({ error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` }, 429);
  }

  const user = await authenticate(body.email, body.password);
  if (!user) {
    await recordLoginFailure(body.email, ip);
    return json({ error: "invalid email or password" }, 401);
  }
  await clearLoginFailures(body.email);

  // Password checked out, but the account has 2FA — don't issue a session
  // yet. The pending token proves this much already passed; the real
  // session only comes from /api/auth/2fa/login-verify once the code does too.
  if (await is2faEnabled(user.id)) {
    const pendingToken = await createPending2faLogin(user.id);
    return json({ needs2fa: true, pendingToken });
  }

  const token = await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined });
  void track("user_login", { userId: user.id });
  return json({ id: user.id, email: user.email }, 200, { "set-cookie": sessionCookie(token) });
});
