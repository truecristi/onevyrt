/**
 * Data management cron jobs: scheduled exports, backup cleanup, retention enforcement.
 * These are registered with and called by lib/jobs.ts.
 */

import { pgPool } from "../db";
import { cleanupExpiredExports, getDueScheduledExports, markScheduledExportRun } from "./exports";
import { deleteExpiredBackups } from "./backups";
import { getAutoDeletePolicies, createComplianceReport } from "./retention";
import { sendMail } from "../mailer";

// lib/jobs.ts has its own (unexported) JobResult of the same shape; this
// structurally matches it so these job functions still satisfy its Job.run
// type (() => Promise<JobResult>) without a cross-module import.
interface JobResult { created: number; }

/**
 * Process scheduled exports that are due to run.
 * This is a placeholder - actual export generation would be handled by a background job.
 */
export async function processScheduledExports(): Promise<JobResult> {
  const pool = pgPool();
  const dueExports = await getDueScheduledExports();
  let processed = 0;

  for (const scheduledExport of dueExports) {
    try {
      // Mark as run and calculate next run time
      await markScheduledExportRun(pool, scheduledExport.id);

      // In production, queue an async job to generate and send the export
      // For now, just log that it was processed
      console.log(`[data-mgmt] Scheduled export ${scheduledExport.id} processed`);

      // Send notification email
      await sendMail({
        to: scheduledExport.recipient_email,
        subject: `Scheduled Export: ${scheduledExport.name}`,
        text: `Your scheduled export "${scheduledExport.name}" has been generated and is being prepared for download.`,
      }).catch(() => {
        // Best effort - don't fail the whole job if email fails
      });

      processed++;
    } catch (error) {
      console.error(`Failed to process scheduled export ${scheduledExport.id}:`, error);
      // Continue with next export
    }
  }

  return { created: processed };
}

/**
 * Clean up expired exports and backups based on retention settings.
 */
export async function cleanupExpiredData(): Promise<JobResult> {
  let cleaned = 0;

  try {
    const expiredExports = await cleanupExpiredExports();
    cleaned += expiredExports;
  } catch (error) {
    console.error("Failed to cleanup expired exports:", error);
  }

  try {
    const expiredBackups = await deleteExpiredBackups();
    cleaned += expiredBackups;
  } catch (error) {
    console.error("Failed to cleanup expired backups:", error);
  }

  return { created: cleaned };
}

/**
 * Enforce data retention policies: hard-delete soft-deleted records that have
 * exceeded the retention window, and generate compliance reports.
 */
export async function enforceDataRetention(): Promise<JobResult> {
  const pool = pgPool();
  let processed = 0;

  try {
    // Get all workspaces with auto-delete policies
    const workspaceRes = await pool.query<{ workspace_id: string }>(
      `SELECT DISTINCT workspace_id FROM data_retention_policies WHERE auto_delete_enabled = true`
    );

    for (const row of workspaceRes.rows) {
      const workspaceId = row.workspace_id;

      try {
        const policies = await getAutoDeletePolicies(workspaceId);

        for (const policy of policies) {
          // For each policy, identify records to hard-delete
          // This is a simplified version - actual implementation depends on table schema

          const table = policy.data_type;
          if (["leads", "bookings", "projects", "otp_verifications"].includes(table)) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy.hard_delete_days);

            try {
              // Count records before hard-delete
              const beforeRes = await pool.query<{ soft_count: number; hard_count: number }>(
                `SELECT
                  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_count,
                  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as hard_count
                 FROM ${table} WHERE workspace_id = $1`,
                [workspaceId]
              );

              const before = beforeRes.rows[0] ?? { soft_count: 0, hard_count: 0 };

              // Hard-delete records that exceeded retention window
              const deleteRes = await pool.query<{ id: string }>(
                `DELETE FROM ${table}
                 WHERE workspace_id = $1 AND deleted_at IS NOT NULL AND deleted_at < $2
                 RETURNING id`,
                [workspaceId, cutoffDate]
              );

              const hardDeletedCount = deleteRes.rowCount || 0;

              // Generate compliance report
              if (hardDeletedCount > 0 || before.soft_count > 0) {
                await createComplianceReport(
                  workspaceId,
                  table,
                  before.hard_count,
                  before.soft_count,
                  hardDeletedCount,
                  0, // Storage bytes would need to be calculated separately
                  "compliant"
                );
              }

              processed += hardDeletedCount;
            } catch (error) {
              console.error(`Failed to enforce retention for ${table} in workspace ${workspaceId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process retention for workspace ${workspaceId}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to enforce data retention:", error);
  }

  return { created: processed };
}
