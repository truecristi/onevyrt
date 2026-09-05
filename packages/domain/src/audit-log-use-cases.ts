import { desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { requireWorkspaceMembership } from "./workspace-use-cases";

/**
 * PRD-BIZCORE-010 vertical slice: audit records. Read-only - every other
 * business-core use case (Phase 1's auth/workspace slice through Phase
 * 2's evidence slice) already writes a row here on create/update; this is
 * the first read path. Same tenancy shape as everywhere else:
 * requireWorkspaceMembership (ADR-0003), scoped by workspaceId.
 */

export interface AuditLogEntryRecord {
  id: string;
  workspaceId: string | null;
  actorUserId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ListAuditLogInput {
  workspaceId: string;
  actorUserId: string;
  limit: number;
}

export async function listAuditLog(
  db: Database,
  input: ListAuditLogInput,
): Promise<AuditLogEntryRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.workspaceId, input.workspaceId))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(input.limit);

  return rows as AuditLogEntryRecord[];
}
