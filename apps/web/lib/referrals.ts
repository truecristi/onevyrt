/**
 * Referral program storage: a per-workspace referral code, and the
 * referral records it produces. Postgres-backed (see lib/db.ts): two
 * tables — referral_codes for code <-> workspace lookup, referrals for the
 * records themselves.
 *
 * A referral starts "pending" the moment someone registers through a
 * code, and only becomes "active" once that workspace goes onto a real
 * paid plan (see syncReferralQualification, called from the Stripe billing
 * webhook) — "brought a client," not "sent a link." It goes back to
 * "inactive" if that workspace later drops to free. The reward is 30% of
 * what the referred workspace actually pays (see engine/referrals.ts),
 * kept fresh on every sync — including a referred workspace upgrading or
 * downgrading between paid tiers, not just going paid/free — and pushed
 * to the referrer's live Stripe subscription automatically; see
 * syncReferralDiscount below.
 */
import { randomBytes } from "node:crypto";
import { getWorkspace } from "./workspaces";
import { billingConfigured, getActiveSubscription, applyReferralDiscount, priceIdForPlan, getPriceAmount } from "./stripe-billing";
import { pgPool } from "./db";
import { referralRewardAmount, type ReferralEntry, type ReferralStatus } from "@onevyrt/engine";

function generateCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

/** Every workspace gets exactly one permanent code, created on first ask. */
export async function getOrCreateReferralCode(workspaceId: string): Promise<string> {
  const pool = pgPool();
  const existing = await pool.query<{ code: string }>("SELECT code FROM referral_codes WHERE workspace_id = $1 LIMIT 1", [workspaceId]);
  if (existing.rows[0]) return existing.rows[0].code;
  // Collision retry loop — astronomically unlikely with a 40-bit code
  // space, but never silently overwrite one.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const inserted = await pool.query("INSERT INTO referral_codes (code, workspace_id) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING RETURNING code", [code, workspaceId]);
    if (inserted.rows[0]) return code;
  }
  throw new Error("Could not mint a unique referral code — try again.");
}

export async function resolveReferralCode(code: string): Promise<string | null> {
  const c = code.trim().toUpperCase();
  const res = await pgPool().query<{ workspace_id: string }>("SELECT workspace_id FROM referral_codes WHERE code = $1", [c]);
  return res.rows[0]?.workspace_id ?? null;
}

const MAX_REFERRALS_PER_WORKSPACE = 5000;

/** Records a pending referral at signup time. A no-op (not an error) if
 *  this exact referred workspace already has a referral on file, or if
 *  someone's code somehow resolves to their own new workspace — self-
 *  referral earns nothing. referred_workspace_id has a unique constraint,
 *  so a duplicate referral is rejected atomically by Postgres itself. */
export async function recordReferral(code: string, referredWorkspaceId: string, referredUserId: string): Promise<void> {
  const referrerWorkspaceId = await resolveReferralCode(code);
  if (!referrerWorkspaceId || referrerWorkspaceId === referredWorkspaceId) return;
  const pool = pgPool();
  const countRes = await pool.query("SELECT count(*) FROM referrals WHERE referrer_workspace_id = $1", [referrerWorkspaceId]);
  if (Number(countRes.rows[0].count) >= MAX_REFERRALS_PER_WORKSPACE) return;
  await pool.query(
    `INSERT INTO referrals (id, code, referrer_workspace_id, referred_workspace_id, referred_user_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6) ON CONFLICT (referred_workspace_id) DO NOTHING`,
    [randomBytes(8).toString("hex"), code.trim().toUpperCase(), referrerWorkspaceId, referredWorkspaceId, referredUserId, new Date().toISOString()],
  );
}

function rowToReferralEntry(row: {
  id: string; code: string; referrer_workspace_id: string; referred_workspace_id: string; referred_user_id: string;
  status: ReferralStatus; created_at: string; qualified_at: string | null; referred_plan_price_cents: number | null; referred_plan_currency: string | null;
}): ReferralEntry {
  return {
    id: row.id, code: row.code, referrerWorkspaceId: row.referrer_workspace_id, referredWorkspaceId: row.referred_workspace_id,
    referredUserId: row.referred_user_id, status: row.status, createdAt: row.created_at,
    ...(row.qualified_at ? { qualifiedAt: row.qualified_at } : {}),
    ...(row.referred_plan_price_cents != null ? { referredPlanPriceCents: row.referred_plan_price_cents } : {}),
    ...(row.referred_plan_currency ? { referredPlanCurrency: row.referred_plan_currency } : {}),
  };
}

