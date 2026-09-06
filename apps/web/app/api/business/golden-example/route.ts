/**
 * Business OS — Golden Example API. Any member reads, owner/manager saves. The
 * whole worked example (ladder + USP + sales angle + ad + first step) is saved
 * at once (PUT); the store sanitises it. Shares the workspace_business blob
 * (lib/business.ts), same pattern as the Economics and Offer APIs.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getGoldenExample, saveGoldenExample } from "../../../../lib/golden-example";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the example" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/golden-example:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  return json(await getGoldenExample(scope.wsId));
});

export const PUT = withRouteLogging("api/business/golden-example:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    return json(await saveGoldenExample(scope.wsId, body));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
