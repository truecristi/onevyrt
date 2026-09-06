/**
 * Data retention policies: configure soft-delete windows and automatic hard-delete
 * for different data types. Includes compliance reporting and policy enforcement.
 */

import { randomBytes } from "node:crypto";
import { pgPool } from "../db";

export interface RetentionPolicy {
  id: string;
  workspace_id: string;
  data_type: string;
  soft_delete_days: number;
  hard_delete_days: number;
  auto_delete_enabled: boolean;
  compliance_note?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ComplianceReport {
  id: string;
  workspace_id: string;
  report_date: Date;
  data_type: string;
  records_kept: number;
  records_soft_deleted: number;
  records_hard_deleted: number;
  total_storage_bytes: number;
  compliance_status: "compliant" | "at_risk" | "non_compliant";
  notes?: string;
  created_at: Date;
}

// Default retention policies for different data types
export const DEFAULT_POLICIES: Record<string, { soft_delete_days: number; hard_delete_days: number }> = {
  leads: { soft_delete_days: 7, hard_delete_days: 30 },
  bookings: { soft_delete_days: 7, hard_delete_days: 30 },
  projects: { soft_delete_days: 14, hard_delete_days: 60 },
  activity_logs: { soft_delete_days: 0, hard_delete_days: 90 },
  events: { soft_delete_days: 0, hard_delete_days: 365 },
  sessions: { soft_delete_days: 0, hard_delete_days: 180 },
  otp_verifications: { soft_delete_days: 0, hard_delete_days: 7 },
};

/**
 * Get or create a retention policy for a workspace and data type.
 */
export async function getOrCreateRetentionPolicy(
  workspaceId: string,
  dataType: string
): Promise<RetentionPolicy> {
  const existing = await getRetentionPolicy(workspaceId, dataType);
  if (existing) return existing;

  // Use default or create a new one
  const defaults = DEFAULT_POLICIES[dataType] || { soft_delete_days: 7, hard_delete_days: 30 };
  return createRetentionPolicy(workspaceId, dataType, defaults.soft_delete_days, defaults.hard_delete_days);
}

/**
 * Get a retention policy.
 */
export async function getRetentionPolicy(
  workspaceId: string,
  dataType: string
): Promise<RetentionPolicy | null> {
  const res = await pgPool().query<RetentionPolicy>(
    `SELECT * FROM data_retention_policies
     WHERE workspace_id = $1 AND data_type = $2`,
    [workspaceId, dataType]
  );
  return res.rows[0] ?? null;
}

/**
 * Create a retention policy.
 */
export async function createRetentionPolicy(
  workspaceId: string,
  dataType: string,
  softDeleteDays: number,
  hardDeleteDays: number,
  complianceNote?: string
): Promise<RetentionPolicy> {
  const id = randomBytes(8).toString("hex");
  const now = new Date();

  const res = await pgPool().query<RetentionPolicy>(
    `INSERT INTO data_retention_policies
     (id, workspace_id, data_type, soft_delete_days, hard_delete_days,
      auto_delete_enabled, compliance_note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)
     RETURNING *`,
    [id, workspaceId, dataType, softDeleteDays, hardDeleteDays, complianceNote, now, now]
  );

  const row = res.rows[0];
  if (!row) throw new Error("Failed to create retention policy.");
  return row;
}

/**
 * Update a retention policy.
 */
export async function updateRetentionPolicy(
  policyId: string,
  updates: Partial<{
    soft_delete_days: number;
    hard_delete_days: number;
    auto_delete_enabled: boolean;
    compliance_note: string;
  }>
): Promise<RetentionPolicy> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.soft_delete_days !== undefined) {
    fields.push(`soft_delete_days = $${paramCount++}`);
    values.push(updates.soft_delete_days);
  }
  if (updates.hard_delete_days !== undefined) {
    fields.push(`hard_delete_days = $${paramCount++}`);
    values.push(updates.hard_delete_days);
  }
  if (updates.auto_delete_enabled !== undefined) {
    fields.push(`auto_delete_enabled = $${paramCount++}`);
    values.push(updates.auto_delete_enabled);
  }
  if (updates.compliance_note !== undefined) {
    fields.push(`compliance_note = $${paramCount++}`);
    values.push(updates.compliance_note);
  }

  fields.push(`updated_at = now()`);

  values.push(policyId);
  const query = `UPDATE data_retention_policies SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`;
  const res = await pgPool().query<RetentionPolicy>(query, values);
  const row = res.rows[0];
  if (!row) throw new Error("Retention policy not found.");
  return row;
}

/**
 * Get all retention policies for a workspace.
 */
export async function getRetentionPolicies(workspaceId: string): Promise<RetentionPolicy[]> {
  const res = await pgPool().query<RetentionPolicy>(
    `SELECT * FROM data_retention_policies
     WHERE workspace_id = $1
     ORDER BY data_type ASC`,
    [workspaceId]
  );
  return res.rows;
}

/**
 * Get policies that have auto-delete enabled.
 */
export async function getAutoDeletePolicies(workspaceId: string): Promise<RetentionPolicy[]> {
  const res = await pgPool().query<RetentionPolicy>(
    `SELECT * FROM data_retention_policies
     WHERE workspace_id = $1 AND auto_delete_enabled = true
     ORDER BY data_type ASC`,
    [workspaceId]
  );
  return res.rows;
}

/**
 * Create a compliance report for a workspace and data type.
 */
