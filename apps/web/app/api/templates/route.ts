/**
 * Community funnel-template gallery API. GET lists published templates (any
 * authed user). POST publishes one of your funnels as a template (owner/
 * manager). DELETE ?id= unpublishes a template you authored.
 */
import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { publishTemplate, listSharedTemplates, unpublishTemplate } from "../../../lib/studio/shared-templates";
import { resolveDisplayName } from "../../../lib/community/profile";
import type { FunnelDoc } from "../../../lib/studio/funnel-builder";
import { checkRateLimit, retryAfterHeader } from "../../../lib/rate-limit";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

// Keyed by workspace id — see api/community/comments/route.ts for why.
// Publishing a template is rare relative to browsing the gallery, so a
// tight-but-livable hourly budget.
const PUBLISH_LIMIT = { windowMs: 3_600_000, max: 10 };

async function resolveWs(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/templates:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const templates = await listSharedTemplates();
  // Tag the caller's own templates so the UI can offer "unpublish".
  return json({ templates: templates.map((t) => ({ ...t, mine: t.authorWorkspaceId === scope.wsId })) });
});

export const POST = withRouteLogging("api/templates:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const rl = await checkRateLimit(`community:template:publish:${scope.wsId}`, PUBLISH_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again later" }, 429, retryAfterHeader(rl.retryAfterMs!));
  let body: { name?: unknown; description?: unknown; category?: unknown; doc?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const name = typeof body.name === "string" ? body.name : "";
  if (!name || !body.doc || typeof body.doc !== "object") return json({ error: "a name and a funnel doc are required" }, 400);
  try {
    const t = await publishTemplate(scope.wsId, {
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      doc: body.doc as FunnelDoc,
      authorName: await resolveDisplayName(scope.wsId),
    });
    return json({ ok: true, template: t });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not publish" }, 400);
  }
});

export const DELETE = withRouteLogging("api/templates:DELETE", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "id is required" }, 400);
  return json({ ok: await unpublishTemplate(scope.wsId, id) });
});