export async function listReferralsForReferrer(referrerWorkspaceId: string): Promise<ReferralEntry[]> {
  const res = await pgPool().query(
    "SELECT * FROM referrals WHERE referrer_workspace_id = $1 ORDER BY created_at", [referrerWorkspaceId],
  );
  return res.rows.map(rowToReferralEntry);
}

/** What a workspace's current paid plan actually costs, straight from
 *  Stripe — null for free (nothing to reward) or if pricing can't be
 *  resolved (billing not configured, plan not self-serve, etc). */
async function resolveWorkspacePlanPrice(workspaceId: string): Promise<{ amountCents: number; currency: string } | null> {
  const ws = await getWorkspace(workspaceId);
  if (!ws?.plan || ws.plan === "free") return null;
  const priceId = priceIdForPlan(ws.plan);
  if (!priceId) return null;
  const price = await getPriceAmount(priceId);
  return "error" in price ? null : price;
}

/** Flips a referred workspace's referral (if any) to "active" the first
 *  time it goes paid, back to "inactive" if it drops to free, and — on
 *  every call, not just the first — refreshes the reward-relevant price
 *  snapshot so a referred workspace upgrading or downgrading between paid
 *  tiers changes the referrer's reward too, not just the free/paid edges.
 *  Returns the referrer workspace id if anything the reward depends on
 *  actually changed (so the caller knows whose Stripe discount needs
 *  re-syncing), else null. */
export async function syncReferralQualification(referredWorkspaceId: string, isPaid: boolean): Promise<string | null> {
  const pricing = isPaid ? await resolveWorkspacePlanPrice(referredWorkspaceId) : null;
  const pool = pgPool();
  const res = await pool.query("SELECT * FROM referrals WHERE referred_workspace_id = $1", [referredWorkspaceId]);
  const row = res.rows[0];
  if (!row) return null;
  const entry = rowToReferralEntry(row);
  const nextStatus: ReferralStatus = isPaid ? "active" : entry.status === "pending" ? "pending" : "inactive";
  const priceChanged = isPaid && !!pricing && (entry.referredPlanPriceCents !== pricing.amountCents || entry.referredPlanCurrency !== pricing.currency);
  if (nextStatus === entry.status && !priceChanged) return null;
  const qualifiedAt = nextStatus === "active" ? (entry.qualifiedAt ?? new Date().toISOString()) : entry.qualifiedAt ?? null;
  const priceCents = nextStatus === "active" && pricing ? pricing.amountCents : entry.referredPlanPriceCents ?? null;
  const currency = nextStatus === "active" && pricing ? pricing.currency : entry.referredPlanCurrency ?? null;
  await pool.query(
    "UPDATE referrals SET status = $2, qualified_at = $3, referred_plan_price_cents = $4, referred_plan_currency = $5 WHERE id = $1",
    [entry.id, nextStatus, qualifiedAt, priceCents, currency],
  );
  return entry.referrerWorkspaceId;
}

export async function referrerDiscountAmount(referrerWorkspaceId: string): Promise<{ amountCents: number; currency: string | null }> {
  const referrals = await listReferralsForReferrer(referrerWorkspaceId);
  return referralRewardAmount(referrals, referrerWorkspaceId);
}

/** Recomputes a referrer's earned reward and pushes it straight to their
 *  live Stripe subscription — called automatically from the billing
 *  webhook every time one of their referrals changes status or price, per
 *  the user's explicit choice for this to be live and unattended. A no-op
 *  (not an error) if Stripe isn't configured, or the referrer has no
 *  Stripe customer / no active subscription of their own yet — someone
 *  can rack up referral credit before they ever subscribe themselves, and
 *  it'll apply automatically the moment they do (see the webhook, which
 *  also calls this on a workspace's own subscription becoming active). */
export async function syncReferralDiscount(referrerWorkspaceId: string): Promise<void> {
  if (!billingConfigured()) return;
  const ws = await getWorkspace(referrerWorkspaceId);
  if (!ws?.stripeCustomerId) return;
  const subResult = await getActiveSubscription(ws.stripeCustomerId);
  if ("error" in subResult || !subResult.subscription) return;
  const { amountCents, currency } = await referrerDiscountAmount(referrerWorkspaceId);
  await applyReferralDiscount(subResult.subscription.id, amountCents, currency ?? "usd");
}
