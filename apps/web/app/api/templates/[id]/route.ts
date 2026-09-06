/**
 * One community template with its full funnel doc — used when someone copies a
 * template into their builder. Fetching it bumps the template's use counter
 * (best-effort). Any authenticated workspace member may read a template; the
 * doc carries no leads or PII, only the funnel structure.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getSharedTemplate, recordTemplateUse } from "../../../../lib/studio/shared-templates";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

// Keyed by workspace id — see api/community/comments/route.ts for why.
// Fetching a template is a "use" (see shared-templates.ts), as frequent as a
// reaction while someone browses the gallery, so the same generous budget.
const USE_LIMIT = { windowMs: 60_000, max: 30 };

export const GET = withRouteLogging("api/templates/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  const rl = await checkRateLimit(`community:template:use:${wsId}`, USE_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  const { id } = await ctx.params;
  const template = await getSharedTemplate(id);
  if (!template) return json({ error: "template not found" }, 404);
  // Copying a template into a builder is a "use" — bump the counter (deduped
  // per workspace so the author can't inflate it by re-fetching their own).
  await recordTemplateUse(id, wsId);
  return json({ template });
});
