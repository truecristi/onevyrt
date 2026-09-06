/**
 * Business — AI connection API. The workspace's BYO-AI provider/model/key,
 * persisted server-side (encrypted key) so it survives browser clears, restarts
 * and restores. Any member reads the provider/model; only owner/manager get the
 * decrypted key back (the browser needs it to call the provider directly) and
 * only owner/manager may write it — a read-only viewer must not be able to
 * exfiltrate the owner's key, so viewers fall back to managed AI. Mirrors the
 * Economics/Offer
 * route pattern; the store (lib/ai-connection-store) handles encryption and the
 * graceful "storage not configured" fallback.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getAiConnection, saveAiConnection } from "../../../../lib/ai-connection-store";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can change the AI connection" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/ai-connection:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  // Only an owner/manager gets the decrypted key back; viewers/members see the
  // provider + model but not the secret.
  const maySeeKey = scope.role === "owner" || scope.role === "manager";
  return json(await getAiConnection(scope.wsId, maySeeKey));
});

export const PUT = withRouteLogging("api/business/ai-connection:PUT", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  try {
    return json(await saveAiConnection(scope.wsId, (body ?? {}) as Record<string, unknown>));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
