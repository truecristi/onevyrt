/**
 * Campaign Studio foundation, part 1 (runtime side): add-on entitlements.
 * Two sources, checked together — keep them distinct when adding a new
 * paid module:
 *   - PLAN-INCLUDED: listed in PLAN_INCLUDED below (e.g. the "performance"
 *     plan includes campaign_studio for free, no separate purchase) —
 *     computed from workspaces.plan at read time, never stored, so there's
 *     no way for this to drift out of sync with the plan itself.
 *   - ADD-ON: an explicit row in workspace_entitlements, granted once a
 *     workspace subscribes to that module specifically (see the billing
 *     webhook once the add-on checkout exists).
 */
import { pgPool } from "./db";
import { getWorkspace, type Plan } from "./workspaces";
import { isAdminEmail } from "./admin";

export type Entitlement = "campaign_studio";

const PLAN_INCLUDED: Record<Entitlement, Plan[]> = {
  campaign_studio: ["performance"],
};

export interface EntitlementRow {
  entitlement: Entitlement;
  status: "active" | "canceled";
  source: "plan" | "addon";
  grantedAt: string;
}

/** True if this workspace can use `entitlement` right now, whether that's
 *  because their plan includes it or because they bought it separately. */
export async function hasEntitlement(workspaceId: string, entitlement: Entitlement): Promise<boolean> {
  const ws = await getWorkspace(workspaceId);
  if (ws && PLAN_INCLUDED[entitlement]?.includes(ws.plan ?? "free")) return true;
  const res = await pgPool().query(
    "SELECT 1 FROM workspace_entitlements WHERE workspace_id = $1 AND entitlement = $2 AND status = 'active'",
    [workspaceId, entitlement],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Every entitlement this workspace currently has, from either source — for
 *  a settings/billing screen to show what's active and why. */
export async function listEntitlements(workspaceId: string): Promise<EntitlementRow[]> {
  const ws = await getWorkspace(workspaceId);
  const out: EntitlementRow[] = [];
  const seen = new Set<Entitlement>();
  if (ws) {
    for (const [ent, plans] of Object.entries(PLAN_INCLUDED) as [Entitlement, Plan[]][]) {
      if (plans.includes(ws.plan ?? "free")) {
        out.push({ entitlement: ent, status: "active", source: "plan", grantedAt: ws.createdAt });
        seen.add(ent);
      }
    }
  }
  const res = await pgPool().query<{ entitlement: Entitlement; status: string; granted_at: Date }>(
    "SELECT entitlement, status, granted_at FROM workspace_entitlements WHERE workspace_id = $1 AND status = 'active'",
    [workspaceId],
  );
  for (const row of res.rows) {
    if (seen.has(row.entitlement)) continue; // plan already covers it — don't show a redundant addon row
    out.push({ entitlement: row.entitlement, status: "active", source: "addon", grantedAt: row.granted_at.toISOString() });
  }
  return out;
}

/** Grants an add-on entitlement — called from the billing webhook once a
 *  workspace subscribes to this module specifically, or by an admin
 *  correcting the record by hand. Idempotent: re-granting an already-active
 *  entitlement is a harmless no-op. */
export async function grantEntitlement(workspaceId: string, entitlement: Entitlement, stripeSubscriptionItemId?: string): Promise<void> {
  const now = new Date().toISOString();
  await pgPool().query(
    `INSERT INTO workspace_entitlements (workspace_id, entitlement, status, stripe_subscription_item_id, granted_at, updated_at)
     VALUES ($1, $2, 'active', $3, $4, $4)
     ON CONFLICT (workspace_id, entitlement) DO UPDATE SET
       status = 'active', stripe_subscription_item_id = EXCLUDED.stripe_subscription_item_id, updated_at = EXCLUDED.updated_at`,
    [workspaceId, entitlement, stripeSubscriptionItemId ?? null, now],
  );
}

/**
 * Server-side mirror of the client's isFreePlan/isOverSeatQuota gate
 * (funnel-studio.tsx) — the ONLY place that restriction was previously
 * enforced. Without this, POSTing straight to /api/projects bypassed the
 * paywall entirely: a free-plan workspace could create and save unlimited
 * real, persisted projects (the thing the UI's own upgrade copy says Free
 * excludes — "the free plan doesn't include your own projects"), and a
 * workspace over its downgraded plan's seat quota kept full write access via
 * the API even though the UI marks everyone but the owner read-only there.
 * Mirrors the client logic exactly; an instance admin always passes, same as
 * the client's `!user.superAdmin` guard.
 */
export async function canWriteProjects(workspaceId: string, userId: string, userEmail: string): Promise<boolean> {
  if (isAdminEmail(userEmail)) return true;
  const ws = await getWorkspace(workspaceId);
  if (!ws) return false;
  const plan = ws.plan ?? "free";
  if (plan === "free") return false;
  const isOverSeatQuota = plan !== "business" && plan !== "performance" && ws.members.length > 1 && ws.ownerId !== userId;
  return !isOverSeatQuota;
}

/** Revokes an add-on entitlement (e.g. on cancellation). Leaves the row in
 *  place with status='canceled' rather than deleting it, so "when did this
 *  end" stays answerable. Never affects a plan-included entitlement — those
 *  aren't stored here, they follow the plan automatically. */
export async function revokeEntitlement(workspaceId: string, entitlement: Entitlement): Promise<void> {
  await pgPool().query(
    "UPDATE workspace_entitlements SET status = 'canceled', updated_at = $3 WHERE workspace_id = $1 AND entitlement = $2",
    [workspaceId, entitlement, new Date().toISOString()],
  );
}
