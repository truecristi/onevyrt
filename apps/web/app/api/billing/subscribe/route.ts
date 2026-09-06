import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { billingConfigured, priceIdForPlan, getOrCreateCustomer, createIncompleteSubscription, publishableKey } from "../../../../lib/stripe-billing";
import { withRouteLogging } from "../../../../lib/logger";
import { withAdvisoryLock } from "../../../../lib/db";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

const SELF_SERVE_PLANS = new Set(["pro", "business"]);

/** Starts an in-app subscription: creates (or reuses) the workspace's Stripe
 *  Customer and an incomplete Subscription, then hands back the PaymentIntent
 *  client_secret an embedded Stripe Elements form needs to collect card
 *  details and confirm payment without ever leaving this app. Same
 *  owner-only bar as /api/billing/checkout — this is the embedded sibling
 *  of that route, not a replacement for its authorization rules. */
export const POST = withRouteLogging("api/billing/subscribe:POST", async (req: Request): Promise<Response> => {
  if (!billingConfigured()) return json({ error: "Billing isn't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { plan?: unknown; ws?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.plan !== "string" || !SELF_SERVE_PLANS.has(body.plan)) return json({ error: "plan must be 'pro' or 'business'" }, 400);
  const plan = body.plan;

  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can change billing." }, 403);

  const priceId = priceIdForPlan(plan);
  if (!priceId) return json({ error: `No Stripe price configured for the ${plan} plan (set STRIPE_PRICE_${plan.toUpperCase()}).` }, 503);

  const pk = publishableKey();
  if (!pk) return json({ error: "Billing is missing its publishable key (set STRIPE_PUBLISHABLE_KEY)." }, 503);

  // Serialize the whole check-existing-then-create against a concurrent
  // subscribe for the SAME workspace (a double-click, a retry, two tabs) using
  // the per-workspace advisory lock the rest of the app uses. Without it two
  // requests each see "no active subscription" and each create one — two live
  // subscriptions on the customer, and confirming both double-charges. The lock
  // is held across the Stripe calls so the re-check and the create can't
  // interleave; keyed per workspace, so different workspaces never contend.
  //
  // All DB work inside runs on the lock's own client — never a fresh pgPool()
  // connection while the lock is held, which is the pool-starvation deadlock
  // db.ts warns about. The Stripe REST calls use no pool connection.
  return withAdvisoryLock(`billing-subscribe:${wsId}`, async (client): Promise<Response> => {
    // Read the customer id INSIDE the lock: a concurrent subscribe for this
    // workspace may have just created and stored the Customer, and we must
    // reuse it — a second Customer would carry its own subscription, i.e. a
    // second charge. Doubles as the workspace-exists check.
    const wsRes = await client.query<{ stripe_customer_id: string | null }>(
      "SELECT stripe_customer_id FROM workspaces WHERE id = $1",
      [wsId],
    );
    const wsRow = wsRes.rows[0];
    if (!wsRow) return json({ error: "workspace not found" }, 404);

    const customer = await getOrCreateCustomer(wsRow.stripe_customer_id ?? undefined, user.email, wsId);
    if ("error" in customer) return json({ error: customer.error }, 502);
    if (customer.id !== wsRow.stripe_customer_id) {
      // Persist on the lock client, inside the lock's transaction, so the next
      // waiter for this workspace reads this customer id and reuses it.
      await client.query("UPDATE workspaces SET stripe_customer_id = $2 WHERE id = $1", [wsId, customer.id]);
    }

    // createIncompleteSubscription re-checks for an already-open subscription
    // and creates one only if there isn't — now atomic per workspace under the
    // lock above, so a double-submit can't slip two subscriptions past it.
    const sub = await createIncompleteSubscription(customer.id, priceId, plan, wsId);
    if ("error" in sub) return json({ error: sub.error }, 502);

    return json({ clientSecret: sub.clientSecret, subscriptionId: sub.subscriptionId, publishableKey: pk });
  });
});
