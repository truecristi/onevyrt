/**
 * Business — momentum-streak API. The workspace's weekly streak record,
 * persisted server-side (the `streak` section of workspace_business) so it
 * survives browser clears, new devices, restarts and restores. Any member
 * reads and writes it — it's shared momentum, not a privileged setting. The
 * store (lib/studio/streak-store) sanitizes the record. Mirrors the
 * AI-connection / Economics route pattern.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getStreak, saveStreak } from "../../../../lib/studio/streak-store";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/business/streak:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  return json(await getStreak(scope.wsId));
});

export const PUT = withRouteLogging("api/business/streak:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    return json(await saveStreak(scope.wsId, body));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
