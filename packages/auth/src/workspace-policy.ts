/**
 * Central server-side authorization policy (§4: "hiding a button is never
 * authorization"). Pure functions only - no DB access - so they're trivial
 * to unit-test and are the single place workspace/role rules live. Callers
 * (packages/domain) load the actual membership row and pass it in here.
 */

export type WorkspaceRole = "owner" | "member";

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

/** Any member (owner or member) may read workspace-scoped resources. */
export function canReadWorkspace(membership: WorkspaceMembership | null): boolean {
  return membership !== null;
}

/** Only the owner role may manage the workspace itself (Phase 1 has no manager/editor/viewer yet - §4). */
export function canManageWorkspace(membership: WorkspaceMembership | null): boolean {
  return membership?.role === "owner";
}

export class WorkspaceAccessDeniedError extends Error {
  constructor(workspaceId: string) {
    super(`Access denied to workspace ${workspaceId}`);
    this.name = "WorkspaceAccessDeniedError";
  }
}

/** Throws rather than returning a boolean, for call sites that want to fail closed in one line. */
export function assertCanReadWorkspace(
  membership: WorkspaceMembership | null,
  workspaceId: string,
): asserts membership is WorkspaceMembership {
  if (!canReadWorkspace(membership)) {
    throw new WorkspaceAccessDeniedError(workspaceId);
  }
}
