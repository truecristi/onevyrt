/**
 * A single saved segment. GET returns it; PUT updates name/description/rules
 * (owner/manager); DELETE removes it (owner/manager).
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getSegment, updateSegment, deleteSegment } from "../../../../lib/segments/store";
import { purgeRow } from "../../../../lib/soft-delete";
import type { Group } from "../../../../lib/segments/rules";
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
  return { wsId };
}

export const GET = withRouteLogging("api/segments/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const seg = await getSegment(scope.wsId, id);
  if (!seg) return json({ error: "segment not found" }, 404);
  return json({ segment: seg });
});

export const PUT = withRouteLogging("api/segments/[id]:PUT", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  let body: { name?: unknown; description?: unknown; rules?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    const seg = await updateSegment(scope.wsId, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      rules: body.rules && typeof body.rules === "object" ? (body.rules as Group) : undefined,
    });
    if (!seg) return json({ error: "segment not found" }, 404);
    return json({ ok: true, segment: seg });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not update" }, 400);
  }
});

export const DELETE = withRouteLogging("api/segments/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  // ?permanent=1 empties this from the bin (irreversible); default is a soft
  // delete → recoverable for 30 days.
  if (new URL(req.url).searchParams.get("permanent") === "1") {
    return json({ ok: await purgeRow("segments", scope.wsId, id), permanent: true });
  }
  return json({ ok: await deleteSegment(scope.wsId, id) });
});
