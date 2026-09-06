import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { billingConfigured, createCheckoutSession, priceIdForPlan } from "../../../../lib/stripe-billing";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

const SELF_SERVE_PLANS = new Set(["pro", "business"]);

/** Starts a Stripe Checkout session to upgrade the caller's workspace to a
 *  paid plan. Owner-only — billing is a workspace-level, ownership-level
 *  decision, same bar as deleting or transferring the workspace itself. */
export const POST = withRouteLogging("api/billing/checkout:POST", async (req: Request): Promise<Response> => {
  if (!billingConfigured()) return json({ error: "Billing isn't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { plan?: unknown; ws?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.plan !== "string" || !SELF_SERVE_PLANS.has(body.plan)) return json({ error: "plan must be 'pro' or 'business'" }, 400);

  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can change billing." }, 403);

  const priceId = priceIdForPlan(body.plan);
  if (!priceId) return json({ error: `No Stripe price configured for the ${body.plan} plan (set STRIPE_PRICE_${body.plan.toUpperCase()}).` }, 503);

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const result = await createCheckoutSession({
    priceId, customerEmail: user.email, workspaceId: wsId, plan: body.plan,
    successUrl: `${origin}/?billing=success`, cancelUrl: `${origin}/?billing=cancelled`,
  });
  if ("error" in result) return json({ error: result.error }, 502);
  return json({ url: result.url });
});
