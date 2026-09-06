import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { createWebhook, listWebhooks, WEBHOOK_EVENT_TYPES, type WebhookEventType } from "../../../../lib/webhooks";
import { checkPublicHttpUrl } from "../../../../lib/url-safety";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// A registered webhook receives the workspace's subscribed events (see
// WEBHOOK_EVENT_TYPES in lib/webhooks.ts for the full list) — same trust
// level as minting an API key, so only owner/manager can register or list them.
async function resolveScope(req: Request): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can manage webhooks" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/settings/webhooks:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  return json(await listWebhooks(scope.wsId));
});

export const POST = withRouteLogging("api/settings/webhooks:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req);
  if (scope instanceof Response) return scope;
  let body: { url?: unknown; events?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.url !== "string" || !/^https?:\/\//.test(body.url)) return json({ error: "url must be an http(s) URL" }, 400);
  // SSRF guard: reject destinations that resolve to internal/private address
  // space (cloud metadata, loopback, LAN ranges) before ever persisting the
  // URL — see lib/url-safety.ts for what's blocked and why.
  const safety = await checkPublicHttpUrl(body.url);
  if (!safety.safe) return json({ error: `That URL isn't reachable as a webhook destination: ${safety.reason}` }, 400);
  const events = Array.isArray(body.events) ? body.events.filter((e): e is WebhookEventType => (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e as string)) : [];
  if (events.length === 0) return json({ error: `events must include at least one of: ${WEBHOOK_EVENT_TYPES.join(", ")}` }, 400);
  const created = await createWebhook(scope.wsId, body.url, events);
  return json(created, 201);
});
