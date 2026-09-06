/**
 * Funnel builder API. A workspace manages its own qualification funnels here:
 * list them (GET), create or update one (POST { doc, published }), or remove
 * one (DELETE ?slug=). Owner/manager only for writes. The doc is validated and
 * compiled elsewhere; this route is the authenticated, workspace-scoped door.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { listWorkspaceFunnels, saveFunnel, deleteFunnel, FunnelSlugTakenError } from "../../../../lib/studio/funnel-store";
import type { FunnelDoc } from "../../../../lib/studio/funnel-builder";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveWs(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit funnels" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/business/funnels:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const funnels = await listWorkspaceFunnels(scope.wsId);
  return json({ funnels });
});

export const POST = withRouteLogging("api/business/funnels:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { doc?: unknown; published?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!body.doc || typeof body.doc !== "object") return json({ error: "a funnel doc is required" }, 400);
  const published = body.published !== false;
  try {
    const saved = await saveFunnel(scope.wsId, body.doc as FunnelDoc, published);
    return json({ ok: true, funnel: saved });
  } catch (e) {
    if (e instanceof FunnelSlugTakenError) return json({ error: e.message }, 409);
    return json({ error: e instanceof Error ? e.message : "could not save funnel" }, 400);
  }
});

export const DELETE = withRouteLogging("api/business/funnels:DELETE", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const slug = new URL(req.url).searchParams.get("slug") || "";
  if (!slug) return json({ error: "slug is required" }, 400);
  const removed = await deleteFunnel(scope.wsId, slug);
  return json({ ok: removed });
});
