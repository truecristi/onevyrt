import { createResetToken } from "../../../../lib/auth";
import { readSettings } from "../../../../lib/settings";
import { sendMail } from "../../../../lib/mailer";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Generous per-IP limit — this endpoint is deliberately silent about whether an
// email exists, so a determined attacker gains little from hammering it, but a
// limit still caps how many emails a single source can trigger us to send.
const FORGOT_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

export const POST = withRouteLogging("api/auth/forgot-password:POST", async (req: Request): Promise<Response> => {
  const limit = await checkRateLimit(`forgot:ip:${clientIp(req)}`, FORGOT_LIMIT);
  if (!limit.allowed) return json({ error: "Too many requests. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { email?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.email !== "string" || !body.email) return json({ error: "email is required" }, 400);

  const token = await createResetToken(body.email);
  if (token) {
    // The Origin request header is attacker-controlled on a raw POST (it's
    // only browser-enforced on same-page fetches, not on a scripted
    // request) — trusting it here would let anyone email a real user a
    // password-reset link pointing at an attacker's domain, carrying their
    // real reset token. Use the admin-configured origin instead; only fall
    // back to the request's own URL (not the spoofable Origin header) if
    // that was never set.
    const settings = await readSettings();
    const origin = settings.publicOrigin || new URL(req.url).origin;
    const link = `${origin}/?resetToken=${encodeURIComponent(token)}`;
    await sendMail({
      to: body.email.trim().toLowerCase(),
      subject: "Reset your GearBox password",
      text: `Someone requested a password reset for this email. Open this link within 30 minutes to set a new password:\n\n${link}\n\nIf you didn't request this, you can ignore this message.`,
    });
  }
  // Same response whether the email exists or not — no account enumeration.
  return json({ ok: true, message: "If that email is registered, a reset link is on its way." });
});
