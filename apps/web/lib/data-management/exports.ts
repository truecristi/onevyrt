/**
 * Data export management: multiple formats (JSON/CSV/PDF), selective export,
 * scheduled exports, and export history tracking.
 */

import { pgPool } from "../db";
import { randomUUID } from "node:crypto";
import type { Queryable } from "../db";

export type ExportFormat = "json" | "csv" | "pdf";
export type ExportType = "full" | "selective";
export type ExportStatus = "pending" | "processing" | "completed" | "failed";

export interface ExportHistoryRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  format: ExportFormat;
  export_type: ExportType;
  selected_categories: string[];
  file_size_bytes: number;
  file_url?: string;
  status: ExportStatus;
  error_message?: string;
  created_at: Date;
  expires_at?: Date;
}

export interface ScheduledExportConfig {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  name: string;
  format: ExportFormat;
  selected_categories: string[];
  frequency: "daily" | "weekly" | "monthly";
  schedule_day_or_weekday?: number;
  schedule_hour: number;
  recipient_email: string;
  enabled: boolean;
  last_run_at?: Date;
  next_run_at?: Date;
  created_at: Date;
  deleted_at?: Date;
}

/**
 * Log a new export to history. Called whenever an export is initiated
 * (manual or scheduled).
 */
export async function logExport(
  db: Queryable,
  workspaceId: string,
  userId: string,
  format: ExportFormat,
  exportType: ExportType,
  selectedCategories: string[],
  fileSizeBytes: number,
  fileUrl?: string,
  expiresAt?: Date
): Promise<ExportHistoryRecord> {
  const id = randomUUID();
  const now = new Date();
  const res = await db.query<ExportHistoryRecord>(
    `INSERT INTO export_history
     (id, workspace_id, user_id, format, export_type, selected_categories,
      file_size_bytes, file_url, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10)
     RETURNING *`,
    [id, workspaceId, userId, format, exportType, JSON.stringify(selectedCategories),
     fileSizeBytes, fileUrl, now, expiresAt]
  );
  return res.rows[0]!;
}

/**
 * Log a failed export attempt.
 */
export async function logExportFailure(
  db: Queryable,
  workspaceId: string,
  userId: string,
  format: ExportFormat,
  exportType: ExportType,
  selectedCategories: string[],
  errorMessage: string
): Promise<ExportHistoryRecord> {
  const id = randomUUID();
  const now = new Date();
  const res = await db.query<ExportHistoryRecord>(
    `INSERT INTO export_history
     (id, workspace_id, user_id, format, export_type, selected_categories,
      file_size_bytes, status, error_message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 'failed', $7, $8)
     RETURNING *`,
    [id, workspaceId, userId, format, exportType, JSON.stringify(selectedCategories),
     errorMessage, now]
  );
  return res.rows[0]!;
}

/**
 * Get export history for a workspace (paginated, most recent first).
 */
