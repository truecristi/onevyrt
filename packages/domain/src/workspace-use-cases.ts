import { and, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import { assertCanReadWorkspace, type WorkspaceMembership } from "@onevyrt/auth";

export interface CreateWorkspaceInput {
  ownerUserId: string;
  name: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
}

export async function createWorkspace(
  db: Database,
  input: CreateWorkspaceInput,
): Promise<WorkspaceRecord> {
  return withTransaction(db, async (tx) => {
    const [workspace] = await tx
      .insert(schema.workspaces)
      .values({ name: input.name, ownerUserId: input.ownerUserId })
      .returning();
    if (!workspace) throw new Error("Failed to create workspace");

    await tx
      .insert(schema.workspaceMembers)
      .values({ workspaceId: workspace.id, userId: input.ownerUserId, role: "owner" });

    await tx.insert(schema.auditLog).values({
      actorUserId: input.ownerUserId,
      workspaceId: workspace.id,
      action: "workspace.created",
      metadata: { name: workspace.name },
    });

    return { id: workspace.id, name: workspace.name };
  });
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: "owner" | "member";
}

/**
 * Every query in this file filters by the requesting user's own membership
 * rows - it is structurally impossible to return another user's workspace
 * (§4: "every query must include the active workspace boundary").
 */
export async function listWorkspacesForUser(
  db: Database,
  userId: string,
): Promise<WorkspaceSummary[]> {
  const rows = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(eq(schema.workspaceMembers.userId, userId));

  return rows.map((row) => ({ id: row.id, name: row.name, role: row.role as "owner" | "member" }));
}

/** The single place membership is looked up - callers pass the result straight into @onevyrt/auth's policy functions. */
export async function getMembership(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMembership | null> {
  const row = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, userId),
    ),
  });
  if (!row) return null;
  return { workspaceId: row.workspaceId, userId: row.userId, role: row.role as "owner" | "member" };
}

/**
 * The single chokepoint every business-core use case (business profiles,
 * goals, customer profiles, offers, and whatever comes after them) calls
 * before reading or writing workspace-scoped data. Looks up membership and
 * fails closed via assertCanReadWorkspace in one step, instead of each
 * call site re-implementing "getMembership then assertCanReadWorkspace"
 * (a review of PRs #2-#4 found this duplicated nine times) - a future
 * authorization change (e.g. requiring canManageWorkspace for a
 * destructive action) now only needs to change here.
 */
export async function requireWorkspaceMembership(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMembership> {
  const membership = await getMembership(db, workspaceId, userId);
  assertCanReadWorkspace(membership, workspaceId);
  return membership;
}
