import { registerUser, createSession, sessionCookie } from "../../../../lib/auth";
import { ensurePersonalWorkspace } from "../../../../lib/workspaces";
import { recordReferral } from "../../../../lib/referrals";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging, logError } from "../../../../lib/logger";
import { track } from "../../../../lib/analytics";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Registration has no per-email lockout (unlike login), so an IP limit is the only
// guard against mass account creation. Generous enough for real shared-IP traffic
// (offices, mobile carrier NAT) but well below what a scripted signup flood needs.
const REGISTER_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

export const POST = withRouteLogging("api/auth/register:POST", async (req: Request): Promise<Response> => {
  const limit = await checkRateLimit(`register:ip:${clientIp(req)}`, REGISTER_LIMIT);
  if (!limit.allowed) return json({ error: "Too many registration attempts. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { email?: unknown; password?: unknown; ref?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.email !== "string" || typeof body.password !== "string") return json({ error: "email and password are required" }, 400);
  try {
    const user = await registerUser(body.email, body.password);
    void track("user_registered", { userId: user.id });
    const token = await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined });
    if (typeof body.ref === "string" && body.ref.trim()) {
      // Best-effort: an unknown/expired code is silently ignored (see
      // recordReferral) rather than blocking account creation over it. But an
      // UNEXPECTED failure (DB error, not a bad code) silently loses referral
      // credit and turns into an unanswerable "my referral didn't apply"
      // ticket — log it so it's diagnosable, while still not failing signup.
      const ws = await ensurePersonalWorkspace(user.id);
      await recordReferral(body.ref, ws.id, user.id).catch((err) => logError("api/auth/register:referral", err, { userId: user.id, ref: body.ref }));
    }
    return json({ id: user.id, email: user.email }, 200, { "set-cookie": sessionCookie(token) });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "registration failed" }, 400); }
});
