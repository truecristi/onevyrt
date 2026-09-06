import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as referrals from "../lib/referrals";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("referrals-test");
const ws = (n: string) => `${PREFIX}-ws-${n}`;

after(async () => {
  const pool = pgPool();
  await pool.query("DELETE FROM referral_codes WHERE workspace_id LIKE $1", [`${PREFIX}%`]);
  await pool.query("DELETE FROM referrals WHERE referrer_workspace_id LIKE $1 OR referred_workspace_id LIKE $1", [`${PREFIX}%`]);
});

// syncReferralQualification resolves the referred workspace's real price
// via Stripe, which isn't configured in this test env — so it correctly
// leaves referredPlanPriceCents unset. Tests that need a priced, active
// referral write it directly into the store, the same way
// enrollments.test.ts pre-seeds state its public API can't produce alone.
async function setReferralPricing(referralId: string, amountCents: number, currency: string): Promise<void> {
  await pgPool().query(
    "UPDATE referrals SET referred_plan_price_cents = $2, referred_plan_currency = $3 WHERE id = $1",
    [referralId, amountCents, currency],
  );
}

test("getOrCreateReferralCode: is idempotent — the same workspace always gets the same code back", async () => {
  const workspaceId = ws("1");
  const first = await referrals.getOrCreateReferralCode(workspaceId);
  const second = await referrals.getOrCreateReferralCode(workspaceId);
  assert.equal(first, second);
});

test("resolveReferralCode: resolves a real code case-insensitively, null for an unknown one", async () => {
  const workspaceId = ws("2");
  const code = await referrals.getOrCreateReferralCode(workspaceId);
  assert.equal(await referrals.resolveReferralCode(code.toLowerCase()), workspaceId);
  assert.equal(await referrals.resolveReferralCode("not-a-real-code"), null);
});

test("recordReferral: creates a pending referral for a real code", async () => {
  const referrer = ws("3-referrer"), referred = ws("3-referred");
  const code = await referrals.getOrCreateReferralCode(referrer);
  await referrals.recordReferral(code, referred, "u-referred");
  const list = await referrals.listReferralsForReferrer(referrer);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.status, "pending");
  assert.equal(list[0]!.referredWorkspaceId, referred);
});

test("recordReferral: an unknown code is silently ignored, not an error", async () => {
  const referrer = ws("4-referrer");
  await referrals.recordReferral("BOGUSCODE", ws("4-referred"), "u-referred");
  const list = await referrals.listReferralsForReferrer(referrer);
  assert.equal(list.length, 0);
});

test("recordReferral: a workspace can't earn credit for referring itself", async () => {
  const workspaceId = ws("5");
  const code = await referrals.getOrCreateReferralCode(workspaceId);
  await referrals.recordReferral(code, workspaceId, "u1");
  const list = await referrals.listReferralsForReferrer(workspaceId);
  assert.equal(list.length, 0);
});

test("recordReferral: recording the same referred workspace twice doesn't duplicate the referral", async () => {
  const referrer = ws("6-referrer"), referred = ws("6-referred");
  const code = await referrals.getOrCreateReferralCode(referrer);
  await referrals.recordReferral(code, referred, "u-referred");
  await referrals.recordReferral(code, referred, "u-referred");
  const list = await referrals.listReferralsForReferrer(referrer);
  assert.equal(list.length, 1);
});

test("syncReferralQualification: going paid flips pending to active and returns the referrer id", async () => {
  const referrer = ws("7-referrer"), referred = ws("7-referred");
  const code = await referrals.getOrCreateReferralCode(referrer);
  await referrals.recordReferral(code, referred, "u-referred");
  const changed = await referrals.syncReferralQualification(referred, true);
  assert.equal(changed, referrer);
  const list = await referrals.listReferralsForReferrer(referrer);
  assert.equal(list[0]!.status, "active");
  assert.ok(list[0]!.qualifiedAt);
});

test("syncReferralQualification: dropping back to free flips active to inactive", async () => {
  const referrer = ws("8-referrer"), referred = ws("8-referred");
  const code = await referrals.getOrCreateReferralCode(referrer);
  await referrals.recordReferral(code, referred, "u-referred");
  await referrals.syncReferralQualification(referred, true);
  const changed = await referrals.syncReferralQualification(referred, false);
  assert.equal(changed, referrer);
  const list = await referrals.listReferralsForReferrer(referrer);
  assert.equal(list[0]!.status, "inactive");
});

test("syncReferralQualification: no-op (returns null) when nothing actually changed, or no referral exists", async () => {
  const referrer = ws("9-referrer"), referred = ws("9-referred");
  assert.equal(await referrals.syncReferralQualification(ws("9-none"), true), null);
  const code = await referrals.getOrCreateReferralCode(referrer);
  await referrals.recordReferral(code, referred, "u-referred");
  assert.equal(await referrals.syncReferralQualification(referred, false), null, "already pending/not-paid — flipping to not-paid again changes nothing");
});

test("referrerDiscountAmount: 30% of what the referral pays, summed across multiple active referrals, ignoring pending/inactive ones", async () => {
  const referrer = ws("10-referrer");
  const a = ws("10-a"), b = ws("10-b"), c = ws("10-c");
  const code = await referrals.getOrCreateReferralCode(referrer);
  await referrals.recordReferral(code, a, "u-a");
  await referrals.recordReferral(code, b, "u-b");
  await referrals.recordReferral(code, c, "u-c");
  await referrals.syncReferralQualification(a, true);
  await referrals.syncReferralQualification(b, true);
  // c stays pending
  const list = await referrals.listReferralsForReferrer(referrer);
  const aEntry = list.find((r) => r.referredWorkspaceId === a)!;
  const bEntry = list.find((r) => r.referredWorkspaceId === b)!;
  await setReferralPricing(aEntry.id, 4900, "usd");  // $49/mo -> $14.70 reward
  await setReferralPricing(bEntry.id, 14900, "usd"); // $149/mo -> $44.70 reward
  const result = await referrals.referrerDiscountAmount(referrer);
  assert.equal(result.amountCents, 5940);
  assert.equal(result.currency, "usd");
});

// Same read-modify-write shape as every other store in this app.
test("recordReferral: concurrent signups through the same code don't lose any referrals", async () => {
  const referrer = ws("11-referrer");
  const code = await referrals.getOrCreateReferralCode(referrer);
  const COUNT = 30;
  await Promise.all(Array.from({ length: COUNT }, (_, i) => referrals.recordReferral(code, ws(`11-referred-${i}`), `u-${i}`)));
  const list = await referrals.listReferralsForReferrer(referrer);
  assert.equal(list.length, COUNT, "some concurrent referral records were lost to a write race");
});
