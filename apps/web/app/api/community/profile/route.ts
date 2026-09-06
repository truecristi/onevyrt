/**
 * Community profile API — the public display name a workspace shares under.
 * GET returns the resolved name (set name, else the email-handle default) and
 * whether it's been explicitly set. PUT sets it (owner/manager); an empty name
 * clears it back to the default.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { resolveDisplayName, getProfileName, setProfileName } from "../../../../lib/community/profile";
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

export const GET = withRouteLogging("api/community/profile:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const [name, set] = await Promise.all([resolveDisplayName(scope.wsId), getProfileName(scope.wsId)]);
  return json({ displayName: name, isCustom: set !== null });
});

export const PUT = withRouteLogging("api/community/profile:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { displayName?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const name = typeof body.displayName === "string" ? body.displayName : "";
  const displayName = await setProfileName(scope.wsId, name);
  return json({ ok: true, displayName, isCustom: name.trim().length > 0 });
});
