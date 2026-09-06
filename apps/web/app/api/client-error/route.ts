/**
 * Sink for the client-side error boundaries (app/error.tsx, app/global-error.tsx):
 * the browser can't reach logger.ts directly (it's Node-only, node:fs and all),
 * so a render crash is only visible server-side if the boundary posts it here
 * first. Unauthenticated and reachable from a broken page, so it gets the same
 * per-IP rate limit as /api/track rather than trusting the caller.
 */
import { logError } from "../../../lib/logger";
import { recordClientError } from "../../../lib/client-errors";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../lib/rate-limit";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const IP_LIMIT = { windowMs: 60_000, max: 60 };

export async function POST(req: Request): Promise<Response> {
  const limit = await checkRateLimit(`client-error:ip:${clientIp(req)}`, IP_LIMIT);
  if (!limit.allowed) return json({ error: "rate limit exceeded" }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { message?: unknown; stack?: unknown; digest?: unknown; url?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const message = typeof body.message === "string" ? body.message : "unknown client error";
  const digest = typeof body.digest === "string" ? body.digest : undefined;
  const url = typeof body.url === "string" ? body.url : undefined;
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 4000) : undefined;

  logError("client:render-error", new Error(message), { digest, url, stack });
  // Persist so it's visible in the admin UI, not just the log file.
  await recordClientError({ message, url, digest, stack });
  return json({ ok: true });
}
