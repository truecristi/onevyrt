/**
 * Workspaces (Ch.039): turn "my account" into "my team." A workspace owns a set
 * of projects and has members with roles. Postgres-backed (see lib/db.ts).
 * Every user gets a "Personal" workspace on first use. Roles: owner (full
 * control), editor (edit projects), viewer (read only).
 */
import { randomBytes } from "node:crypto";
import { deleteScope } from "./store";
import { pgPool } from "./db";
import { dispatchEvent } from "./webhooks";
import { removeWorkspacesFromCohortRosters } from "./cohorts";
import { deleteEnrollmentsForWorkspaces } from "./enrollments";
import { softDeleteLeadsAndBookingsForWorkspaces } from "./acquisition/leads";

export type Role = "owner" | "manager" | "editor" | "viewer";
export type Plan = "free" | "pro" | "business" | "performance";
export interface Member { userId: string; role: Role; }
export interface Workspace { id: string; name: string; ownerId: string; members: Member[]; createdAt: string; plan?: Plan; stripeCustomerId?: string; stripeConnectAccountId?: string; freeAccessMode?: boolean; }

const WORKSPACE_COLUMNS = "id, name, owner_id, members, created_at, plan, stripe_customer_id, stripe_connect_account_id, free_access_mode";

function rowToWorkspace(row: { id: string; name: string; owner_id: string; members: Member[]; created_at: Date; plan: string | null; stripe_customer_id: string | null; stripe_connect_account_id: string | null; free_access_mode: boolean }): Workspace {
  return {
    id: row.id, name: row.name, ownerId: row.owner_id, members: row.members, createdAt: row.created_at.toISOString(),
    ...(row.plan ? { plan: row.plan as Plan } : {}),
    ...(row.stripe_customer_id ? { stripeCustomerId: row.stripe_customer_id } : {}),
    ...(row.stripe_connect_account_id ? { stripeConnectAccountId: row.stripe_connect_account_id } : {}),
    ...(row.free_access_mode ? { freeAccessMode: row.free_access_mode } : {}),
  };
}

/**
 * Row-level replacement for the old "read the whole workspace table, mutate
 * in memory, write the whole table back" pattern every mutating function
 * here used to share under one in-process lock (see git history —
 * `withFileLock(WS_LOCK_KEY, ...)` around a full readAll()/writeAll() pair,
 * same shape lib/auth.ts had for users before that got the same treatment).
 * Opens a transaction, locks just the target row (`SELECT ... FOR UPDATE`),
 * and lets the caller inspect/mutate it with a targeted UPDATE before
 * COMMIT — real row-level locking, correct across any number of server
 * instances, one row touched per call instead of the whole table.
 */
async function withWorkspaceRowLock<T>(wsId: string, fn: (ws: Workspace, client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(`SELECT ${WORKSPACE_COLUMNS} FROM workspaces WHERE id = $1 FOR UPDATE`, [wsId]);
    const row = res.rows[0];
    if (!row) throw new Error("Workspace not found.");
    const result = await fn(rowToWorkspace(row), client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* connection may already be dead */ });
    throw e;
  } finally {
    client.release();
  }
}

/** Finds this user's "Personal" workspace, or creates it — the classic
 *  check-then-insert race, and there's no unique DB constraint on
 *  (owner_id, name) to lean on (see migrations/..._create-workspaces.js).
 *  A Postgres advisory lock scoped to just this user's id makes the
 *  check-and-create atomic against a concurrent call for the SAME user,
 *  without a table-wide lock and without a schema change. */
export async function ensurePersonalWorkspace(userId: string): Promise<Workspace> {
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [userId]);
    const existing = await client.query(`SELECT ${WORKSPACE_COLUMNS} FROM workspaces WHERE owner_id = $1 AND name = 'Personal' LIMIT 1`, [userId]);
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return rowToWorkspace(existing.rows[0]);
    }
    const ws: Workspace = { id: randomBytes(8).toString("hex"), name: "Personal", ownerId: userId, members: [{ userId, role: "owner" }], createdAt: new Date().toISOString(), plan: "free" };
    await client.query(
      "INSERT INTO workspaces (id, name, owner_id, members, created_at, plan) VALUES ($1, $2, $3, $4, $5, $6)",
      [ws.id, ws.name, ws.ownerId, JSON.stringify(ws.members), ws.createdAt, ws.plan],
    );
    await client.query("COMMIT");
    return ws;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* connection may already be dead */ });
    throw e;
  } finally {
    client.release();
  }
}

