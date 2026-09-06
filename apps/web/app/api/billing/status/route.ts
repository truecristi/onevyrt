import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, getWorkspace, roleOf } from "../../../../lib/workspaces";
import { billingConfigured, getActiveSubscription, listInvoices } from "../../../../lib/stripe-billing";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Everything the in-app "manage subscription" view needs in one call: the
 *  workspace's plan, its live Stripe subscription (if any), and recent
 *  invoice history — all rendered inside the app instead of redirecting to
 *  Stripe's hosted billing portal. */
export const POST = withRouteLogging("api/billing/status:POST", async (req: Request): Promise<Response> => {
  if (!billingConfigured()) return json({ error: "Billing isn't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { ws?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can view billing." }, 403);

  const ws = await getWorkspace(wsId);
  if (!ws) return json({ error: "workspace not found" }, 404);
  if (!ws.stripeCustomerId) return json({ plan: ws.plan ?? "free", subscription: null, invoices: [] });

  const [subResult, invoicesResult] = await Promise.all([
    getActiveSubscription(ws.stripeCustomerId),
    listInvoices(ws.stripeCustomerId),
  ]);
  if ("error" in subResult) return json({ error: subResult.error }, 502);
  if ("error" in invoicesResult) return json({ error: invoicesResult.error }, 502);

  return json({ plan: ws.plan ?? "free", subscription: subResult.subscription, invoices: invoicesResult.invoices });
});
