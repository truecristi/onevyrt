/**
 * Backup and restore management: automated daily backups, point-in-time recovery,
 * backup status dashboard, and backup integrity verification.
 */

import { pgPool } from "../db";
import crypto from "crypto";
import type { Queryable } from "../db";

export type BackupType = "automated" | "manual";
export type BackupStatus = "pending" | "processing" | "completed" | "failed";

export interface BackupRecord {
  id: string;
  workspace_id: string;
  backup_type: BackupType;
  backup_timestamp: Date;
  storage_location: string;
  storage_size_bytes: number;
  status: BackupStatus;
  includes_media: boolean;
  checksum?: string;
  retention_until?: Date;
  created_at: Date;
  error_message?: string;
}

/**
 * Create a new backup record.
 */
export async function createBackupRecord(
  workspaceId: string,
  backupType: BackupType,
  backupTimestamp: Date,
  storageLocation: string,
  storageSizeBytes: number,
  includesMedia: boolean = false,
  retentionUntil?: Date
): Promise<BackupRecord> {
  const id = crypto.randomUUID();
  const now = new Date();

  const res = await pgPool().query<BackupRecord>(
    `INSERT INTO backup_records
     (id, workspace_id, backup_type, backup_timestamp, storage_location,
      storage_size_bytes, status, includes_media, retention_until, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7, $8, $9)
     RETURNING *`,
    [id, workspaceId, backupType, backupTimestamp, storageLocation,
     storageSizeBytes, includesMedia, retentionUntil, now]
  );

  return res.rows[0]!;
}

/**
 * Mark a backup as completed with checksum.
 */
export async function markBackupCompleted(
  db: Queryable,
  backupId: string,
  checksum: string,
  finalSizeBytes?: number
): Promise<BackupRecord | null> {
  let query = `UPDATE backup_records
    SET status = 'completed', checksum = $1`;
  const values: any[] = [checksum];
  let paramCount = 2;

  if (finalSizeBytes !== undefined) {
    query += `, storage_size_bytes = $${paramCount++}`;
    values.push(finalSizeBytes);
  }

  query += ` WHERE id = $${paramCount} RETURNING *`;
  values.push(backupId);

  const res = await db.query<BackupRecord>(query, values);
  return res.rows[0] ?? null;
}

/**
 * Mark a backup as failed with error message.
 */
export async function markBackupFailed(
  db: Queryable,
  backupId: string,
  errorMessage: string
): Promise<BackupRecord | null> {
  const res = await db.query<BackupRecord>(
    `UPDATE backup_records
     SET status = 'failed', error_message = $1
     WHERE id = $2
     RETURNING *`,
    [errorMessage, backupId]
  );
  return res.rows[0] ?? null;
}

/**
 * Get all backups for a workspace (ordered by timestamp, most recent first).
 */
