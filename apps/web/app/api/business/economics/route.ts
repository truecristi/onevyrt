/**
 * Business OS — Economics API. Any member reads, owner/manager saves. The whole
 * economics record (fixed costs, variable cost per unit, optional current
 * volume and profit goal) is saved at once (PUT); the store sanitises and caps
 * it. Shares the workspace_business blob (lib/business.ts), same pattern as the
 * Offer and Message APIs.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getEconomics, saveEconomics } from "../../../../lib/economics";
import { withRouteLogging } from "../../../../lib/logger";
import { track } from "../../../../lib/analytics";
import { PRODUCT_EVENT } from "../../../../lib/product-events";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the economics" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/economics:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  return json(await getEconomics(scope.wsId));
});

export const PUT = withRouteLogging("api/business/economics:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    const saved = await saveEconomics(scope.wsId, body);
    void track(PRODUCT_EVENT.NUMBERS_COMPLETED, { workspaceId: scope.wsId });
    return json(saved);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
