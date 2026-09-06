/**
 * Key Driver Tree API — a workspace's driver model. Core to the workspace (not
 * behind the Campaign Studio add-on): any member reads, owner/manager saves.
 * The whole tree is saved at once (PUT); the store sanitises and caps it.
 * Shares the workspace_business blob with the Reality Map and Execution OS.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getDriverTree, saveDriverTree, sanitizeDriverTree } from "../../../../lib/drivers";
import { liveAcquisitionMetrics } from "../../../../lib/acquisition/live-metrics";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the driver tree" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/drivers:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  const [tree, live] = await Promise.all([getDriverTree(scope.wsId), liveAcquisitionMetrics(scope.wsId)]);
  // Overlay live values onto any driver linked to an acquisition metric, so the
  // tree shows what the funnels actually produce. The stored value is left
  // untouched — only the response reflects the live number.
  const byKey = new Map(live.map((m) => [m.key, m]));
  const drivers = tree.drivers.map((d) => (d.source && byKey.has(d.source) ? { ...d, current: byKey.get(d.source)!.display } : d));
  return json({ ...tree, drivers, live });
});

export const PUT = withRouteLogging("api/business/drivers:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    const saved = await saveDriverTree(scope.wsId, sanitizeDriverTree(body));
    return json(saved);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
