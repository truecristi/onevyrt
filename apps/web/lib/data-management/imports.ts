/**
 * Data import management: bulk import users, funnels, and learners from CSV/JSON.
 * Tracks import history, error handling, and validation.
 */

import { pgPool } from "../db";
import { randomUUID } from "node:crypto";
import type { Queryable } from "../db";

export type ImportType = "users" | "funnels" | "learners";
export type ImportStatus = "pending" | "processing" | "completed" | "failed";

export interface ImportError {
  row_number: number;
  field?: string;
  error_message: string;
}

export interface ImportHistoryRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  import_type: ImportType;
  file_name: string;
  file_size_bytes: number;
  status: ImportStatus;
  total_rows: number;
  successfully_imported: number;
  skipped_rows: number;
  failed_rows: number;
  error_details: ImportError[];
  mapping_config?: Record<string, any>;
  created_at: Date;
  completed_at?: Date;
}

/**
 * Create an import record.
 */
export async function createImportRecord(
  workspaceId: string,
  userId: string,
  importType: ImportType,
  fileName: string,
  fileSizeBytes: number,
  totalRows: number,
  mappingConfig?: Record<string, any>
): Promise<ImportHistoryRecord> {
  const id = randomUUID();
  const now = new Date();

  const res = await pgPool().query<ImportHistoryRecord>(
    `INSERT INTO import_history
     (id, workspace_id, user_id, import_type, file_name, file_size_bytes,
      status, total_rows, mapping_config, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
     RETURNING *`,
    [id, workspaceId, userId, importType, fileName, fileSizeBytes,
     totalRows, mappingConfig ? JSON.stringify(mappingConfig) : null, now]
  );

  return res.rows[0]!;
}

/**
 * Update import progress.
 */
export async function updateImportProgress(
  db: Queryable,
  importId: string,
  updates: {
    status?: ImportStatus;
    successfully_imported?: number;
    skipped_rows?: number;
    failed_rows?: number;
    error_details?: ImportError[];
    completed_at?: Date;
  }
): Promise<ImportHistoryRecord> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(updates.status);
  }
  if (updates.successfully_imported !== undefined) {
    fields.push(`successfully_imported = $${paramCount++}`);
    values.push(updates.successfully_imported);
  }
  if (updates.skipped_rows !== undefined) {
    fields.push(`skipped_rows = $${paramCount++}`);
    values.push(updates.skipped_rows);
  }
  if (updates.failed_rows !== undefined) {
    fields.push(`failed_rows = $${paramCount++}`);
    values.push(updates.failed_rows);
  }
  if (updates.error_details !== undefined) {
    fields.push(`error_details = $${paramCount++}`);
    values.push(JSON.stringify(updates.error_details));
  }
  if (updates.completed_at !== undefined) {
    fields.push(`completed_at = $${paramCount++}`);
    values.push(updates.completed_at);
  }

  fields.push(`completed_at = COALESCE(completed_at, CASE WHEN status = 'completed' OR status = 'failed' THEN now() ELSE completed_at END)`);

  values.push(importId);
  const query = `UPDATE import_history SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`;
  const res = await db.query<ImportHistoryRecord>(query, values);
  return res.rows[0]!;
}

/**
 * Get import history for a workspace.
 */
export async function getImportHistory(
  workspaceId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ records: ImportHistoryRecord[]; total: number }> {
  const db = pgPool();

  const countRes = await db.query<{ count: number }>(
    "SELECT COUNT(*) as count FROM import_history WHERE workspace_id = $1",
    [workspaceId]
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const res = await db.query<ImportHistoryRecord>(
    `SELECT * FROM import_history
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );

  return {
    records: res.rows,
    total,
  };
}

/**
 * Get a specific import record.
 */
export async function getImportRecord(importId: string): Promise<ImportHistoryRecord | null> {
  const res = await pgPool().query<ImportHistoryRecord>(
    "SELECT * FROM import_history WHERE id = $1",
    [importId]
  );
  return res.rows[0] ?? null;
}

/**
 * Validate CSV structure for import.
 * Returns { isValid: boolean, errors: string[] }
 */
export function validateCSVStructure(
  importType: ImportType,
  headers: string[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const requiredFields: Record<ImportType, string[]> = {
    users: ["email", "password"],
    funnels: ["name", "slug", "type"],
    learners: ["email", "workspace_id"],
  };

  const required = requiredFields[importType];
  for (const field of required) {
    if (!headers.includes(field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single row of data.
 */
export function validateImportRow(
  importType: ImportType,
  row: Record<string, any>,
  rowNumber: number
): { isValid: boolean; errors: ImportError[] } {
  const errors: ImportError[] = [];

  // Common validations
  if (importType === "users") {
    if (!row.email || typeof row.email !== "string") {
      errors.push({ row_number: rowNumber, field: "email", error_message: "Invalid or missing email" });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({ row_number: rowNumber, field: "email", error_message: "Invalid email format" });
    }

    if (!row.password || typeof row.password !== "string" || row.password.length < 8) {
      errors.push({ row_number: rowNumber, field: "password", error_message: "Password must be at least 8 characters" });
    }
  } else if (importType === "funnels") {
    if (!row.name || typeof row.name !== "string") {
      errors.push({ row_number: rowNumber, field: "name", error_message: "Invalid or missing name" });
    }
    if (!row.slug || typeof row.slug !== "string") {
      errors.push({ row_number: rowNumber, field: "slug", error_message: "Invalid or missing slug" });
    }
    if (!row.type || !["landing", "sales", "webinar", "course"].includes(row.type)) {
      errors.push({ row_number: rowNumber, field: "type", error_message: "Invalid funnel type" });
    }
  } else if (importType === "learners") {
    if (!row.email || typeof row.email !== "string") {
      errors.push({ row_number: rowNumber, field: "email", error_message: "Invalid or missing email" });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({ row_number: rowNumber, field: "email", error_message: "Invalid email format" });
    }

    if (!row.workspace_id || typeof row.workspace_id !== "string") {
      errors.push({ row_number: rowNumber, field: "workspace_id", error_message: "Invalid or missing workspace_id" });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parse CSV content into rows (simple implementation).
 */
export function parseCSV(content: string): { headers: string[]; rows: Record<string, any>[] } {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parsing (doesn't handle quoted fields with commas)
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(",").map((p) => p.trim());
    const row: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = parts[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Get statistics on import success rates.
 */
export async function getImportStats(
  workspaceId: string,
  importType?: ImportType
): Promise<{
  totalImports: number;
  successfulImports: number;
  failedImports: number;
  totalRowsImported: number;
  totalRowsFailed: number;
}> {
  let query = `SELECT
    COUNT(*) as total_imports,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_imports,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_imports,
    COALESCE(SUM(successfully_imported), 0) as total_rows_imported,
    COALESCE(SUM(failed_rows), 0) as total_rows_failed
  FROM import_history
  WHERE workspace_id = $1`;

  const values: any[] = [workspaceId];
  let paramCount = 2;

  if (importType) {
    query += ` AND import_type = $${paramCount}`;
    values.push(importType);
  }

  const res = await pgPool().query<{
    total_imports: number;
    successful_imports: number;
    failed_imports: number;
    total_rows_imported: number;
    total_rows_failed: number;
  }>(query, values);

  const row = res.rows[0]!;
  return {
    totalImports: Number(row.total_imports),
    successfulImports: Number(row.successful_imports),
    failedImports: Number(row.failed_imports),
    totalRowsImported: Number(row.total_rows_imported),
    totalRowsFailed: Number(row.total_rows_failed),
  };
}
