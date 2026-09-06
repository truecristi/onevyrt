/**
 * Execution OS API — a workspace's 90-day goals, sprints and tasks. Core to the
 * workspace (not behind the Campaign Studio add-on): any member can read,
 * owner/manager can save. The whole execution document is saved at once (PUT);
 * the store sanitises and caps it. Shares the workspace_business blob with the
 * Reality Map (lib/execution.ts).
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getExecution, saveExecution, sanitizeExecution } from "../../../../lib/execution";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the execution plan" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/execution:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  return json(await getExecution(scope.wsId));
});

export const PUT = withRouteLogging("api/business/execution:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    const saved = await saveExecution(scope.wsId, sanitizeExecution(body));
    return json(saved);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
