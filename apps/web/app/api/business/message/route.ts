/**
 * Business OS — Message API. Core to the workspace (not behind an add-on): any
 * member reads, owner/manager saves. The whole one-liner + story grid is saved
 * at once (PUT); the store sanitises and caps it. Shares the workspace_business
 * blob with the rest of the Business OS (lib/business.ts).
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getMessage, saveMessage, sanitizeMessage } from "../../../../lib/message";
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
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the message" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/message:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  return json(await getMessage(scope.wsId));
});

export const PUT = withRouteLogging("api/business/message:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    const saved = await saveMessage(scope.wsId, sanitizeMessage(body));
    void track(PRODUCT_EVENT.MESSAGE_COMPLETED, { workspaceId: scope.wsId });
    return json(saved);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
