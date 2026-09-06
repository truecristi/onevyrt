import { checkVerification } from "../../../../../../lib/acquisition/otp";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// A tighter limit than start: guessing codes is the thing to throttle, on top
// of the per-verification attempt cap the engine enforces.
const LIMIT = { windowMs: 60 * 1000, max: 10 };

// Check a submitted code. The engine caps attempts + expiry; this adds an
// IP-level throttle so codes can't be brute-forced across many verifications.
export const POST = withRouteLogging("api/q/verify/check:POST", async (req: Request): Promise<Response> => {
  const limit = await checkRateLimit(`otp:check:${clientIp(req)}`, LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts — please wait a moment." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { id?: unknown; code?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const id = typeof body.id === "string" ? body.id : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!id || !/^\d{4,8}$/.test(code)) return json({ error: "a verification id and numeric code are required" }, 400);

  const res = await checkVerification(id, code);
  if (!res.ok) {
    const msg = res.reason === "expired" ? "That code has expired — request a new one."
      : res.reason === "too_many_attempts" ? "Too many tries — request a new code."
      : res.reason === "not_found" ? "That verification wasn't found — start again."
      : "That code isn't right — please try again.";
    return json({ ok: false, reason: res.reason, error: msg }, 400);
  }
  return json({ ok: true });
});