/** Thrown when an owner tries to create a second workspace with a name they
 *  already use — the route maps this to a 409 so the UI can explain rather
 *  than silently making a confusing duplicate (two "Space 2" in the switcher). */
export class DuplicateWorkspaceNameError extends Error {}

/** Thrown when an owner is at the per-user workspace cap. Route maps to 409. */
export class WorkspaceLimitError extends Error {}

/** Most workspaces one user may OWN. Bounds abuse where minting N workspaces
 *  multiplies per-workspace allowances (e.g. the managed-AI monthly quota);
 *  well above what any real solo owner or small team needs. */
export const MAX_OWNED_WORKSPACES = 10;

export async function createWorkspace(ownerId: string, name: string): Promise<Workspace> {
  const clean = name.trim() || "Untitled workspace";
  // Reject a same-named duplicate for this owner. There's no unique DB
  // constraint on (owner_id, name), so guard the check-then-insert with the
  // same per-user advisory xact lock ensurePersonalWorkspace uses — two
  // concurrent "New workspace" clicks (or a double-submit) can't both slip a
  // "Space 2" past the check. The same lock makes the workspace-count cap below
  // exact against a concurrent burst.
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [ownerId]);
    const owned = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM workspaces WHERE owner_id = $1", [ownerId],
    );
    if (Number(owned.rows[0]?.n ?? 0) >= MAX_OWNED_WORKSPACES) {
      throw new WorkspaceLimitError(`You've reached the limit of ${MAX_OWNED_WORKSPACES} workspaces.`);
    }
    const dup = await client.query(
      "SELECT 1 FROM workspaces WHERE owner_id = $1 AND lower(name) = lower($2) LIMIT 1",
      [ownerId, clean],
    );
    if (dup.rows[0]) {
      // Nothing written yet — let the catch ROLLBACK release the lock cleanly.
      throw new DuplicateWorkspaceNameError(`You already have a workspace called "${clean}".`);
    }
    const ws: Workspace = { id: randomBytes(8).toString("hex"), name: clean, ownerId, members: [{ userId: ownerId, role: "owner" }], createdAt: new Date().toISOString(), plan: "free" };
    await client.query(
      "INSERT INTO workspaces (id, name, owner_id, members, created_at, plan) VALUES ($1, $2, $3, $4, $5, $6)",
      [ws.id, ws.name, ws.ownerId, JSON.stringify(ws.members), ws.createdAt, ws.plan],
    );
    await client.query("COMMIT");
    return ws;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* connection may already be dead */ });
    throw e;
  } finally {
    client.release();
  }
}
/** Every workspace this user belongs to (owner or member — the owner is
 *  always also present in `members`, see createWorkspace/ensurePersonalWorkspace
 *  above), oldest first. Uses the jsonb containment operator `@>` so the GIN
 *  index on members (migration 1786630900000) serves this instead of a
 *  full-table scan — membership is checked on nearly every request. */
export async function listForUser(userId: string): Promise<Workspace[]> {
  const res = await pgPool().query(
    `SELECT ${WORKSPACE_COLUMNS} FROM workspaces
     WHERE members @> $1::jsonb
     ORDER BY created_at ASC`,
    [JSON.stringify([{ userId }])],
  );
  return res.rows.map(rowToWorkspace);
}
/** Every workspace on the instance. Admin-only surface (see lib/admin) — a
 *  genuine "list everything" read, unlike the old readAll() this replaces,
 *  which every single mutation also paid the cost of. */