export async function getBackups(
  workspaceId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ records: BackupRecord[]; total: number }> {
  const db = pgPool();

  const countRes = await db.query<{ count: number }>(
    "SELECT COUNT(*) as count FROM backup_records WHERE workspace_id = $1",
    [workspaceId]
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const res = await db.query<BackupRecord>(
    `SELECT * FROM backup_records
     WHERE workspace_id = $1
     ORDER BY backup_timestamp DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );

  return {
    records: res.rows,
    total,
  };
}

/**
 * Get a specific backup record.
 */
export async function getBackup(backupId: string): Promise<BackupRecord | null> {
  const res = await pgPool().query<BackupRecord>(
    "SELECT * FROM backup_records WHERE id = $1",
    [backupId]
  );
  return res.rows[0] ?? null;
}

/**
 * Get the most recent successful backup for a workspace.
 */
export async function getLatestBackup(workspaceId: string): Promise<BackupRecord | null> {
  const res = await pgPool().query<BackupRecord>(
    `SELECT * FROM backup_records
     WHERE workspace_id = $1 AND status = 'completed'
     ORDER BY backup_timestamp DESC
     LIMIT 1`,
    [workspaceId]
  );
  return res.rows[0] ?? null;
}

/**
 * Get backup statistics for a workspace.
 */
export async function getBackupStats(workspaceId: string): Promise<{
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  total_storage_bytes: number;
  latest_backup_at?: Date;
  oldest_backup_at?: Date;
}> {
  const res = await pgPool().query<{
    total_backups: number;
    successful_backups: number;
    failed_backups: number;
    total_storage_bytes: number;
    latest_backup_at?: Date;
    oldest_backup_at?: Date;
  }>(
    `SELECT
      COUNT(*) as total_backups,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
      COALESCE(SUM(storage_size_bytes), 0) as total_storage_bytes,
      MAX(backup_timestamp) as latest_backup_at,
      MIN(backup_timestamp) as oldest_backup_at
     FROM backup_records
     WHERE workspace_id = $1`,
    [workspaceId]
  );

  // Bare aggregate query (no GROUP BY) always returns exactly one row.
  const row = res.rows[0]!;
  return {
    total_backups: Number(row.total_backups),
    successful_backups: Number(row.successful_backups),
    failed_backups: Number(row.failed_backups),
    total_storage_bytes: Number(row.total_storage_bytes),
    latest_backup_at: row.latest_backup_at,
    oldest_backup_at: row.oldest_backup_at,
  };
}

/**
 * Find a backup by point-in-time (returns closest backup before the given time).
 */
export async function findBackupForPointInTime(
  workspaceId: string,
  pointInTime: Date
): Promise<BackupRecord | null> {
  const res = await pgPool().query<BackupRecord>(
    `SELECT * FROM backup_records
     WHERE workspace_id = $1 AND status = 'completed' AND backup_timestamp <= $2
     ORDER BY backup_timestamp DESC
     LIMIT 1`,
    [workspaceId, pointInTime]
  );
  return res.rows[0] ?? null;
}

/**
 * Delete expired backups (based on retention_until).
 * Called by the daily cron job.
 */
export async function deleteExpiredBackups(): Promise<number> {
  const now = new Date();
  const res = await pgPool().query<{ id: string }>(
    `DELETE FROM backup_records
     WHERE retention_until IS NOT NULL AND retention_until < $1
     RETURNING id`,
    [now]
  );
  return res.rowCount || 0;
}

/**
 * Verify backup integrity by comparing checksums.
 * (This is a placeholder; actual verification depends on storage backend)
 */
export async function verifyBackupIntegrity(
  backupId: string,
  actualChecksum: string
): Promise<{ isValid: boolean; storedChecksum?: string }> {
  const backup = await getBackup(backupId);
  if (!backup) return { isValid: false };

  if (!backup.checksum) {
    return { isValid: false, storedChecksum: undefined };
  }

  return {
    isValid: backup.checksum === actualChecksum,
    storedChecksum: backup.checksum,
  };
}

/**
 * Calculate SHA256 checksum for a buffer (used for data integrity).
 */
export function calculateChecksum(data: Buffer | string): string {
  const hash = crypto.createHash("sha256");
  if (typeof data === "string") {
    hash.update(data, "utf8");
  } else {
    hash.update(data);
  }
  return hash.digest("hex");
}

/**
 * Get backup retention policy (defaults if not configured).
 */
export async function getBackupRetentionPolicy(_workspaceId: string): Promise<{
  retention_days: number;
  min_backups: number;
  max_backups: number;
}> {
  // For now, return sensible defaults
  // In the future, this can be configurable per workspace
  return {
    retention_days: 90,
    min_backups: 7, // Keep at least 7 daily backups
    max_backups: 1000, // Hard limit on stored backups
  };
}

/**
 * Get backups that should be retained based on policy.
 * Keeps minimum number of backups and honors retention period.
 */
export async function getBackupsToRetain(
  workspaceId: string,
  policy: { retention_days: number; min_backups: number }
): Promise<BackupRecord[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

  const res = await pgPool().query<BackupRecord>(
    `SELECT * FROM backup_records
     WHERE workspace_id = $1 AND status = 'completed'
     ORDER BY backup_timestamp DESC
     LIMIT $2`,
    [workspaceId, policy.min_backups]
  );

  // Keep all recent backups within retention window
  const retained: BackupRecord[] = [];
  for (const backup of res.rows) {
    if (backup.backup_timestamp >= cutoffDate || retained.length < policy.min_backups) {
      retained.push(backup);
    }
  }

  return retained;
}
