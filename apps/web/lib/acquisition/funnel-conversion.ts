/**
 * Funnel paid-conversion attribution — the seam that makes a payment on a
 * public funnel's paid step show up as revenue in the owning workspace.
 *
 * The problem it closes: the funnel paid step (api/q/[slug]/pay) mints a
 * destination PaymentIntent directly — there's no Checkout Session — so it
 * fires `payment_intent.succeeded`, NOT `checkout.session.completed`. The
 * webhook only counted the latter and the PaymentIntent carried no workspace
 * metadata, so every funnel sale was invisible to the business that made it.
 *
 * The fix has two halves that meet here:
 *  1. The pay route stamps the PaymentIntent with metadata.source =
 *     FUNNEL_PAYMENT_SOURCE plus the workspaceId and funnelSlug.
 *  2. classifyStripeEvent recognises that stamped event and records it under a
 *     distinct synthesized type (FUNNEL_PAID_EVENT_TYPE) with the workspace
 *     attribution and amount pulled from the PaymentIntent shape.
 *
 * Recording funnel sales under their own type — rather than the raw
 * `payment_intent.succeeded` — is what keeps the conversion count honest: an
 * EXTERNAL Checkout produces both a checkout.session.completed AND a
 * payment_intent.succeeded for the same purchase, so counting the raw PI type
 * would double-count. A funnel sale only ever produces the synthesized type,
 * and an external sale only ever produces checkout.session.completed, so the
 * two conversion sources never overlap.
 *
 * Pure and dependency-free so it can be unit-tested without Stripe or a DB.
 */

/** Stamped on every funnel PaymentIntent's metadata so the webhook can tell a
 *  funnel sale apart from any other PaymentIntent that reaches the endpoint. */
export const FUNNEL_PAYMENT_SOURCE = "onevyrt_funnel";

/** The type a recognised funnel sale is stored under — deliberately not a real
 *  Stripe event type, so it can't collide with or double-count against the
 *  raw events Stripe also sends. */
export const FUNNEL_PAID_EVENT_TYPE = "onevyrt.funnel.paid";

/** Stripe's refund signal: a charge was (partly or fully) refunded. Recorded so
 *  the durable revenue ledger can net refunds out of collected revenue. */
export const REFUND_EVENT_TYPE = "charge.refunded";

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export interface ClassifiedStripeEvent {
  /** The type to persist — either the raw Stripe type, or the synthesized
   *  funnel type when this is a recognised funnel sale. */
  recordType: string;
  workspaceId?: string;
  amountTotal?: number;
  currency?: string;
  customerEmail?: string;
}

/**
 * Normalise a verified Stripe event object into what the events log stores.
 * Workspace attribution comes from client_reference_id (external Checkout) or
 * metadata.workspaceId (funnel PaymentIntent). A funnel-stamped
 * `payment_intent.succeeded` is re-typed to FUNNEL_PAID_EVENT_TYPE and its
 * amount read from the PaymentIntent shape (amount_received, then amount);
 * every other event keeps its type and reads amount_total.
 */
export function classifyStripeEvent(type: string, obj: Record<string, unknown>): ClassifiedStripeEvent {
  const md = obj.metadata as Record<string, unknown> | undefined;
  const workspaceId = str(obj.client_reference_id) ?? str(md?.workspaceId);
  const currency = str(obj.currency);
  const customerEmail = str(obj.customer_email) ?? str((obj.customer_details as Record<string, unknown> | undefined)?.email);

  if (type === "payment_intent.succeeded" && str(md?.source) === FUNNEL_PAYMENT_SOURCE) {
    const amount = num(obj.amount_received) ?? num(obj.amount);
    return {
      recordType: FUNNEL_PAID_EVENT_TYPE,
      ...(workspaceId ? { workspaceId } : {}),
      ...(amount != null ? { amountTotal: amount } : {}),
      ...(currency ? { currency } : {}),
      ...(customerEmail ? { customerEmail } : {}),
    };
  }

  // A refund. Stripe copies a PaymentIntent's metadata onto its Charge, so a
  // FUNNEL charge's refund still carries workspaceId + source here and nets out
  // correctly. A Charge object has no client_reference_id, so an EXTERNAL
  // Checkout refund only attributes if its PaymentIntent metadata carries
  // workspaceId; without it the refund is recorded but unattributed and won't
  // net out (the external sale's gross stays counted). amount is the charge's
  // cumulative amount_refunded. See revenueDeltaFor.
  if (type === REFUND_EVENT_TYPE) {
    const refunded = num(obj.amount_refunded);
    return {
      recordType: REFUND_EVENT_TYPE,
      ...(workspaceId ? { workspaceId } : {}),
      ...(refunded != null ? { amountTotal: refunded } : {}),
      ...(currency ? { currency } : {}),
      ...(customerEmail ? { customerEmail } : {}),
    };
  }

  // Stripe fires checkout.session.completed even for async/delayed payment
  // methods where the money hasn't actually arrived (payment_status "unpaid" or
  // "no_payment_required"). Only a "paid" session is real revenue — re-type the
  // rest so they're recorded but NOT counted as a completed sale.
  let recordType = type;
  if (type === "checkout.session.completed" && str(obj.payment_status) !== "paid") {
    recordType = "checkout.session.unpaid";
  }

  const amountTotal = num(obj.amount_total);
  return {
    recordType,
    ...(workspaceId ? { workspaceId } : {}),
    ...(amountTotal != null ? { amountTotal } : {}),
    ...(currency ? { currency } : {}),
    ...(customerEmail ? { customerEmail } : {}),
  };
}

