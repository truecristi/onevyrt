/**
 * Stripe billing (OneVYRT's own subscription, not the customer-funnel-event
 * webhook in lib/stripe-webhook.ts — that one ingests a USER's own e-commerce
 * events into their tracked funnel; this is charging for OneVYRT itself).
 * Plain REST calls via fetch, no Stripe SDK — same zero-extra-dependency
 * pattern as the rest of this app's server code. Requires STRIPE_SECRET_KEY
 * in the server's own env — never something typed into chat or committed.
 */
export function billingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export interface CreateCheckoutOpts {
  priceId: string;
  customerEmail: string;
  workspaceId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
}

/** Creates a Stripe Checkout Session for a subscription. The workspace id
 *  travels as client_reference_id, and the plan name as metadata, so the
 *  webhook handler can update the right workspace without a second lookup. */
export async function createCheckoutSession(opts: CreateCheckoutOpts): Promise<{ url: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    customer_email: opts.customerEmail,
    client_reference_id: opts.workspaceId,
    "metadata[plan]": opts.plan,
    "metadata[workspaceId]": opts.workspaceId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });

  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { url?: string };
  if (!data.url) return { error: "Stripe did not return a checkout URL." };
  return { url: data.url };
}

/** Invoice history and payment-method management, kept entirely in-app
 *  (see billing/status, billing/setup-intent, billing/cancel etc. routes)
 *  rather than redirecting to Stripe's hosted billing portal — a paid
 *  customer should never leave the product just to see what they were
 *  charged or swap a card. */
export interface InvoiceSummary { id: string; amountPaid: number; currency: string; status: string; created: number; pdfUrl: string | null; }

export async function listInvoices(customerId: string, limit = 12): Promise<{ invoices: InvoiceSummary[] } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const params = new URLSearchParams({ customer: customerId, limit: String(limit) });
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/invoices?${params.toString()}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { data?: { id: string; amount_paid: number; currency: string; status: string; created: number; invoice_pdf?: string | null }[] };
  return { invoices: (data.data ?? []).map((i) => ({ id: i.id, amountPaid: i.amount_paid, currency: i.currency, status: i.status, created: i.created, pdfUrl: i.invoice_pdf ?? null })) };
}

export interface ActiveSubscription { id: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number; priceId: string | null; }

/** The customer's current live subscription (active/trialing/past_due), if
 *  any — used to drive the in-app "manage subscription" view without
 *  needing a separately-persisted subscription id. */
export async function getActiveSubscription(customerId: string): Promise<{ subscription: ActiveSubscription | null } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const params = new URLSearchParams({ customer: customerId, status: "all", limit: "5" });
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/subscriptions?${params.toString()}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { data?: { id: string; status: string; cancel_at_period_end: boolean; current_period_end: number; items?: { data?: { price?: { id?: string } }[] } }[] };
  const live = (data.data ?? []).find((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due");
  if (!live) return { subscription: null };
  return { subscription: { id: live.id, status: live.status, cancelAtPeriodEnd: live.cancel_at_period_end, currentPeriodEnd: live.current_period_end, priceId: live.items?.data?.[0]?.price?.id ?? null } };
}

/** Schedules (or un-schedules) cancellation at the end of the current
 *  billing period — the customer keeps access they've already paid for
 *  instead of losing it immediately, matching the terms page's stated
 *  cancellation behavior. */
export async function setSubscriptionCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<{ cancelAtPeriodEnd: boolean; currentPeriodEnd: number } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const params = new URLSearchParams({ cancel_at_period_end: String(cancel) });
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { cancel_at_period_end?: boolean; current_period_end?: number };
  return { cancelAtPeriodEnd: !!data.cancel_at_period_end, currentPeriodEnd: data.current_period_end ?? 0 };
}

/** A SetupIntent's client_secret drives an embedded Stripe Elements form for
 *  adding/replacing the card on file — same in-page pattern as the
 *  subscribe flow's PaymentIntent, just for a card with no charge attached
 *  to it yet. Stripe auto-attaches the resulting payment method to the
 *  customer since one is specified here. */
export async function createSetupIntent(customerId: string): Promise<{ clientSecret: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const params = new URLSearchParams({ customer: customerId, usage: "off_session", "payment_method_types[0]": "card" });
  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/setup_intents", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { client_secret?: string };
  if (!data.client_secret) return { error: "Stripe did not return a setup client secret." };
  return { clientSecret: data.client_secret };
}

