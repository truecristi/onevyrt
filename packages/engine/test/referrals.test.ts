import test from "node:test";
import assert from "node:assert/strict";
import { activeReferralCount, referralRewardAmount, type ReferralEntry } from "../src/referrals.ts";

function referral(over: Partial<ReferralEntry>): ReferralEntry {
  return {
    id: "r1", code: "ABC123", referrerWorkspaceId: "ws-referrer", referredWorkspaceId: "ws-referred",
    referredUserId: "u1", status: "active", createdAt: "2026-01-01T00:00:00.000Z",
    referredPlanPriceCents: 4900, referredPlanCurrency: "usd", ...over,
  };
}

test("activeReferralCount: only counts active referrals for the given referrer", () => {
  const list = [
    referral({ id: "1", status: "active" }),
    referral({ id: "2", status: "pending" }),
    referral({ id: "3", status: "inactive" }),
    referral({ id: "4", status: "active", referrerWorkspaceId: "someone-else" }),
  ];
  assert.equal(activeReferralCount(list, "ws-referrer"), 1);
});

test("referralRewardAmount: 30% of what the referral pays, not a percentage of the referrer's own plan", () => {
  const list = [referral({ referredPlanPriceCents: 4900 })]; // $49/mo referral
  assert.equal(referralRewardAmount(list, "ws-referrer").amountCents, 1470); // 30% of $49 = $14.70
});

test("referralRewardAmount: sums across multiple active referrals paying different amounts", () => {
  const list = [
    referral({ id: "1", referredPlanPriceCents: 4900 }),  // $14.70
    referral({ id: "2", referredPlanPriceCents: 14900 }), // $44.70
  ];
  assert.equal(referralRewardAmount(list, "ws-referrer").amountCents, 5940);
  assert.equal(referralRewardAmount(list, "ws-referrer").currency, "usd");
});

test("referralRewardAmount: pending and inactive referrals don't contribute", () => {
  const list = [
    referral({ id: "1", status: "pending", referredPlanPriceCents: undefined, referredPlanCurrency: undefined }),
    referral({ id: "2", status: "inactive" }),
  ];
  assert.deepEqual(referralRewardAmount(list, "ws-referrer"), { amountCents: 0, currency: null });
});

test("referralRewardAmount: a referral in a different currency than the first one found is excluded, not mixed in", () => {
  const list = [
    referral({ id: "1", referredPlanPriceCents: 4900, referredPlanCurrency: "usd" }),
    referral({ id: "2", referredPlanPriceCents: 4900, referredPlanCurrency: "gbp" }),
  ];
  const result = referralRewardAmount(list, "ws-referrer");
  assert.equal(result.currency, "usd");
  assert.equal(result.amountCents, 1470); // only the usd one counted
});

test("referralRewardAmount: no active referrals at all returns zero with a null currency", () => {
  assert.deepEqual(referralRewardAmount([], "ws-referrer"), { amountCents: 0, currency: null });
});