export async function listAllWorkspaces(): Promise<Workspace[]> {
  const res = await pgPool().query(`SELECT ${WORKSPACE_COLUMNS} FROM workspaces ORDER BY created_at ASC`);
  return res.rows.map(rowToWorkspace);
}
export async function getWorkspace(id: string): Promise<Workspace | null> {
  const res = await pgPool().query(`SELECT ${WORKSPACE_COLUMNS} FROM workspaces WHERE id = $1`, [id]);
  return res.rows[0] ? rowToWorkspace(res.rows[0]) : null;
}
export async function roleOf(wsId: string, userId: string): Promise<Role | null> {
  const ws = await getWorkspace(wsId);
  return ws?.members.find((m) => m.userId === userId)?.role ?? null;
}
/** Owner or manager: everything short of ownership transfer / workspace deletion. */
function canManage(ws: Workspace, actingUserId: string): boolean {
  if (ws.ownerId === actingUserId) return true;
  return ws.members.find((m) => m.userId === actingUserId)?.role === "manager";
}
/** Owner or manager: rename a workspace. */
export async function renameWorkspace(wsId: string, actingUserId: string, name: string): Promise<Workspace> {
  const clean = name.trim();
  if (!clean) throw new Error("Workspace name can't be empty.");
  return withWorkspaceRowLock(wsId, async (ws, client) => {
    if (!canManage(ws, actingUserId)) throw new Error("Only the workspace owner or a manager can rename it.");
    await client.query("UPDATE workspaces SET name = $2 WHERE id = $1", [wsId, clean]);
    return { ...ws, name: clean };
  });
}
/** Plans limited to a single profile (just the owner) — team members require
 *  Business or above. Free is single-seat too since it has no real projects
 *  to share anyway; this only matters if someone calls the API directly. */
const SINGLE_SEAT_PLANS = new Set<Plan>(["free", "pro"]);

/** Owner or manager: add or update a member's role. Owner role cannot be reassigned away here.
 *  bypassSeatLimit is set only by the API route when the acting user is an
 *  instance super-admin — see lib/admin — never derived here. */
export async function addMember(wsId: string, actingUserId: string, targetUserId: string, role: Role, bypassSeatLimit = false): Promise<Workspace> {
  let addedRole: Role | null = null;
  const result = await withWorkspaceRowLock(wsId, async (ws, client) => {
    if (!canManage(ws, actingUserId) && !bypassSeatLimit) throw new Error("Only the workspace owner or a manager can manage members.");
    // Enforced here, not just in the API route that happens to be the only
    // current caller — a manager appointing a peer manager is a near-ownership
    // act (managers can do "everything short of ownership transfer"), so this
    // invariant belongs at the trust boundary that actually mutates the data,
    // not bolted onto one HTTP handler that a future caller could bypass.
    if (role === "manager" && ws.ownerId !== actingUserId && !bypassSeatLimit) throw new Error("Only the workspace owner can appoint a manager.");
    if (targetUserId === ws.ownerId) throw new Error("The owner is already a member.");
    const existing = ws.members.find((m) => m.userId === targetUserId);
    if (!existing && SINGLE_SEAT_PLANS.has(ws.plan ?? "free") && !bypassSeatLimit) {
      throw new Error((ws.plan ?? "free") === "pro"
        ? "Pro is a single-profile plan — upgrade to Business to add teammates."
        : "The free plan is a single-profile demo — upgrade to Business to add teammates.");
    }
    const nextRole = role === "owner" ? "editor" : role;
    const wasNewMember = !existing;
    const members = existing
      ? ws.members.map((m) => (m.userId === targetUserId ? { ...m, role: nextRole } : m))
      : [...ws.members, { userId: targetUserId, role: nextRole }];
    await client.query("UPDATE workspaces SET members = $2 WHERE id = $1", [wsId, JSON.stringify(members)]);
    if (wasNewMember) addedRole = nextRole;
    return { ...ws, members };
  });
  // Fire the (best-effort) webhook only AFTER the row-lock connection is
  // released: dispatchEvent checks out its own pool connection, and doing that
  // while still holding the lock connection doubles each call's connection
  // demand — a burst of concurrent member changes on one workspace would
  // otherwise starve the pool and time out (see db.ts withAdvisoryLock note).
  if (addedRole) void dispatchEvent(wsId, "workspace.member_added", { userId: targetUserId, role: addedRole });
  return result;
}
/** Owner or manager: remove a member. Refuses to remove the owner (reassign first, admin-only).
 *  A manager can remove editors/viewers but not another manager — without
 *  this, any two managers could unilaterally evict each other with no owner
 *  involvement, which is a peer-escalation path well past "manage projects." */
