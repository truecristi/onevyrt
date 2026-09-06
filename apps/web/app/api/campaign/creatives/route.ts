/**
 * Saved-creatives API. GET returns the workspace's saved creatives with their
 * real performance (leads / qualified / booked). POST saves a generated variant
 * to track and returns it with its pinned creative_id. DELETE removes one.
 * Owner/manager for writes; any member reads.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { hasEntitlement } from "../../../../lib/entitlements";
import { saveCreative, listCreativePerformance, deleteCreative, anglePerformance, setCreativeSpend } from "../../../../lib/campaign/creatives-store";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveWs(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/campaign/creatives:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const [creatives, angles] = await Promise.all([listCreativePerformance(scope.wsId), anglePerformance(scope.wsId)]);
  return json({ creatives, angles });
});

export const POST = withRouteLogging("api/campaign/creatives:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { funnelSlug?: unknown; creativeId?: unknown; angle?: unknown; headline?: unknown; primaryText?: unknown; cta?: unknown; score?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const funnelSlug = typeof body.funnelSlug === "string" ? body.funnelSlug : "";
  const headline = typeof body.headline === "string" ? body.headline : "";
  if (!funnelSlug || !headline) return json({ error: "a funnel and a headline are required" }, 400);
  try {
    const saved = await saveCreative(scope.wsId, {
      funnelSlug,
      creativeId: typeof body.creativeId === "string" ? body.creativeId : "creative",
      angle: typeof body.angle === "string" ? body.angle : undefined,
      headline,
      primaryText: typeof body.primaryText === "string" ? body.primaryText : undefined,
      cta: typeof body.cta === "string" ? body.cta : undefined,
      score: typeof body.score === "number" ? body.score : undefined,
    });
    return json({ ok: true, creative: saved });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save creative" }, 400);
  }
});

export const PATCH = withRouteLogging("api/campaign/creatives:PATCH", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { id?: unknown; spend?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const id = typeof body.id === "string" ? body.id : "";
  const spend = Number(body.spend);
  if (!id || !Number.isFinite(spend) || spend < 0) return json({ error: "an id and a non-negative spend are required" }, 400);
  return json({ ok: await setCreativeSpend(scope.wsId, id, spend) });
});

export const DELETE = withRouteLogging("api/campaign/creatives:DELETE", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "id is required" }, 400);
  return json({ ok: await deleteCreative(scope.wsId, id) });
});
