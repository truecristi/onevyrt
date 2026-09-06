import { requestEmailChange, currentUser } from "../../../../lib/auth";
import { readSettings } from "../../../../lib/settings";
import { sendMail } from "../../../../lib/mailer";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const CHANGE_LIMIT = { windowMs: 60 * 60 * 1000, max: 20 };

export const POST = withRouteLogging("api/auth/change-email:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const limit = await checkRateLimit(`change-email:ip:${clientIp(req)}`, CHANGE_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { currentPassword?: unknown; newEmail?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.currentPassword !== "string" || !body.currentPassword) return json({ error: "currentPassword is required" }, 400);
  if (typeof body.newEmail !== "string") return json({ error: "newEmail is required" }, 400);

  try {
    // The email does NOT change here — we park a pending change and send a
    // verification link to the NEW address. Only clicking that link applies
    // it, so a hijacked session can't silently move the login email.
    const { token, newEmail } = await requestEmailChange(user.id, body.currentPassword, body.newEmail);
    // Use the admin-configured origin, never the spoofable Origin header
    // (same reasoning as forgot-password).
    const settings = await readSettings();
    const origin = settings.publicOrigin || new URL(req.url).origin;
    const link = `${origin}/api/auth/confirm-email-change?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: newEmail,
      subject: "Confirm your new OneVYRT email",
      text: `You asked to change your OneVYRT login email to this address. Open this link within 30 minutes to confirm — until you do, your login email stays unchanged:\n\n${link}\n\nIf you didn't request this, you can ignore this message.`,
    });
    return json({ pending: true, message: "Check your new inbox — click the link to confirm the change." });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "change failed" }, 400); }
});
