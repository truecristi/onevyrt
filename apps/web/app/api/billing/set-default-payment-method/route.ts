import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, getWorkspace, roleOf } from "../../../../lib/workspaces";
import { billingConfigured, setDefaultPaymentMethod } from "../../../../lib/stripe-billing";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Called right after the browser confirms a SetupIntent — marks the newly
 *  attached payment method as the customer's default so it's actually used
 *  on the next renewal, not just sitting attached and unused. */
export const POST = withRouteLogging("api/billing/set-default-payment-method:POST", async (req: Request): Promise<Response> => {
  if (!billingConfigured()) return json({ error: "Billing isn't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { ws?: unknown; paymentMethodId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.paymentMethodId !== "string" || !body.paymentMethodId) return json({ error: "paymentMethodId is required" }, 400);

  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can manage billing." }, 403);

  const ws = await getWorkspace(wsId);
  if (!ws?.stripeCustomerId) return json({ error: "No billing history yet — upgrade to a paid plan first." }, 400);

  const result = await setDefaultPaymentMethod(ws.stripeCustomerId, body.paymentMethodId);
  if ("error" in result) return json({ error: result.error }, 502);
  return json({ ok: true });
});
