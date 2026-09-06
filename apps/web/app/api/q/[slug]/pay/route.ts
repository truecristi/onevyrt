/**
 * The public funnel's paid step. A visitor on /q/[slug] whose funnel has a
 * paid step calls this to start a payment: we resolve the funnel's owning
 * workspace, confirm it has a connected Stripe account, and mint a destination
 * PaymentIntent for the AUTHORITATIVE amount from the funnel config (never a
 * client-supplied number). The returned client_secret is confirmed in the
 * browser with Stripe's hosted fields, so raw card data never touches us.
 *
 * The price authority + connect gating live in lib/acquisition/funnel-payment
 * (pure, unit-tested); this route is the thin orchestration over it and the
 * already-tested lib/stripe-connect helper.
 */
import { resolveFunnelConfig } from "../../../../../lib/studio/funnel-store";
import { funnelOwner } from "../../../../../lib/acquisition/leads";
import { getWorkspace } from "../../../../../lib/workspaces";
import { resolveFunnelPayment } from "../../../../../lib/acquisition/funnel-payment";
import { connectConfigured, createDestinationPaymentIntent, getConnectedAccount, canAcceptPayments } from "../../../../../lib/stripe-connect";
import { FUNNEL_PAYMENT_SOURCE } from "../../../../../lib/acquisition/funnel-conversion";
import { publishableKey } from "../../../../../lib/stripe-billing";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const LIMIT = { windowMs: 60 * 1000, max: 20 };

export const POST = withRouteLogging("api/q/pay:POST", async (req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> => {
  const limit = await checkRateLimit(`pay:ip:${clientIp(req)}`, LIMIT);
  if (!limit.allowed) return json({ error: "Too many requests." }, 429, retryAfterHeader(limit.retryAfterMs!));

  const { slug } = await ctx.params;
  const config = await resolveFunnelConfig(slug);
  if (!config) return json({ error: "unknown funnel" }, 404);

  // Resolve the funnel's owning workspace → its connected payout account.
  const workspaceId = await funnelOwner(slug);
  const ws = workspaceId ? await getWorkspace(workspaceId) : null;

  // connectAccountId is set the instant Connect onboarding STARTS (see
  // app/api/billing/connect/start), long before Stripe actually clears the
  // account to accept charges. Fetch its LIVE status — the same call the
  // owner-facing status widget uses — so an account that's still onboarding
  // or restricted can't take a customer's money. Any lookup failure (network,
  // Stripe outage, bad account) fails closed to "not ready", never ok:true.
  let accountReady = false;
  if (ws?.stripeConnectAccountId) {
    const account = await getConnectedAccount(ws.stripeConnectAccountId);
    if (!("error" in account)) accountReady = canAcceptPayments(account.flags);
  }

  const plan = resolveFunnelPayment(config.payment, {
    platformConfigured: connectConfigured(),
    connectAccountId: ws?.stripeConnectAccountId ?? null,
    accountReady,
  });
  if (!plan.ok) {
    // Map the pure reason to an honest status the client can act on.
    if (plan.reason === "not_configured") return json({ error: "Payments aren't configured on this server yet." }, 503);
    if (plan.reason === "no_account") return json({ error: "This business hasn't connected a payout account yet." }, 400);
    if (plan.reason === "account_not_ready") return json({ error: "This business's payout account isn't ready to accept payments yet." }, 400);
    return json({ error: "This funnel doesn't have a paid step." }, 400);
  }

  // ws is guaranteed non-null here: resolveFunnelPayment only returns ok when
  // connectAccountId is present, which comes from ws.
  const intent = await createDestinationPaymentIntent({
    accountId: ws!.stripeConnectAccountId!,
    amountCents: plan.amountCents,
    currency: plan.currency,
    feePercent: plan.feePercent,
    description: plan.description,
    // Attribution so payment_intent.succeeded lands as revenue in the owning
    // workspace (see lib/acquisition/funnel-conversion + the stripe webhook).
    metadata: { workspaceId: ws!.id, funnelSlug: slug, source: FUNNEL_PAYMENT_SOURCE },
  });
  if ("error" in intent) return json({ error: intent.error }, 502);

  // The client needs the platform publishable key to confirm the intent with
  // Stripe.js. A destination charge lives on the platform account, so this is
  // the platform key (not the connected account's).
  const pk = publishableKey();
  if (!pk) return json({ error: "Payments are missing their publishable key on this server." }, 503);

  // Always hand back a return URL so a redirect-based payment method (an APM /
  // bank redirect selected in the Payment Element) comes back to the funnel
  // instead of dead-ending. Mirrors the billing checkout's origin-derived
  // success URL; the client passes it to Stripe.js as confirmParams.return_url.
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const returnUrl = `${origin}/q/${encodeURIComponent(slug)}`;

  return json({ clientSecret: intent.clientSecret, publishableKey: pk, amountCents: plan.amountCents, currency: plan.currency, returnUrl });
});
