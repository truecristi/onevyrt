import { ensureTrackingKey, getEventCounts, resetCounts, getJourneySessions } from "../../../../../lib/tracking";
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../../lib/workspaces";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/projects/[id]/tracking:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const key = await ensureTrackingKey(scope.wsId, id);
  return json({ key, counts: await getEventCounts(key), journeys: await getJourneySessions(key) });
});
export const DELETE = withRouteLogging("api/projects/[id]/tracking:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  if (scope.role === "viewer") return json({ error: "viewers cannot reset tracking" }, 403);
  const { id } = await ctx.params;
  const key = await ensureTrackingKey(scope.wsId, id);
  await resetCounts(key);
  return json({ ok: true, key });
});
