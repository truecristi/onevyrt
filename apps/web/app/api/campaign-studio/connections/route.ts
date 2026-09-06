/**
 * Campaign Studio — connected accounts API. GET returns every provider with
 * its current connection status; POST connects/disconnects one. Gated behind
 * the campaign_studio entitlement; writes require owner/manager.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { hasEntitlement } from "../../../../lib/entitlements";
import { PROVIDERS, isProvider, listConnections, connectProvider, disconnectProvider } from "../../../../lib/integrations";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can manage connections" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/campaign-studio/connections:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  const connections = await listConnections(scope.wsId);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  // Merge the full provider catalogue with the workspace's actual links, so
  // the UI can render every platform (connected or not) in one pass.
  const providers = PROVIDERS.map((p) => ({ ...p, connection: byProvider.get(p.id) ?? null }));
  return json({ providers });
});

export const POST = withRouteLogging("api/campaign-studio/connections:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: { provider?: unknown; action?: unknown; accountName?: unknown; accountId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.provider !== "string" || !isProvider(body.provider)) return json({ error: "unknown provider" }, 400);
  if (body.action !== "connect" && body.action !== "disconnect") return json({ error: "action must be 'connect' or 'disconnect'" }, 400);

  if (body.action === "disconnect") {
    await disconnectProvider(scope.wsId, body.provider);
    return json({ ok: true });
  }
  const accountName = typeof body.accountName === "string" ? body.accountName : "";
  if (!accountName.trim()) return json({ error: "an account name is required" }, 400);
  const accountId = typeof body.accountId === "string" ? body.accountId : undefined;
  const connection = await connectProvider(scope.wsId, body.provider, accountName, accountId);
  return json({ connection });
});
