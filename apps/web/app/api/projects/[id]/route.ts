import { loadProject, deleteProject, purgeProject, migrateScope } from "../../../../lib/store";
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { recordActivity } from "../../../../lib/activity";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
import { dispatchEvent } from "../../../../lib/webhooks";

export const runtime = "nodejs";
const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

// Project deletion (soft-delete or permanent purge). Rate-limited to prevent
// accidental or malicious mass deletion.
const DELETE_LIMIT = { windowMs: 60_000, max: 20 };

async function resolveScope(req: Request): Promise<{ wsId: string; role: Role; email: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  let wsId: string;
  if (wsParam) { wsId = wsParam; }
  else { const personal = await ensurePersonalWorkspace(user.id); wsId = personal.id; await migrateScope(user.id, wsId); }
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId, role, email: user.email };
}

export const GET = withRouteLogging("api/projects/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  const { id } = await ctx.params;
  const project = await loadProject(scope.wsId, id);
  return project ? json(project) : json({ error: "not found" }, 404);
});
export const DELETE = withRouteLogging("api/projects/[id]:DELETE", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  if (scope.role === "viewer") return json({ error: "viewers cannot edit this workspace" }, 403);

  const rl = await checkRateLimit(`project:delete:${scope.wsId}`, DELETE_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  const { id } = await ctx.params;
  // ?permanent=1 empties this item from the bin (irreversible); default is a
  // soft delete → recoverable from the bin for 30 days.
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  if (permanent) {
    const ok = await purgeProject(scope.wsId, id);
    if (ok) await recordActivity(scope.wsId, { actorEmail: scope.email, action: "project.purge", projectName: id });
    return json({ ok, permanent: true });
  }
  const existing = await loadProject(scope.wsId, id);
  const ok = await deleteProject(scope.wsId, id);
  if (ok) {
    await recordActivity(scope.wsId, { actorEmail: scope.email, action: "project.delete", projectName: existing?.name ?? id });
    void dispatchEvent(scope.wsId, "project.deleted", { id, name: existing?.name ?? id });
  }
  return json({ ok });
});
