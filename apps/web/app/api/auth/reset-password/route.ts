import { consumeResetToken } from "../../../../lib/auth";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const RESET_LIMIT = { windowMs: 60 * 60 * 1000, max: 20 };

export const POST = withRouteLogging("api/auth/reset-password:POST", async (req: Request): Promise<Response> => {
  const limit = await checkRateLimit(`reset:ip:${clientIp(req)}`, RESET_LIMIT);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { token?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.token !== "string" || !body.token) return json({ error: "token is required" }, 400);
  if (typeof body.password !== "string") return json({ error: "password is required" }, 400);

  try {
    await consumeResetToken(body.token, body.password);
    return json({ ok: true });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "reset failed" }, 400); }
});
