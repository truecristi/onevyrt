/**
 * Why & Creed Management
 *
 * Handles loading and saving a user's "Why" (purpose) and "Creed" (commitment)
 * statements that display prominently on the dashboard to inspire daily work.
 */

import { query } from "../db";
import { withAdvisoryLock } from "../db";

export interface WhyAndCreedData {
  workspaceId: string;
  why: string;
  creed: string;
  lastUpdated?: string;
}

/**
 * Get the why and creed for a workspace
 */
export async function getWhyAndCreed(
  workspaceId: string
): Promise<WhyAndCreedData | null> {
  try {
    const result = await query(
      `SELECT workspace_id, why, creed, updated_at
       FROM workspace_why_creed
       WHERE workspace_id = $1 AND deleted_at IS NULL`,
      [workspaceId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      workspaceId: row.workspace_id,
      why: row.why || "",
      creed: row.creed || "",
      lastUpdated: row.updated_at,
    };
  } catch (err) {
    console.error("Failed to get why/creed:", err);
    return null;
  }
}

/**
 * Save or update why and creed for a workspace
 */
export async function saveWhyAndCreed(
  workspaceId: string,
  why: string,
  creed: string
): Promise<WhyAndCreedData> {
  return withAdvisoryLock(`workspace:${workspaceId}`, async () => {
    // Check if record exists
    const existing = await query(
      `SELECT id FROM workspace_why_creed WHERE workspace_id = $1 AND deleted_at IS NULL`,
      [workspaceId]
    );

    const now = new Date().toISOString();

    if (existing.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE workspace_why_creed
         SET why = $1, creed = $2, updated_at = $3
         WHERE workspace_id = $4 AND deleted_at IS NULL`,
        [why, creed, now, workspaceId]
      );
    } else {
      // Insert new
      await query(
        `INSERT INTO workspace_why_creed (workspace_id, why, creed, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (workspace_id) DO UPDATE
         SET why = $2, creed = $3, updated_at = $5`,
        [workspaceId, why, creed, now, now]
      );
    }

    return {
      workspaceId,
      why,
      creed,
      lastUpdated: now,
    };
  });
}

/**
 * Delete why and creed for a workspace (soft delete)
 */
export async function deleteWhyAndCreed(workspaceId: string): Promise<void> {
  await query(
    `UPDATE workspace_why_creed SET deleted_at = NOW() WHERE workspace_id = $1`,
    [workspaceId]
  );
}
