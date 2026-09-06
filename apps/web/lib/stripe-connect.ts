/**
 * Stripe Connect — lets each OneVYRT user collect payments from THEIR own
 * customers (distinct from lib/stripe-billing.ts, which charges for OneVYRT
 * itself). A user connects an Express account, we store only their account id,
 * and their funnel checkouts become destination charges to that account with an
 * optional platform fee. Card data always goes straight to Stripe's hosted
 * fields — we never see or store raw card details.
 *
 * Same zero-dependency pattern as stripe-billing.ts: plain REST via fetch with
 * the platform's STRIPE_SECRET_KEY, no Stripe SDK. Pure helpers (fee math,
 * status derivation) live alongside so they're unit-tested without any network.
 */

export function connectConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

const STRIPE = "https://api.stripe.com/v1";
const authHeaders = (key: string) => ({ Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" });

// ————————————————————————————————————————————————————————————————
// Pure helpers (no network) — the parts worth unit-testing.
// ————————————————————————————————————————————————————————————————

/** Where a connected account is in the onboarding lifecycle. */
export type ConnectStatus = "onboarding" | "restricted" | "active";

export interface ConnectAccountFlags {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

/**
 * Derive a simple status from Stripe's account flags:
 *  - active: can take charges AND receive payouts — fully live.
 *  - restricted: finished the form but Stripe still needs something (verification).
 *  - onboarding: hasn't completed the Express form yet.
 */
export function connectAccountStatus(a: ConnectAccountFlags | null | undefined): ConnectStatus {
  if (!a) return "onboarding";
  if (a.charges_enabled && a.payouts_enabled) return "active";
  if (a.details_submitted) return "restricted";
  return "onboarding";
}

/** True only when the account can actually accept a payment right now. */
export function canAcceptPayments(a: ConnectAccountFlags | null | undefined): boolean {
  return !!a?.charges_enabled;
}

/**
 * The platform's cut of a charge, in whole cents. feePercent is a percentage
 * (e.g. 2.5 = 2.5%). Clamped to [0, 100]% and never larger than the charge, so
 * a mis-set fee can't exceed or invert the payment. Rounds to the nearest cent.
 */
export function computeApplicationFeeCents(amountCents: number, feePercent: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const pct = Math.min(100, Math.max(0, Number.isFinite(feePercent) ? feePercent : 0));
  const fee = Math.round((amountCents * pct) / 100);
  return Math.min(fee, Math.floor(amountCents));
}

// ————————————————————————————————————————————————————————————————
// Integration calls (require STRIPE_SECRET_KEY).
// ————————————————————————————————————————————————————————————————

/** Create an Express connected account for a user. Returns the account id to
 *  store on their workspace. Email is prefilled to smooth onboarding. */
export async function createConnectedAccount(email: string, workspaceId: string): Promise<{ accountId: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Payments aren't configured on this server yet." };
  const params = new URLSearchParams({
    type: "express",
    email,
    "capabilities[card_payments][requested]": "true",
    "capabilities[transfers][requested]": "true",
    "metadata[workspaceId]": workspaceId,
  });
  let res: Response;
  try {
    res = await fetch(`${STRIPE}/accounts`, { method: "POST", headers: authHeaders(key), body: params.toString() });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) return { error: await stripeError(res) };
  const data = (await res.json()) as { id?: string };
  if (!data.id) return { error: "Stripe did not return an account id." };
  return { accountId: data.id };
}

/** Create a one-time onboarding link the user follows to finish their Express
 *  account. refreshUrl is where Stripe sends them if the link expires; returnUrl
 *  is where they land when done. */
export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<{ url: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Payments aren't configured on this server yet." };
  const params = new URLSearchParams({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  let res: Response;
  try {
    res = await fetch(`${STRIPE}/account_links`, { method: "POST", headers: authHeaders(key), body: params.toString() });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) return { error: await stripeError(res) };
  const data = (await res.json()) as { url?: string };
  if (!data.url) return { error: "Stripe did not return an onboarding URL." };
  return { url: data.url };
}

/** Fetch a connected account's live flags + derived status. */
export async function getConnectedAccount(accountId: string): Promise<{ status: ConnectStatus; flags: ConnectAccountFlags } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Payments aren't configured on this server yet." };
  let res: Response;
  try {
    res = await fetch(`${STRIPE}/accounts/${encodeURIComponent(accountId)}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) return { error: await stripeError(res) };
  const a = (await res.json()) as ConnectAccountFlags;
  return { status: connectAccountStatus(a), flags: { charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled, details_submitted: a.details_submitted } };
}

export interface DestinationChargeOpts {
  accountId: string;
  amountCents: number;
  currency: string;
  feePercent: number;
  description?: string;
  /** Attached to the PaymentIntent as metadata[key]=value — used to attribute
   *  the sale back to a workspace/funnel in the webhook (see funnel-conversion). */
  metadata?: Record<string, string>;
}

/**
 * Create a PaymentIntent as a destination charge: the customer pays, funds land
 * in the connected account, and the platform keeps application_fee_amount. The
 * returned client_secret is confirmed on the client with Stripe's hosted fields,
 * so raw card data never reaches our server.
 */
export async function createDestinationPaymentIntent(opts: DestinationChargeOpts): Promise<{ clientSecret: string; applicationFeeCents: number } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Payments aren't configured on this server yet." };
  if (!Number.isFinite(opts.amountCents) || opts.amountCents <= 0) return { error: "Amount must be greater than zero." };
  const fee = computeApplicationFeeCents(opts.amountCents, opts.feePercent);
  const params = new URLSearchParams({
    amount: String(Math.floor(opts.amountCents)),
    currency: opts.currency.toLowerCase(),
    "automatic_payment_methods[enabled]": "true",
    application_fee_amount: String(fee),
    "transfer_data[destination]": opts.accountId,
  });
  if (opts.description) params.set("description", opts.description);
  if (opts.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) params.set(`metadata[${k}]`, v);
  }
  let res: Response;
  try {
    res = await fetch(`${STRIPE}/payment_intents`, { method: "POST", headers: authHeaders(key), body: params.toString() });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) return { error: await stripeError(res) };
  const data = (await res.json()) as { client_secret?: string };
  if (!data.client_secret) return { error: "Stripe did not return a client secret." };
  return { clientSecret: data.client_secret, applicationFeeCents: fee };
}

async function stripeError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `Stripe error (${res.status}).`;
}
