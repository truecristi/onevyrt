/**
 * Public read-only API — the integration-framework counterpart to the
 * session-cookie-only browser API: an external tool (Zapier, a script, a
 * BI dashboard) authenticates with `Authorization: Bearer ovk_...` (minted
 * via /api/settings/api-keys) instead of a cookie, and can only read, never
 * write — deliberately narrower than the cookie-authed /api/projects.
 */
import { listProjects } from "../../../../lib/store";
import { resolveApiKeyScope } from "../../../../lib/api-keys";
import { checkRateLimit, rateLimitHeaders } from "../../../../lib/rate-limit";
import { jsonWithETag } from "../../../../lib/etag";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

// Per-workspace budget for the public API. Generous for real integrations,
// low enough to blunt a runaway script; every response carries the standard
// X-RateLimit-* headers so callers can self-throttle.
const API_RATE = { windowMs: 60_000, max: 120 };

export const GET = withRouteLogging("api/v1/projects:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveApiKeyScope(req);
  if (!scope) return json({ error: "missing or invalid Authorization: Bearer <key> header" }, 401);
  const rl = await checkRateLimit(`api:v1:${scope.wsId}`, API_RATE);
  const headers = rateLimitHeaders(rl);
  if (!rl.allowed) return json({ error: "rate limit exceeded" }, 429, headers);
  return jsonWithETag(req, JSON.stringify({ projects: await listProjects(scope.wsId) }), headers);
});
