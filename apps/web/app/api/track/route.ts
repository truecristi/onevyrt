import { recordEvent, recordJourneyEvent, type EventType } from "../../../lib/tracking";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../lib/rate-limit";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS, ...h } });

// Public, unauthenticated ingest embeddable on any page — the most abusable route in
// the app (storage exhaustion via forged events). Keyed by IP first since the key is
// attacker-controlled; a per-key limit on top keeps one leaked key from drowning others.
const IP_LIMIT = { windowMs: 60_000, max: 120 };
const KEY_LIMIT = { windowMs: 60_000, max: 300 };

export function OPTIONS(): Response { return new Response(null, { status: 204, headers: CORS }); }

export const POST = withRouteLogging("api/track:POST", async (req: Request): Promise<Response> => {
  const ip = clientIp(req);
  const ipLimit = await checkRateLimit(`track:ip:${ip}`, IP_LIMIT);
  if (!ipLimit.allowed) return json({ error: "rate limit exceeded" }, 429, retryAfterHeader(ipLimit.retryAfterMs!));

  let body: { key?: unknown; node?: unknown; type?: unknown; value?: unknown; session?: unknown; url?: unknown; source?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.key !== "string" || typeof body.node !== "string") return json({ error: "key and node are required" }, 400);

  const keyLimit = await checkRateLimit(`track:key:${body.key}`, KEY_LIMIT);
  if (!keyLimit.allowed) return json({ error: "rate limit exceeded" }, 429, retryAfterHeader(keyLimit.retryAfterMs!));
  const type: EventType = body.type === "convert" ? "convert" : "visit";
  const value = typeof body.value === "number" && Number.isFinite(body.value) ? body.value : 0;
  const ok = await recordEvent(body.key, body.node, type, value);

  // Best-effort, additive: the embed snippet sends a stable per-visitor
  // sessionId automatically, so existing installs get real journey data
  // without changing their embed code. Never lets a journey-logging failure
  // affect the response — the simple counter above is the load-bearing part.
  if (ok && typeof body.session === "string" && body.session) {
    try {
      await recordJourneyEvent(body.key, {
        sessionId: body.session, nodeId: body.node, type: type === "convert" ? "conversion" : "pageview",
        ...(typeof body.url === "string" && body.url ? { url: body.url } : {}),
        ...(typeof body.source === "string" && body.source ? { sourceLabel: body.source } : {}),
      });
    } catch { /* journey logging is a bonus, not the contract */ }
  }

  return ok ? json({ ok: true }) : json({ error: "unknown tracking key" }, 404);
});
