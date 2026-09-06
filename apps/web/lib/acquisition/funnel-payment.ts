/**
 * The decision layer for a funnel's paid step. Given a funnel's payment config
 * and the platform/connect context, this decides — with no network — whether a
 * destination charge may proceed and with what AUTHORITATIVE amount. The public
 * pay route (app/api/q/[slug]/pay) turns an ok plan into a real PaymentIntent
 * via lib/stripe-connect; keeping this pure means the security-critical rules
 * (the visitor can never set their own price; a charge is refused unless the
 * business is actually connected, that connected account can actually accept
 * charges right now, and the platform is configured) are unit-tested without
 * Stripe keys or a live server.
 *
 * connectAccountId being set only means Connect onboarding STARTED (see
 * app/api/billing/connect/start) — never that Stripe has cleared the account
 * to accept charges. The caller is responsible for fetching the account's LIVE
 * status (lib/stripe-connect's getConnectedAccount + canAcceptPayments — the
 * same pair app/api/billing/connect/status already uses) and passing the
 * result in as ctx.accountReady; this module stays network-free.
 */
import { isPayable, type QualPaymentConfig } from "../studio/qualification-config";

/** OneVYRT's default cut of a funnel charge. Zero for now — a business keeps
 *  100% of what it collects; a future plan/setting can raise this and the fee
 *  math in lib/stripe-connect already clamps it safely. */
export const PLATFORM_FEE_PERCENT = 0;

export type PaymentPlan =
  | { ok: true; amountCents: number; currency: string; description: string; feePercent: number }
  | { ok: false; reason: "not_enabled" | "not_configured" | "no_account" | "account_not_ready" };

/**
 * Resolve whether — and how — a funnel's paid step can charge.
 *  - not_enabled: the funnel has no usable paid step (off, or price/currency bad).
 *  - not_configured: the platform has no Stripe key, so nothing can charge.
 *  - no_account: the owning workspace hasn't connected a payout account.
 *  - account_not_ready: a payout account exists but its LIVE Stripe status
 *    (ctx.accountReady) says it can't accept charges yet — still onboarding,
 *    or restricted pending verification. Distinct from no_account so callers
 *    can tell "never started" from "started but not cleared".
 * The amount and currency ALWAYS come from the server-side config, never a
 * caller-supplied value — that's the whole point of routing through here.
 */
export function resolveFunnelPayment(
  cfg: QualPaymentConfig | null | undefined,
  ctx: { platformConfigured: boolean; connectAccountId: string | null | undefined; accountReady: boolean },
): PaymentPlan {
  if (!isPayable(cfg)) return { ok: false, reason: "not_enabled" };
  if (!ctx.platformConfigured) return { ok: false, reason: "not_configured" };
  if (!ctx.connectAccountId) return { ok: false, reason: "no_account" };
  if (!ctx.accountReady) return { ok: false, reason: "account_not_ready" };
  const c = cfg as QualPaymentConfig;
  return {
    ok: true,
    amountCents: c.priceCents,
    currency: c.currency,
    description: c.description || c.label || "Payment",
    feePercent: PLATFORM_FEE_PERCENT,
  };
}
