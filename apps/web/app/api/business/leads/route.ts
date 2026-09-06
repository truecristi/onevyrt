/**
 * Leads inbox API. The app's side of the Acquisition OS loop — the qualified
 * leads and booked calls a workspace's funnels produced. GET returns the
 * viewer's own leads + bookings (scoped by workspace_id, never cross-tenant).
 * POST { action: "claim", slug } adopts an unowned funnel (e.g. the demo) into
 * the viewer's workspace and back-fills its previously-unowned rows, so the
 * inbox lights up with real data.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, listWorkspaceMemberSummaries } from "../../../../lib/workspaces";
import { getQualFunnel } from "../../../../lib/studio/qualification-config";
import { listWorkspaceLeads, listWorkspaceBookings, funnelOwner, claimFunnel, acquisitionSummary } from "../../../../lib/acquisition/leads";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

async function resolveWs(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/business/leads:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const me = await currentUser(req.headers.get("cookie"));
  const [leads, bookings, demoOwner, summary, members] = await Promise.all([
    listWorkspaceLeads(scope.wsId),
    listWorkspaceBookings(scope.wsId),
    funnelOwner("demo"),
    acquisitionSummary(scope.wsId, todayISO()),
    listWorkspaceMemberSummaries(scope.wsId),
  ]);
  // The demo funnel is claimable when nobody owns it yet — surfaced so a fresh
  // workspace can adopt its sample leads and see the loop working.
  const demoClaimable = demoOwner == null && Boolean(getQualFunnel("demo"));
  // members + currentUserId power the assignee picker and the "My leads" filter.
  return json({ leads, bookings, summary, demoClaimable, ownsDemo: demoOwner === scope.wsId, members, currentUserId: me?.id ?? null });
});

export const POST = withRouteLogging("api/business/leads:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { action?: unknown; slug?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (body.action !== "claim") return json({ error: "unknown action" }, 400);
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!getQualFunnel(slug)) return json({ error: "unknown funnel" }, 404);
  const res = await claimFunnel(slug, scope.wsId);
  if (res.owner !== scope.wsId) return json({ error: "This funnel is already owned by another workspace." }, 409);
  return json({ ok: true, adopted: { leads: res.leads, bookings: res.bookings } });
});
