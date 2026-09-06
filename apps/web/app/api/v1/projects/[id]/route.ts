import { loadProject } from "../../../../../lib/store";
import { resolveApiKeyScope } from "../../../../../lib/api-keys";
import { checkRateLimit, rateLimitHeaders } from "../../../../../lib/rate-limit";
import { jsonWithETag } from "../../../../../lib/etag";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

const API_RATE = { windowMs: 60_000, max: 120 };

export const GET = withRouteLogging("api/v1/projects/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveApiKeyScope(req);
  if (!scope) return json({ error: "missing or invalid Authorization: Bearer <key> header" }, 401);
  const rl = await checkRateLimit(`api:v1:${scope.wsId}`, API_RATE);
  const headers = rateLimitHeaders(rl);
  if (!rl.allowed) return json({ error: "rate limit exceeded" }, 429, headers);
  const { id } = await ctx.params;
  const project = await loadProject(scope.wsId, id);
  return project ? jsonWithETag(req, JSON.stringify(project), headers) : json({ error: "not found" }, 404, headers);
});
