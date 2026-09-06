import { z } from "zod";

/**
 * Phase 2 request/response contracts: audit records (PRD-BIZCORE-010).
 * Read-only - audit entries are written internally by the other
 * business-core use cases (every create/update inserts one), never
 * created directly through this contract.
 */

export const listAuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;

export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
