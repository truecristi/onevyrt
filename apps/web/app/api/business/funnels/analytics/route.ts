/**
 * Funnel analytics API. GET ?slug=… returns the conversion report (view →
 * start → lead → qualified → verified → booked, per-ad breakdown, spend/CAC)
 * for a workspace, optionally narrowed to one funnel. POST sets a funnel's ad
 * spend so cost-per-qualified-lead / cost-per-booking can be shown.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getStoredFunnel } from "../../../../../lib/studio/funnel-store";
import { funnelAnalytics, setFunnelSpend } from "../../../../../lib/acquisition/funnel-events";
import { withRouteLogging } from "../../../../../lib/logger";

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

export const GET = withRouteLogging("api/business/funnels/analytics:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const slug = new URL(req.url).searchParams.get("slug") || undefined;
  const report = await funnelAnalytics(scope.wsId, slug);
  return json({ report });
});

export const POST = withRouteLogging("api/business/funnels/analytics:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  let body: { slug?: unknown; amount?: unknown; currency?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const amount = Number(body.amount);
  if (!slug || !Number.isFinite(amount) || amount < 0) return json({ error: "a slug and a non-negative amount are required" }, 400);
  // Only let a workspace set spend on a funnel it actually owns.
  const stored = await getStoredFunnel(slug);
  if (!stored || stored.workspaceId !== scope.wsId) return json({ error: "unknown funnel" }, 404);
  const currency = typeof body.currency === "string" && body.currency.length <= 4 ? body.currency : "USD";
  await setFunnelSpend(scope.wsId, slug, amount, currency);
  return json({ ok: true });
});