export async function removeMember(wsId: string, actingUserId: string, targetUserId: string): Promise<Workspace> {
  const result = await withWorkspaceRowLock(wsId, async (ws, client) => {
    if (!canManage(ws, actingUserId)) throw new Error("Only the workspace owner or a manager can remove members.");
    if (targetUserId === ws.ownerId) throw new Error("The owner can't be removed.");
    const targetRole = ws.members.find((m) => m.userId === targetUserId)?.role;
    if (targetRole === "manager" && ws.ownerId !== actingUserId) throw new Error("Only the workspace owner can remove a manager.");
    const members = ws.members.filter((m) => m.userId !== targetUserId);
    await client.query("UPDATE workspaces SET members = $2 WHERE id = $1", [wsId, JSON.stringify(members)]);
    return { ...ws, members };
  });
  // Dispatch after releasing the lock connection — see addMember above.
  void dispatchEvent(wsId, "workspace.member_removed", { userId: targetUserId });
  return result;
}

// --- Admin-privileged operations below. These bypass the ownerId checks the
// functions above enforce — the caller (an /api/admin/* route) has already
// verified the actor is an instance admin via lib/admin's allowlist, which is
// a different, higher authority than "owns this one workspace." ---

/**
 * Removes a workspace and every project it owns. Irreversible: the caller
 * must have already gated this behind explicit confirmation.
 *
 * Also runs the workspace-scoped slice of the GDPR/right-to-erasure cascade —
 * everything else in the app that's keyed by this workspace_id and would
 * otherwise be orphaned by a workspace disappearing: it's dropped from every
 * cohort roster, its enrollment blob and add-on entitlements are removed, and
 * its captured leads/bookings/lead-activity-events are soft-deleted (NOT
 * hard-deleted — they stay recoverable in the bin for the same retention
 * window as everything else soft-deleted, see lib/acquisition/leads.ts and
 * the daily purge_deleted_leads job in lib/jobs.ts). This is the single place
 * that cascade lives: lib/auth.ts purgeUser deletes each workspace a user
 * owns through this same function (see its own loop), so both the direct
 * admin single-workspace delete (DELETE /api/admin/workspaces/[id]) and
 * account deletion (self-service + admin) get it. The one cascade step NOT
 * here is deleting the deleted user's own cohorts (keyed by coach_user_id,
 * not by any workspace) — that's account-scoped, not workspace-scoped, so it
 * lives in purgeUser directly.
 *
 * Every step below is idempotent and scoped to wsId alone, so re-running this
 * cascade (e.g. a retried request after a partial failure) is a safe no-op
 * past whatever already completed.
 */
export async function adminDeleteWorkspace(wsId: string): Promise<Workspace> {
  const res = await pgPool().query(`DELETE FROM workspaces WHERE id = $1 RETURNING ${WORKSPACE_COLUMNS}`, [wsId]);
  const row = res.rows[0];
  if (!row) throw new Error("Workspace not found.");
  const ws = rowToWorkspace(row);
  await deleteScope(wsId);
  await removeWorkspacesFromCohortRosters([wsId]);
  await deleteEnrollmentsForWorkspaces([wsId]);
  await pgPool().query("DELETE FROM workspace_entitlements WHERE workspace_id = $1", [wsId]);
  await softDeleteLeadsAndBookingsForWorkspaces([wsId]);
  return ws;
}

/** Hands ownership to an existing member (or adds them as one). The previous
 *  owner keeps their access, just demoted to editor rather than removed —
 *  transferring a workspace shouldn't also evict the person who built it. */
export async function adminReassignOwner(wsId: string, newOwnerUserId: string): Promise<Workspace> {
  return withWorkspaceRowLock(wsId, async (ws, client) => {
    if (ws.ownerId === newOwnerUserId) return ws;
    const prevOwnerId = ws.ownerId;
    let members = ws.members.map((m) => (m.userId === prevOwnerId ? { ...m, role: "editor" as Role } : m));
    members = members.some((m) => m.userId === newOwnerUserId)
      ? members.map((m) => (m.userId === newOwnerUserId ? { ...m, role: "owner" as Role } : m))
      : [...members, { userId: newOwnerUserId, role: "owner" as Role }];
    await client.query("UPDATE workspaces SET owner_id = $2, members = $3 WHERE id = $1", [wsId, newOwnerUserId, JSON.stringify(members)]);
    return { ...ws, ownerId: newOwnerUserId, members };
  });
}