/** Marks a just-confirmed SetupIntent's payment method as the customer's
 *  default for future invoices — the step that makes "update card" actually
 *  take effect on the next renewal, not just sit attached and unused. */
export async function setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<{ ok: true } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const params = new URLSearchParams({ "invoice_settings[default_payment_method]": paymentMethodId });
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  return { ok: true };
}

/** The Stripe Customer id billed for a Charge, when there is one. A Charge
 *  event (e.g. charge.refunded) already carries `customer` directly, but a
 *  Dispute (charge.dispute.created) does not — only the disputed charge's
 *  id — so the billing webhook fetches the charge to resolve the same
 *  customer id it would have read straight off a refund event. */
export async function getChargeCustomerId(chargeId: string): Promise<{ customerId: string | null } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(chargeId)}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { customer?: string | null };
  return { customerId: typeof data.customer === "string" ? data.customer : null };
}

/** Maps a plan id to its configured Stripe Price id. Returns null for plans
 *  that aren't self-serve checkout (e.g. "performance" is contact-sales) or
 *  aren't configured yet. */
export function priceIdForPlan(plan: string): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}`;
  return process.env[key] || null;
}

const SELF_SERVE_PLANS = ["pro", "business"] as const;

/** Reverse of priceIdForPlan — used by the webhook, which only knows a
 *  subscription's price id, to recover which plan that corresponds to. */
export function planForPriceId(priceId: string): string | null {
  return SELF_SERVE_PLANS.find((plan) => priceIdForPlan(plan) === priceId) ?? null;
}

/** The Stripe publishable key, safe to hand to the browser (it authorizes
 *  nothing on its own — Stripe Elements needs it client-side to tokenize
 *  card data directly with Stripe, so this server never sees raw card
 *  details). Served from an API route rather than baked in at build time,
 *  matching how every other secret in this app is loaded at runtime. */
export function publishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

/** Finds (or creates) the Stripe Customer for a workspace, so repeated
 *  subscribe attempts from the same workspace reuse one customer instead of
 *  minting a new one every time. */
export async function getOrCreateCustomer(existingCustomerId: string | undefined, email: string, workspaceId: string): Promise<{ id: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };
  if (existingCustomerId) return { id: existingCustomerId };

  const params = new URLSearchParams({ email, "metadata[workspaceId]": workspaceId });
  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { id?: string };
  if (!data.id) return { error: "Stripe did not return a customer id." };
  return { id: data.id };
}

interface StripeSubscriptionSummary {
  id: string;
  status: string;
  items?: { data?: { price?: { id?: string } }[] };
  latest_invoice?: { payment_intent?: { client_secret?: string; status?: string } };
}

/** Lists the customer's non-canceled subscriptions, newest first — used to
 *  avoid minting a second live subscription when one already exists (see
 *  createIncompleteSubscription). Small, bounded list; a real customer never
 *  has more than a couple of these. */
async function listOpenSubscriptions(key: string, customerId: string): Promise<StripeSubscriptionSummary[] | { error: string }> {
  const params = new URLSearchParams({ customer: customerId, status: "all", limit: "10", "expand[0]": "data.latest_invoice.payment_intent" });
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/subscriptions?${params.toString()}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { data?: StripeSubscriptionSummary[] };
  return (data.data ?? []).filter((s) => s.status !== "canceled" && s.status !== "incomplete_expired");
}

/** Creates a subscription in "incomplete" state and returns the PaymentIntent
 *  client_secret an embedded Stripe Elements form needs to actually collect
 *  and confirm payment in-page — this is what makes checkout happen inside
 *  the app instead of redirecting to a Stripe-hosted page. The subscription
 *  only becomes active once that PaymentIntent is confirmed; the billing
 *  webhook (customer.subscription.updated) is what flips the workspace's
 *  plan once Stripe confirms the charge actually went through.
 *
 *  Checks for an existing open subscription first — without this, two
 *  browser tabs (or a slow response + retry) each calling this would create
 *  two separate live subscriptions on the same customer, and confirming
 *  both would double-charge them. An existing active/trialing subscription
 *  is reported as an error rather than silently creating a second one; an
 *  existing incomplete one for the same price is reused instead of
 *  abandoned, so its clientSecret still works. */
export async function createIncompleteSubscription(customerId: string, priceId: string, plan: string, workspaceId: string): Promise<{ subscriptionId: string; clientSecret: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  const existing = await listOpenSubscriptions(key, customerId);
  if ("error" in existing) return existing;
  for (const sub of existing) {
    if (sub.status === "active" || sub.status === "trialing") {
      return { error: "This workspace already has an active subscription. Refresh the page — it may just need a moment to sync." };
    }
    if (sub.status === "incomplete" && sub.items?.data?.[0]?.price?.id === priceId) {
      const clientSecret = sub.latest_invoice?.payment_intent?.client_secret;
      if (clientSecret) return { subscriptionId: sub.id, clientSecret };
    }
  }

  const params = new URLSearchParams({
    customer: customerId,
    "items[0][price]": priceId,
    payment_behavior: "default_incomplete",
    "payment_settings[save_default_payment_method]": "on_subscription",
    "expand[0]": "latest_invoice.payment_intent",
    "metadata[plan]": plan,
    "metadata[workspaceId]": workspaceId,
  });
  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { id?: string; latest_invoice?: { payment_intent?: { client_secret?: string } } };
  const clientSecret = data.latest_invoice?.payment_intent?.client_secret;
  if (!data.id || !clientSecret) return { error: "Stripe did not return a payment client secret." };
  return { subscriptionId: data.id, clientSecret };
}

/** A Price's unit amount + currency — used to work out what 30% of a
 *  referred customer's plan actually is (see lib/referrals.ts). Cached in
 *  memory for the life of the process: a Price's amount essentially never
 *  changes once created (Stripe prices are immutable; a real price change
 *  is a new Price object), so repeated lookups for the same plan don't
 *  need to keep hitting Stripe. */
const priceAmountCache = new Map<string, { amountCents: number; currency: string }>();

export async function getPriceAmount(priceId: string): Promise<{ amountCents: number; currency: string } | { error: string }> {
  const cached = priceAmountCache.get(priceId);
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { unit_amount?: number | null; currency?: string };
  if (data.unit_amount == null || !data.currency) return { error: "Stripe did not return a price amount." };
  const result = { amountCents: data.unit_amount, currency: data.currency };
  priceAmountCache.set(priceId, result);
  return result;
}

/** Referral discounts (see lib/referrals.ts and engine/referrals.ts): a
 *  fixed amount_off coupon (not percent_off) — the reward is 30% of what
 *  a referred customer actually pays, summed across every active
 *  referral, so it's a currency amount from the start, not a percentage.
 *  One coupon per distinct (amount, currency) pair, reused across every
 *  referrer who happens to land on that exact total, found by a
 *  deterministic id — no search API, no risk of matching the wrong one. */
function referralCouponId(amountOffCents: number, currency: string): string {
  return `referral_amt_${amountOffCents}_${currency.toLowerCase()}`;
}

async function findOrCreateReferralCoupon(key: string, amountOffCents: number, currency: string): Promise<{ id: string } | { error: string }> {
  const id = referralCouponId(amountOffCents, currency);
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/coupons/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (res.ok) return { id };
  if (res.status !== 404) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }

  const params = new URLSearchParams({
    id, amount_off: String(amountOffCents), currency, duration: "forever",
    name: `Referral discount — ${(amountOffCents / 100).toFixed(2)} ${currency.toUpperCase()} off`,
  });
  let createRes: Response;
  try {
    createRes = await fetch("https://api.stripe.com/v1/coupons", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!createRes.ok) {
    const body = await createRes.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${createRes.status}).` };
  }
  return { id };
}

/** Applies (or, at zero, removes) a referral discount on a live
 *  subscription — this is the function the billing webhook calls
 *  automatically every time a referral's status or price changes, per the
 *  user's explicit choice for this to be live and unattended rather than
 *  requiring a manual sync click. Idempotent: setting the same amount
 *  twice is a no-op cost on Stripe's side (it just re-confirms the same
 *  coupon is attached). Stripe itself caps the discount at the invoice
 *  total — a reward bigger than what the referrer owes just makes that
 *  invoice free, it doesn't carry a negative balance forward. */
export async function applyReferralDiscount(subscriptionId: string, amountOffCents: number, currency: string): Promise<{ ok: true } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  let couponParam = "";
  if (amountOffCents > 0) {
    const coupon = await findOrCreateReferralCoupon(key, amountOffCents, currency);
    if ("error" in coupon) return coupon;
    couponParam = coupon.id;
  }

  const params = new URLSearchParams({ coupon: couponParam });
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  return { ok: true };
}
