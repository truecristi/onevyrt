import { listRevisions, saveRevision, getRevision } from "../../../../../lib/revisions";
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../../lib/workspaces";
import { recordActivity } from "../../../../../lib/activity";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(
  req: Request,
): Promise<{ wsId: string; role: Role; userId: string; email: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId, role, userId: user.id, email: user.email };
}

/** GET -> list of snapshots. GET ?rev=<id> -> that snapshot's document. */
export const GET = withRouteLogging("api/projects/[id]/revisions:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const revId = new URL(req.url).searchParams.get("rev");
  if (revId) {
    const doc = await getRevision(scope.wsId, id, revId);
    return doc ? json({ doc }) : json({ error: "revision not found" }, 404);
  }
  return json({ revisions: await listRevisions(scope.wsId, id) });
});

/** POST -> take a snapshot. Editors and owners only. */
export const POST = withRouteLogging("api/projects/[id]/revisions:POST", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  if (scope.role === "viewer") return json({ error: "viewers cannot save revisions" }, 403);
  const { id } = await ctx.params;
  let body: { doc?: unknown; note?: unknown; revenue?: unknown; profit?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (typeof body.doc !== "string" || !body.doc) return json({ error: "doc is required" }, 400);
  const meta = await saveRevision(
    scope.wsId,
    id,
    scope.userId,
    scope.email,
    body.doc,
    typeof body.note === "string" ? body.note : "",
    {
      revenue: typeof body.revenue === "number" ? body.revenue : undefined,
      profit: typeof body.profit === "number" ? body.profit : undefined,
    },
  );
  await recordActivity(scope.wsId, { actorEmail: scope.email, action: "project.save", projectName: id, detail: typeof body.note === "string" && body.note ? body.note : undefined });
  return json({ revision: meta }, 201);
});
