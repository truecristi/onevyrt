import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { createApiKey, listApiKeys } from "../../../../lib/api-keys";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// Minting a key hands out standing read access to everything in the
// workspace, same trust level as adding a member — so only owner/manager
// can create or list them, not every editor.
async function resolveScope(req: Request): Promise<{ wsId: string; userId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can manage API keys" }, 403);
  return { wsId, userId: user.id, role };
}

export const GET = withRouteLogging("api/settings/api-keys:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  return json(await listApiKeys(scope.wsId));
});

export const POST = withRouteLogging("api/settings/api-keys:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  let body: { name?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const name = typeof body.name === "string" ? body.name.slice(0, 80) : "Untitled key";
  const created = await createApiKey(scope.wsId, scope.userId, name);
  return json(created, 201);
});
