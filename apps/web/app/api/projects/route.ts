import { listProjects, saveProject, saveProjectIfUnchanged, loadProject, migrateScope, type ProjectMeta } from "../../../lib/store";
import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../lib/workspaces";
import { canWriteProjects } from "../../../lib/entitlements";
import { recordActivity } from "../../../lib/activity";
import { checkRateLimit, retryAfterHeader } from "../../../lib/rate-limit";
import { withRouteLogging } from "../../../lib/logger";
import { dispatchEvent } from "../../../lib/webhooks";

export const runtime = "nodejs";
const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

// Project creation/save is the endpoint hit by autosave (every ~1.5s) and manual
// saves. Per-workspace limit to allow real editing without being too generous.
const SAVE_LIMIT = { windowMs: 60_000, max: 30 };

async function resolveScope(req: Request): Promise<{ wsId: string; role: Role; email: string; userId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  let wsId: string;
  if (wsParam) { wsId = wsParam; }
  else { const personal = await ensurePersonalWorkspace(user.id); wsId = personal.id; await migrateScope(user.id, wsId); }
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId, role, email: user.email, userId: user.id };
}

export const GET = withRouteLogging("api/projects:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  return json(await listProjects(scope.wsId));
});
export const POST = withRouteLogging("api/projects:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  if (scope.role === "viewer") return json({ error: "viewers cannot edit this workspace" }, 403);

  const rl = await checkRateLimit(`project:save:${scope.wsId}`, SAVE_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  // The free plan and an over-seat-quota workspace were previously blocked
  // from creating/saving real projects ONLY in the client (funnel-studio.tsx's
  // isFreePlan/isOverSeatQuota) — POSTing straight here bypassed it entirely.
  if (!(await canWriteProjects(scope.wsId, scope.userId, scope.email))) return json({ error: "Your plan doesn't include saving real projects. Upgrade to build and save your own." }, 403);
  let body: { id?: unknown; name?: unknown; doc?: unknown; baseUpdatedAt?: unknown; force?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body?.id !== "string" || typeof body?.doc !== "string") return json({ error: "id (string) and doc (string) are required" }, 400);
  const name = typeof body.name === "string" ? body.name : "Untitled";
  // Autosave hits this same endpoint every ~1.5s while editing — only the
  // very first save of a given project id is a discrete, feed-worthy event.
  const isNew = !(await loadProject(scope.wsId, body.id));
  // Optimistic concurrency for shared-workspace autosave: when the client sends
  // the updatedAt it loaded, refuse to overwrite a copy another editor saved
  // since — reply 409 so the client can prompt "changed elsewhere, reload"
  // rather than silently clobbering their edits. `force` is the explicit
  // "overwrite with mine" escape hatch. A save with neither (a first save, or an
  // older client) takes the unchecked last-writer-wins path, unchanged.
  const base = typeof body.baseUpdatedAt === "string" ? body.baseUpdatedAt : "";
  let result: ProjectMeta;
  if (base && body.force !== true) {
    const outcome = await saveProjectIfUnchanged(scope.wsId, body.id, name, body.doc, base);
    if (!outcome.ok) {
      return json({ error: "This project was changed elsewhere since you opened it. Reload to get the latest version before saving again.", conflict: true, current: outcome.current }, 409);
    }
    result = outcome.meta;
  } else {
    result = await saveProject(scope.wsId, body.id, name, body.doc);
  }
  if (isNew) {
    await recordActivity(scope.wsId, { actorEmail: scope.email, action: "project.create", projectName: name });
    void dispatchEvent(scope.wsId, "project.created", { id: result.id, name });
  }
  return json(result);
});
