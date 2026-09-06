/**
 * Segments API. GET lists the workspace's saved segments; POST creates one
 * (owner/manager). Live preview and per-segment contacts live under
 * /api/segments/preview and /api/segments/[id].
 */
import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { listSegments, createSegment } from "../../../lib/segments/store";
import type { Group } from "../../../lib/segments/rules";
import { withRouteLogging } from "../../../lib/logger";

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

export const GET = withRouteLogging("api/segments:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  return json({ segments: await listSegments(scope.wsId) });
});

export const POST = withRouteLogging("api/segments:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { name?: unknown; description?: unknown; rules?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim() || !body.rules || typeof body.rules !== "object") return json({ error: "a name and a rules tree are required" }, 400);
  try {
    const seg = await createSegment(scope.wsId, {
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      rules: body.rules as Group,
    });
    return json({ ok: true, segment: seg });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not create segment" }, 400);
  }
});