/** Removes a member. Refuses to remove the current owner — reassign first. */
export async function adminRemoveMember(wsId: string, targetUserId: string): Promise<Workspace> {
  return withWorkspaceRowLock(wsId, async (ws, client) => {
    if (ws.ownerId === targetUserId) throw new Error("Reassign ownership before removing the owner.");
    const members = ws.members.filter((m) => m.userId !== targetUserId);
    await client.query("UPDATE workspaces SET members = $2 WHERE id = $1", [wsId, JSON.stringify(members)]);
    return { ...ws, members };
  });
}

/** Sets the subscription tier recorded against a workspace. This function
 *  itself never charges anyone — it's just the state label. The actual
 *  charge (when billing is configured) happens in Stripe Checkout; this is
 *  called from the billing webhook once Stripe confirms a real payment, or
 *  by an admin correcting the record by hand. */
export async function adminSetPlan(wsId: string, plan: Plan): Promise<Workspace> {
  const res = await pgPool().query(`UPDATE workspaces SET plan = $2 WHERE id = $1 RETURNING ${WORKSPACE_COLUMNS}`, [wsId, plan]);
  const row = res.rows[0];
  if (!row) throw new Error("Workspace not found.");
  return rowToWorkspace(row);
}

/** Records the Stripe Customer id a workspace's subscription belongs to —
 *  set once from the billing webhook after a successful checkout, and used
 *  afterward to open that customer's Stripe-hosted billing portal (invoices,
 *  payment method, cancellation) without this app ever touching card data. */
export async function setWorkspaceStripeCustomer(wsId: string, stripeCustomerId: string): Promise<Workspace> {
  const res = await pgPool().query(`UPDATE workspaces SET stripe_customer_id = $2 WHERE id = $1 RETURNING ${WORKSPACE_COLUMNS}`, [wsId, stripeCustomerId]);
  const row = res.rows[0];
  if (!row) throw new Error("Workspace not found.");
  return rowToWorkspace(row);
}

/** Stores the Stripe Connect account id a workspace uses to collect payments
 *  from its own customers. Only the account id is kept — never card data. */
export async function setWorkspaceStripeConnectAccount(wsId: string, accountId: string): Promise<Workspace> {
  const res = await pgPool().query(`UPDATE workspaces SET stripe_connect_account_id = $2 WHERE id = $1 RETURNING ${WORKSPACE_COLUMNS}`, [wsId, accountId]);
  const row = res.rows[0];
  if (!row) throw new Error("Workspace not found.");
  return rowToWorkspace(row);
}

/** Members of a workspace with their email, for assignee pickers and the like.
 *  One query joins the workspace's member ids to the users table; a member
 *  whose user row is gone (shouldn't happen) is dropped rather than shown blank. */
export async function listWorkspaceMemberSummaries(wsId: string): Promise<{ userId: string; email: string; role: Role }[]> {
  const ws = await getWorkspace(wsId);
  if (!ws) return [];
  const ids = ws.members.map((m) => m.userId);
  if (!ids.length) return [];
  const res = await pgPool().query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE id = ANY($1)",
    [ids],
  );
  const emailById = new Map(res.rows.map((r) => [r.id, r.email]));
  return ws.members
    .filter((m) => emailById.has(m.userId))
    .map((m) => ({ userId: m.userId, email: emailById.get(m.userId)!, role: m.role }));
}

/** Sets free-access mode for a workspace (admin-only). When enabled, all lessons
 *  and chapters are unlocked, gating is bypassed, and submissions are auto-approved. */
export async function adminSetFreeAccessMode(wsId: string, enabled: boolean): Promise<Workspace> {
  const res = await pgPool().query(`UPDATE workspaces SET free_access_mode = $2 WHERE id = $1 RETURNING ${WORKSPACE_COLUMNS}`, [wsId, enabled]);
  const row = res.rows[0];
  if (!row) throw new Error("Workspace not found.");
  return rowToWorkspace(row);
}
