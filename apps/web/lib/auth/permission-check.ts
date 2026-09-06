/**
 * RBAC permission checks (Wave 2 Lane 2 foundation). Pure authorization
 * logic — no Request/Response types here, so it's usable from a route, a
 * job, or a test with nothing to fake. lib/middleware/workspace-scope.ts is
 * the HTTP-shaped layer on top of this for API routes; this module is the
 * decision itself.
 *
 * Roles (see lib/workspaces.ts) rank owner > manager > editor > viewer,
 * matching the informal rule already enforced ad hoc there (e.g. "manager:
 * everything short of ownership transfer") — canManage there is one
 * hardcoded slice of the same ordering `roleMeets` below makes general and
 * reusable.
 */
import { pgPool } from "../db";
import { roleOf, type Role } from "../workspaces";

const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, manager: 3, owner: 4 };

/** True if `role` is at or above `required` in owner > manager > editor >
 *  viewer — e.g. roleMeets("manager", "editor") is true (a manager can do
 *  anything an editor can), roleMeets("viewer", "editor") is false. */
export function roleMeets(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/**
 * True if `userId` belongs to `workspaceId` and — when `requiredRole` is
 * given — their role is at or above it. With no `requiredRole`, this is
 * purely a membership check (any role passes). Never throws; a workspace
 * that doesn't exist or a user who isn't a member both resolve to `false`
 * (roleOf returns null for either — see lib/workspaces.ts).
 */
export async function canUserAccessWorkspace(userId: string, workspaceId: string, requiredRole?: Role): Promise<boolean> {
  const role = await roleOf(workspaceId, userId);
  if (!role) return false;
  return requiredRole ? roleMeets(role, requiredRole) : true;
}

/**
 * Resource types `canUserAccess` can resolve to their one owning workspace
 * with a single lookup — every entry here is a table whose `id` is
 * GLOBALLY unique and carries a plain `workspace_id` column (see the
 * migrations under apps/web/migrations for each: campaigns, leads,
 * bookings, segments, broadcasts, creatives).
 *
 * Deliberately NOT included, and why a generic id-only lookup can't cover
 * them:
 *   - "project": primary key is (scope_key, id) — id is unique only WITHIN
 *     a workspace (lib/store.ts), so the same id can legitimately exist in
 *     several workspaces at once. A bare project id does not resolve to a
 *     single workspace at all. Every app/api/projects/* route already
 *     handles this correctly by resolving the workspace first (from a `ws`
 *     query param or the caller's personal workspace) and calling
 *     canUserAccessWorkspace(userId, workspaceId, role) directly — do the
 *     same rather than routing a project id through this function.
 *   - "cohort": member_workspace_ids is many-to-many (one cohort can hold
 *     several workspaces' learners) — there is no single owning workspace
 *     to resolve to.
 *   - "enrollment": keyed BY workspace_id (it IS the id), not a separate
 *     resource id — call canUserAccessWorkspace directly.
 */
const RESOURCE_TABLES = {
  campaign: { table: "campaigns", workspaceColumn: "workspace_id" },
  lead: { table: "leads", workspaceColumn: "workspace_id" },
  booking: { table: "bookings", workspaceColumn: "workspace_id" },
  segment: { table: "segments", workspaceColumn: "workspace_id" },
  broadcast: { table: "broadcasts", workspaceColumn: "workspace_id" },
  creative: { table: "creatives", workspaceColumn: "workspace_id" },
} as const satisfies Record<string, { table: string; workspaceColumn: string }>;

export type KnownResourceType = keyof typeof RESOURCE_TABLES;

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * True if `userId` can access the workspace that owns `resourceId` of
 * `resourceType` (e.g. "campaign"), at `requiredRole` or above when given.
 * Looks up the resource's `workspace_id` with one query, then defers to
 * canUserAccessWorkspace.
 *
 * Fails closed (returns `false`, never throws) for every "can't prove
 * access" case: an unrecognized resourceType (see RESOURCE_TABLES above —
 * notably "project", which needs canUserAccessWorkspace directly, not
 * this), a resourceId that doesn't exist, or a row whose workspace_id is
 * NULL (e.g. a lead captured through a funnel nobody has claimed yet —
 * unowned, so no one is granted access via workspace membership).
 */
export async function canUserAccess(userId: string, resourceType: string, resourceId: string, requiredRole?: Role): Promise<boolean> {
  const mapping = (RESOURCE_TABLES as Record<string, { table: string; workspaceColumn: string } | undefined>)[resourceType];
  if (!mapping) return false;
  const { table, workspaceColumn } = mapping;
  // Belt-and-braces: table/workspaceColumn are compile-time literals from
  // RESOURCE_TABLES above, never request-derived, but this is the one place
  // they're interpolated into SQL text rather than bound as a value.
  if (!SAFE_IDENTIFIER.test(table) || !SAFE_IDENTIFIER.test(workspaceColumn)) return false;
  const res = await pgPool().query<{ ws: string | null }>(
    `SELECT ${workspaceColumn} AS ws FROM ${table} WHERE id = $1`,
    [resourceId],
  );
  const workspaceId = res.rows[0]?.ws;
  if (!workspaceId) return false;
  return canUserAccessWorkspace(userId, workspaceId, requiredRole);
}
