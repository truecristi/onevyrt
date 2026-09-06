import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, getWorkspace, roleOf } from "../../../../lib/workspaces";
import { billingConfigured, getActiveSubscription, setSubscriptionCancelAtPeriodEnd } from "../../../../lib/stripe-billing";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Schedules cancellation at the end of the current billing period — access
 *  already paid for isn't cut off immediately. The workspace's plan itself
 *  only flips to "free" once the subscription actually ends and Stripe's
 *  customer.subscription.deleted webhook fires. */
export const POST = withRouteLogging("api/billing/cancel:POST", async (req: Request): Promise<Response> => {
  if (!billingConfigured()) return json({ error: "Billing isn't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { ws?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can cancel billing." }, 403);

  const ws = await getWorkspace(wsId);
  if (!ws?.stripeCustomerId) return json({ error: "No active subscription to cancel." }, 400);

  const active = await getActiveSubscription(ws.stripeCustomerId);
  if ("error" in active) return json({ error: active.error }, 502);
  if (!active.subscription) return json({ error: "No active subscription to cancel." }, 400);

  const result = await setSubscriptionCancelAtPeriodEnd(active.subscription.id, true);
  if ("error" in result) return json({ error: result.error }, 502);
  return json(result);
});
