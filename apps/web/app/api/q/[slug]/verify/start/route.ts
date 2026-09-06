import { resolveFunnelConfig } from "../../../../../../lib/studio/funnel-store";
import { startVerification, type OtpChannel } from "../../../../../../lib/acquisition/otp";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Rate-limited so a funnel can't be used to spray codes: a handful of sends
// per IP per minute is plenty for a real visitor mistyping their contact.
const LIMIT = { windowMs: 60 * 1000, max: 5 };
// Per-DESTINATION cap, so rotating IPs can't SMS/email-bomb one number/address
// (real Twilio cost + harassment). A legitimate visitor never needs more than a
// few codes to one contact in 15 minutes.
const DEST_LIMIT = { windowMs: 15 * 60 * 1000, max: 3 };

// Send a one-time code to the lead's contact so they can prove they own it.
export const POST = withRouteLogging("api/q/verify/start:POST", async (req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> => {
  const limit = await checkRateLimit(`otp:start:${clientIp(req)}`, LIMIT);
  if (!limit.allowed) return json({ error: "Too many requests — please wait a moment." }, 429, retryAfterHeader(limit.retryAfterMs!));

  const { slug } = await ctx.params;
  const config = await resolveFunnelConfig(slug);
  if (!config) return json({ error: "unknown funnel" }, 404);

  let body: { channel?: unknown; destination?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const channel: OtpChannel = body.channel === "sms" ? "sms" : "email";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const looksValid = channel === "email" ? /.+@.+\..+/.test(destination) : /^[+]?[\d\s()-]{6,}$/.test(destination);
  if (!looksValid) return json({ error: `a valid ${channel === "email" ? "email" : "phone number"} is required` }, 400);

  // Cap sends to this specific contact regardless of source IP. Normalise the
  // key (lowercased email / digits-only phone) so trivial formatting changes
  // can't sidestep the limit.
  const destKey = channel === "email" ? destination.toLowerCase() : destination.replace(/\D/g, "");
  const destLimit = await checkRateLimit(`otp:dest:${channel}:${destKey}`, DEST_LIMIT);
  if (!destLimit.allowed) return json({ error: "Too many codes sent to this contact — please wait a few minutes before requesting another." }, 429, retryAfterHeader(destLimit.retryAfterMs!));

  const res = await startVerification({ funnelSlug: slug, channel, destination });
  return json({ ok: true, id: res.id, sent: res.sent, channel: res.channel, ...(res.devCode ? { devCode: res.devCode } : {}) });
});