export async function createComplianceReport(
  workspaceId: string,
  dataType: string,
  recordsKept: number,
  recordsSoftDeleted: number,
  recordsHardDeleted: number,
  totalStorageBytes: number,
  complianceStatus: "compliant" | "at_risk" | "non_compliant" = "compliant",
  notes?: string
): Promise<ComplianceReport> {
  const id = randomBytes(8).toString("hex");
  const now = new Date();
  const reportDate = new Date();
  reportDate.setHours(0, 0, 0, 0);

  const res = await pgPool().query<ComplianceReport>(
    `INSERT INTO compliance_reports
     (id, workspace_id, report_date, data_type, records_kept, records_soft_deleted,
      records_hard_deleted, total_storage_bytes, compliance_status, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [id, workspaceId, reportDate, dataType, recordsKept, recordsSoftDeleted,
     recordsHardDeleted, totalStorageBytes, complianceStatus, notes, now]
  );

  const row = res.rows[0];
  if (!row) throw new Error("Failed to create compliance report.");
  return row;
}

/**
 * Get compliance reports for a workspace.
 */
export async function getComplianceReports(
  workspaceId: string,
  dataType?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ records: ComplianceReport[]; total: number }> {
  const db = pgPool();

  let countQuery = "SELECT COUNT(*) as count FROM compliance_reports WHERE workspace_id = $1";
  const countValues: any[] = [workspaceId];
  let paramCount = 2;

  if (dataType) {
    countQuery += ` AND data_type = $${paramCount}`;
    countValues.push(dataType);
  }

  const countRes = await db.query<{ count: number }>(countQuery, countValues);
  const total = Number(countRes.rows[0]?.count ?? 0);

  let query = `SELECT * FROM compliance_reports WHERE workspace_id = $1`;
  const values: any[] = [workspaceId];
  paramCount = 2;

  if (dataType) {
    query += ` AND data_type = $${paramCount}`;
    values.push(dataType);
  }

  query += ` ORDER BY report_date DESC LIMIT $${paramCount + (dataType ? 1 : 0)} OFFSET $${paramCount + (dataType ? 2 : 1)}`;
  values.push(limit, offset);

  const res = await db.query<ComplianceReport>(query, values);

  return {
    records: res.rows,
    total,
  };
}

/**
 * Get the latest compliance report for a workspace.
 */
export async function getLatestComplianceReport(
  workspaceId: string,
  dataType?: string
): Promise<ComplianceReport | null> {
  let query = `SELECT * FROM compliance_reports WHERE workspace_id = $1`;
  const values: any[] = [workspaceId];
  let paramCount = 2;

  if (dataType) {
    query += ` AND data_type = $${paramCount++}`;
    values.push(dataType);
  }

  query += ` ORDER BY report_date DESC LIMIT 1`;
  const res = await pgPool().query<ComplianceReport>(query, values);
  return res.rows[0] ?? null;
}

/**
 * Get overall compliance status for a workspace.
 */
export async function getWorkspaceComplianceStatus(workspaceId: string): Promise<{
  overall_status: "compliant" | "at_risk" | "non_compliant";
  compliant_types: number;
  at_risk_types: number;
  non_compliant_types: number;
  total_soft_deleted: number;
  total_hard_deleted: number;
  policies_with_auto_delete: number;
}> {
  const res = await pgPool().query<{
    overall_status: string;
    compliant_types: number;
    at_risk_types: number;
    non_compliant_types: number;
    total_soft_deleted: number;
    total_hard_deleted: number;
    policies_with_auto_delete: number;
  }>(
    `SELECT
      CASE
        WHEN COUNT(CASE WHEN compliance_status = 'non_compliant' THEN 1 END) > 0 THEN 'non_compliant'
        WHEN COUNT(CASE WHEN compliance_status = 'at_risk' THEN 1 END) > 0 THEN 'at_risk'
        ELSE 'compliant'
      END as overall_status,
      COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END) as compliant_types,
      COUNT(CASE WHEN compliance_status = 'at_risk' THEN 1 END) as at_risk_types,
      COUNT(CASE WHEN compliance_status = 'non_compliant' THEN 1 END) as non_compliant_types,
      COALESCE(SUM(records_soft_deleted), 0) as total_soft_deleted,
      COALESCE(SUM(records_hard_deleted), 0) as total_hard_deleted,
      (SELECT COUNT(*) FROM data_retention_policies WHERE workspace_id = $1 AND auto_delete_enabled = true) as policies_with_auto_delete
     FROM (
       SELECT DISTINCT ON (data_type) data_type, compliance_status
       FROM compliance_reports
       WHERE workspace_id = $1
       ORDER BY data_type, report_date DESC
     ) latest_reports`,
    [workspaceId]
  );

  const row = res.rows[0]!;
  return {
    overall_status: (row.overall_status ?? "compliant") as "compliant" | "at_risk" | "non_compliant",
    compliant_types: Number(row.compliant_types),
    at_risk_types: Number(row.at_risk_types),
    non_compliant_types: Number(row.non_compliant_types),
    total_soft_deleted: Number(row.total_soft_deleted),
    total_hard_deleted: Number(row.total_hard_deleted),
    policies_with_auto_delete: Number(row.policies_with_auto_delete),
  };
}

/**
 * Check if a record should be soft-deleted based on age and policy.
 */
export function shouldSoftDelete(deletedAt: Date | null, policy: RetentionPolicy): boolean {
  if (deletedAt === null) return false; // Not deleted yet
  const ageMs = Date.now() - deletedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= policy.soft_delete_days;
}

/**
 * Check if a record should be hard-deleted based on soft-delete age and policy.
 */
export function shouldHardDelete(deletedAt: Date | null, policy: RetentionPolicy): boolean {
  if (deletedAt === null) return false;
  const ageMs = Date.now() - deletedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= policy.hard_delete_days && policy.auto_delete_enabled;
}