/** A completed, revenue-bearing conversion for the workspace stats: an
 *  external Checkout completing, or a funnel paid step succeeding. */
export function isCompletedConversion(recordType: string): boolean {
  return recordType === "checkout.session.completed" || recordType === FUNNEL_PAID_EVENT_TYPE;
}

/** A refund event, netted OUT of collected revenue by the ledger. */
export function isRefund(recordType: string): boolean {
  return recordType === REFUND_EVENT_TYPE;
}

/** The signed contribution one NEWLY-RECORDED event makes to the durable
 *  revenue ledger, or null when it moves no money (unattributed, no/zero amount,
 *  or neither a completed sale nor a refund). Kept pure so the ledger math is
 *  unit-tested without a DB. Amounts are in the event's minor units (cents).
 *
 *  Note on refunds: `amountTotal` for a refund is the charge's CUMULATIVE
 *  amount_refunded. A single full/partial refund (the overwhelmingly common
 *  case) nets exactly once. A charge refunded in two separate partial steps
 *  would net the cumulative figure twice, over-stating refunds — which
 *  UNDER-states collected revenue, the safe direction for a money figure. */
export function revenueDeltaFor(e: { type: string; amountTotal?: number; currency?: string; workspaceId?: string }): RevenueDelta | null {
  if (!e.workspaceId || e.amountTotal == null || e.amountTotal <= 0) return null;
  const currency = (e.currency ?? "").toLowerCase();
  if (isCompletedConversion(e.type)) return { currency, grossCents: e.amountTotal, refundedCents: 0, saleCount: 1, refundCount: 0 };
  if (isRefund(e.type)) return { currency, grossCents: 0, refundedCents: e.amountTotal, saleCount: 0, refundCount: 1 };
  return null;
}

export interface RevenueDelta {
  currency: string;
  grossCents: number;
  refundedCents: number;
  saleCount: number;
  refundCount: number;
}

export interface CompletedSummary {
  /** Number of completed sales in the reported currency (see `currency`). */
  completedCount: number;
  /** Summed amount of those sales — a single currency's total, never a mix. */
  completedAmountTotal: number;
  /** The currency the count + total are reported in (Stripe's lowercase code),
   *  or null when there are no completed sales. */
  currency: string | null;
  /** True when completed sales span more than one currency — the caller is
   *  seeing only the dominant one, so the UI can note the rest exist rather than
   *  silently dropping them. */
  mixedCurrency: boolean;
  /** Total completed sales across ALL currencies (>= completedCount). */
  totalCompletedCount: number;
}

/**
 * Summarise completed conversions into a currency-consistent total.
 *
 * The bug this closes: the old aggregation summed `amountTotal` across every
 * completed event regardless of currency, so a workspace taking both USD and
 * EUR saw `100 + 100 = 200` as one meaningless number. Money in different
 * currencies can't be added. This groups by currency, reports the DOMINANT
 * currency (the one with the largest summed amount), and flags when others
 * exist — so the headline figure is always a real, single-currency amount.
 * Events with no currency are bucketed under the empty string.
 */
export function summarizeCompleted(events: { type: string; amountTotal?: number; currency?: string }[]): CompletedSummary {
  const byCurrency = new Map<string, { count: number; amount: number }>();
  let totalCompletedCount = 0;
  for (const e of events) {
    if (!isCompletedConversion(e.type)) continue;
    totalCompletedCount++;
    const cur = (e.currency ?? "").toLowerCase();
    const bucket = byCurrency.get(cur) ?? { count: 0, amount: 0 };
    bucket.count++;
    bucket.amount += e.amountTotal ?? 0;
    byCurrency.set(cur, bucket);
  }
  if (byCurrency.size === 0) {
    return { completedCount: 0, completedAmountTotal: 0, currency: null, mixedCurrency: false, totalCompletedCount: 0 };
  }
  // Dominant = largest summed amount; ties broken by count, then by having a
  // named currency over the unknown bucket, so a stray currency-less event
  // never hijacks the headline from a real currency.
  let dominant = "";
  let best = { count: -1, amount: -Infinity };
  for (const [cur, b] of byCurrency) {
    if (b.amount > best.amount || (b.amount === best.amount && b.count > best.count) || (b.amount === best.amount && b.count === best.count && cur !== "" && dominant === "")) {
      dominant = cur; best = { count: b.count, amount: b.amount };
    }
  }
  const d = byCurrency.get(dominant)!;
  return {
    completedCount: d.count,
    completedAmountTotal: d.amount,
    currency: dominant || null,
    mixedCurrency: byCurrency.size > 1,
    totalCompletedCount,
  };
}
