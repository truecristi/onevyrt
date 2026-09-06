/**
 * Referral program: a workspace that refers a new paying client earns 30%
 * of what THAT client pays, credited as a discount on the referrer's own
 * subscription — not a flat percentage of the referrer's own plan. Two
 * referrals paying different amounts contribute different-sized rewards;
 * they sum. Pure data + pure helpers — no Stripe, no storage; see
 * lib/referrals.ts for the store and price resolution, and
 * lib/stripe-billing.ts for turning a reward amount into a real
 * subscription discount (a fixed amount_off coupon, not percent_off,
 * since the reward is a currency amount, not a percentage).
 */
export type ReferralStatus = "pending" | "active" | "inactive";

export interface ReferralEntry {
  id: string;
  code: string;
  referrerWorkspaceId: string;
  referredWorkspaceId: string;
  referredUserId: string;
  status: ReferralStatus;
  createdAt: string;
  /** Set the moment the referred workspace first goes onto a paid plan —
   *  "brought a real client," not just "someone clicked a link." */
  qualifiedAt?: string;
  /** The referred workspace's paid-plan price as of the last sync, in
   *  minor currency units — what the 30% reward is computed from. Kept
   *  fresh on every sync (including a referred workspace upgrading or
   *  downgrading between paid tiers), not frozen at qualification time.
   *  Absent while status is "pending" — they aren't paying yet. */
  referredPlanPriceCents?: number;
  referredPlanCurrency?: string;
}

export const REFERRAL_REWARD_RATE = 0.30;

/** How many of a workspace's referrals currently count toward their
 *  reward — active only. Pending (not yet paying) and inactive (churned)
 *  referrals don't count. */
export function activeReferralCount(referrals: ReferralEntry[], referrerWorkspaceId: string): number {
  return referrals.filter((r) => r.referrerWorkspaceId === referrerWorkspaceId && r.status === "active").length;
}

/** 30% of what each active referral currently pays, summed. Referrals
 *  priced in a currency other than the first active one found are
 *  excluded from the sum rather than incorrectly combined — this app's
 *  plans are all one currency in practice, so this is a safety rail
 *  against bad data, not a real multi-currency conversion feature. */
export function referralRewardAmount(referrals: ReferralEntry[], referrerWorkspaceId: string): { amountCents: number; currency: string | null } {
  const active = referrals.filter((r) => r.referrerWorkspaceId === referrerWorkspaceId && r.status === "active" && r.referredPlanPriceCents != null);
  if (active.length === 0) return { amountCents: 0, currency: null };
  const currency = active[0].referredPlanCurrency ?? null;
  const amountCents = Math.round(
    active
      .filter((r) => !currency || r.referredPlanCurrency === currency)
      .reduce((sum, r) => sum + (r.referredPlanPriceCents ?? 0) * REFERRAL_REWARD_RATE, 0),
  );
  return { amountCents, currency };
}