export async function getExportHistory(
  workspaceId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ records: ExportHistoryRecord[]; total: number }> {
  const db = pgPool();

  const countRes = await db.query<{ count: number }>(
    "SELECT COUNT(*) as count FROM export_history WHERE workspace_id = $1",
    [workspaceId]
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const res = await db.query<ExportHistoryRecord>(
    `SELECT * FROM export_history
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
 * Get export history for a user across all their workspaces.
 */
export async function getUserExportHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ExportHistoryRecord[]> {
  const res = await pgPool().query<ExportHistoryRecord>(
    `SELECT * FROM export_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return res.rows;
}

/**
 * Create a scheduled export configuration.
 */
export async function createScheduledExport(
  workspaceId: string,
  createdByUserId: string,
  config: {
    name: string;
    format: ExportFormat;
    selectedCategories: string[];
    frequency: "daily" | "weekly" | "monthly";
    scheduleDayOrWeekday?: number;
    scheduleHour?: number;
    recipientEmail: string;
  }
): Promise<ScheduledExportConfig> {
  const id = randomUUID();
  const now = new Date();
  const scheduleHour = config.scheduleHour ?? 0;

  // Calculate next run time based on frequency
  const nextRunAt = calculateNextRunTime(config.frequency, config.scheduleDayOrWeekday ?? 0, scheduleHour);

  const res = await pgPool().query<ScheduledExportConfig>(
    `INSERT INTO scheduled_exports
     (id, workspace_id, created_by_user_id, name, format, selected_categories,
      frequency, schedule_day_or_weekday, schedule_hour, recipient_email, enabled, next_run_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12)
     RETURNING *`,
    [id, workspaceId, createdByUserId, config.name, config.format,
     JSON.stringify(config.selectedCategories), config.frequency,
     config.scheduleDayOrWeekday ?? null, scheduleHour, config.recipientEmail,
     nextRunAt, now]
  );
  return res.rows[0]!;
}

/**
 * Get all scheduled exports for a workspace (active and inactive).
 */
export async function getScheduledExports(
  workspaceId: string,
  activeOnly: boolean = false
): Promise<ScheduledExportConfig[]> {
  const query = activeOnly
    ? `SELECT * FROM scheduled_exports
       WHERE workspace_id = $1 AND enabled = true AND deleted_at IS NULL
       ORDER BY next_run_at ASC`
    : `SELECT * FROM scheduled_exports
       WHERE workspace_id = $1 AND deleted_at IS NULL
       ORDER BY next_run_at ASC`;

  const res = await pgPool().query<ScheduledExportConfig>(query, [workspaceId]);
  return res.rows;
}

/**
 * Get scheduled exports due to run (used by cron job).
 */
export async function getDueScheduledExports(): Promise<ScheduledExportConfig[]> {
  const now = new Date();
  const res = await pgPool().query<ScheduledExportConfig>(
    `SELECT * FROM scheduled_exports
     WHERE enabled = true AND deleted_at IS NULL AND next_run_at <= $1
     ORDER BY next_run_at ASC`,
    [now]
  );
  return res.rows;
}

/**
 * Update a scheduled export: mark it as run and calculate next run time.
 */
export async function markScheduledExportRun(
  db: Queryable,
  scheduledExportId: string
): Promise<ScheduledExportConfig> {
  // Fetch to get schedule config
  const fetchRes = await db.query<ScheduledExportConfig>(
    "SELECT * FROM scheduled_exports WHERE id = $1",
    [scheduledExportId]
  );
  const record = fetchRes.rows[0];
  if (!record) throw new Error(`Scheduled export ${scheduledExportId} not found`);

  const now = new Date();
  const nextRunAt = calculateNextRunTime(
    record.frequency as "daily" | "weekly" | "monthly",
    record.schedule_day_or_weekday ?? 0,
    record.schedule_hour
  );

  const res = await db.query<ScheduledExportConfig>(
    `UPDATE scheduled_exports
     SET last_run_at = $1, next_run_at = $2
     WHERE id = $3
     RETURNING *`,
    [now, nextRunAt, scheduledExportId]
  );
  return res.rows[0]!;
}

/**
 * Update a scheduled export configuration.
 */
export async function updateScheduledExport(
  scheduledExportId: string,
  updates: Partial<{
    name: string;
    format: ExportFormat;
    selectedCategories: string[];
    frequency: "daily" | "weekly" | "monthly";
    scheduleDayOrWeekday: number;
    scheduleHour: number;
    recipientEmail: string;
    enabled: boolean;
  }>
): Promise<ScheduledExportConfig> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(updates.name);
  }
  if (updates.format !== undefined) {
    fields.push(`format = $${paramCount++}`);
    values.push(updates.format);
  }
  if (updates.selectedCategories !== undefined) {
    fields.push(`selected_categories = $${paramCount++}`);
    values.push(JSON.stringify(updates.selectedCategories));
  }
  if (updates.frequency !== undefined) {
    fields.push(`frequency = $${paramCount++}`);
    values.push(updates.frequency);
  }
  if (updates.scheduleDayOrWeekday !== undefined) {
    fields.push(`schedule_day_or_weekday = $${paramCount++}`);
    values.push(updates.scheduleDayOrWeekday);
  }
  if (updates.scheduleHour !== undefined) {
    fields.push(`schedule_hour = $${paramCount++}`);
    values.push(updates.scheduleHour);
  }
  if (updates.recipientEmail !== undefined) {
    fields.push(`recipient_email = $${paramCount++}`);
    values.push(updates.recipientEmail);
  }
  if (updates.enabled !== undefined) {
    fields.push(`enabled = $${paramCount++}`);
    values.push(updates.enabled);
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(scheduledExportId);
  const query = `UPDATE scheduled_exports SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`;
  const res = await pgPool().query<ScheduledExportConfig>(query, values);
  return res.rows[0]!;
}

/**
 * Delete (soft-delete) a scheduled export.
 */
export async function deleteScheduledExport(scheduledExportId: string): Promise<void> {
  await pgPool().query(
    "UPDATE scheduled_exports SET deleted_at = now() WHERE id = $1",
    [scheduledExportId]
  );
}

/**
 * Clean up expired export files (based on expires_at).
 * Called by the daily cron job.
 */
export async function cleanupExpiredExports(): Promise<number> {
  const now = new Date();
  const res = await pgPool().query<{ id: string }>(
    `DELETE FROM export_history
     WHERE expires_at IS NOT NULL AND expires_at < $1
     RETURNING id`,
    [now]
  );
  return res.rowCount || 0;
}

/**
 * Calculate the next run time for a scheduled export based on frequency.
 */
function calculateNextRunTime(
  frequency: "daily" | "weekly" | "monthly",
  dayOrWeekday: number,
  hour: number
): Date {
  const now = new Date();
  const next = new Date(now);

  // Set to UTC midnight + hour
  next.setUTCHours(hour, 0, 0, 0);

  if (frequency === "daily") {
    // Tomorrow at the specified hour
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === "weekly") {
    // dayOrWeekday: 0=Monday, 6=Sunday
    const targetDay = dayOrWeekday;
    const currentDay = (now.getUTCDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    if (daysAhead === 0 && next <= now) daysAhead = 7;

    next.setUTCDate(next.getUTCDate() + daysAhead);
  } else if (frequency === "monthly") {
    // dayOrWeekday: 1-28 (day of month)
    next.setUTCDate(Math.min(dayOrWeekday, 28));
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(Math.min(dayOrWeekday, 28));
    }
  }

  return next;
}
