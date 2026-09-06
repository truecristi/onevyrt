import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, getWorkspace, roleOf } from "../../../../lib/workspaces";
import { billingConfigured, createSetupIntent, publishableKey } from "../../../../lib/stripe-billing";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Hands back a SetupIntent client_secret so the browser can mount an
 *  embedded Stripe Elements form to add or replace a card in-page — the
 *  "update payment method" counterpart to /api/billing/subscribe's
 *  PaymentIntent, for a card with no charge attached to it yet. */
export const POST = withRouteLogging("api/billing/setup-intent:POST", async (req: Request): Promise<Response> => {
  if (!billingConfigured()) return json({ error: "Billing isn't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { ws?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can manage billing." }, 403);

  const pk = publishableKey();
  if (!pk) return json({ error: "Billing is missing its publishable key (set STRIPE_PUBLISHABLE_KEY)." }, 503);

  const ws = await getWorkspace(wsId);
  if (!ws?.stripeCustomerId) return json({ error: "No billing history yet — upgrade to a paid plan first." }, 400);

  const result = await createSetupIntent(ws.stripeCustomerId);
  if ("error" in result) return json({ error: result.error }, 502);
  return json({ clientSecret: result.clientSecret, publishableKey: pk });
});
