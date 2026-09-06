import { currentUser, start2faSetup } from "../../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";
import QRCode from "qrcode";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Same limit as change-password/change-email/delete-account — this route
// re-verifies currentPassword too, and without a limiter a valid session
// cookie (with no known password) is an unthrottled password-guessing oracle.
const CHANGE_LIMIT = { windowMs: 60 * 60 * 1000, max: 20 };

/** Starts (or restarts) 2FA setup: generates a pending secret and returns it
 *  as both a scannable QR code and a manual-entry string. Nothing is
 *  enforced until confirm() verifies a real code from the app. */
export const POST = withRouteLogging("api/auth/2fa/setup:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const limit = await checkRateLimit(`2fa-setup:ip:${clientIp(req)}`, CHANGE_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));
  let body: { currentPassword?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.currentPassword !== "string" || !body.currentPassword) return json({ error: "currentPassword is required" }, 400);
  try {
    const { secret, uri } = await start2faSetup(user.id, body.currentPassword);
    const qrDataUrl = await QRCode.toDataURL(uri);
    return json({ secret, uri, qrDataUrl });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not start 2FA setup" }, 400); }
});
