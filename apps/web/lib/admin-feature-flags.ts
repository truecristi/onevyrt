/**
 * Admin feature flags - toggle features on/off per workspace or globally
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

export interface FeatureFlag {
  id: string;
  flagName: string;
  enabled: boolean;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
  updatedByEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagUpdate {
  flagName: string;
  enabled: boolean;
  workspaceId?: string;
  updatedByEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get all feature flags (global and per-workspace)
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  const res = await pgPool().query(
    `SELECT id, flag_name, enabled, workspace_id, created_at, updated_at, updated_by_email, metadata
     FROM admin_feature_flags
     ORDER BY flag_name, workspace_id`,
  );

  return res.rows.map((r) => ({
    id: r.id,
    flagName: r.flag_name,
    enabled: r.enabled,
    workspaceId: r.workspace_id || undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    updatedByEmail: r.updated_by_email,
    metadata: r.metadata,
  }));
}

/**
 * Get feature flags for a specific workspace
 */
export async function getWorkspaceFeatureFlags(workspaceId: string): Promise<FeatureFlag[]> {
  const res = await pgPool().query(
    `SELECT id, flag_name, enabled, workspace_id, created_at, updated_at, updated_by_email, metadata
     FROM admin_feature_flags
     WHERE workspace_id = $1 OR workspace_id IS NULL
     ORDER BY flag_name`,
    [workspaceId],
  );

  return res.rows.map((r) => ({
    id: r.id,
    flagName: r.flag_name,
    enabled: r.enabled,
    workspaceId: r.workspace_id || undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    updatedByEmail: r.updated_by_email,
    metadata: r.metadata,
  }));
}

/**
 * Check if a feature flag is enabled for a workspace
 */
export async function isFlagEnabled(flagName: string, workspaceId?: string): Promise<boolean> {
  const query = workspaceId
    ? `SELECT enabled FROM admin_feature_flags
       WHERE flag_name = $1 AND (workspace_id = $2 OR workspace_id IS NULL)
       ORDER BY workspace_id DESC
       LIMIT 1`
    : `SELECT enabled FROM admin_feature_flags
       WHERE flag_name = $1 AND workspace_id IS NULL
       LIMIT 1`;

  const res = await pgPool().query(query, workspaceId ? [flagName, workspaceId] : [flagName]);

  if (res.rows.length === 0) return false;
  return res.rows[0].enabled;
}

/**
 * Set or update a feature flag
 */
export async function setFeatureFlag(update: FeatureFlagUpdate): Promise<FeatureFlag> {
  const pool = pgPool();
  const existingRes = await pool.query(
    `SELECT id FROM admin_feature_flags
     WHERE flag_name = $1 AND workspace_id IS NOT DISTINCT FROM $2`,
    [update.flagName, update.workspaceId ?? null],
  );

  let id: string;
  if (existingRes.rows.length > 0) {
    id = existingRes.rows[0].id;
    await pool.query(
      `UPDATE admin_feature_flags
       SET enabled = $1, updated_at = now(), updated_by_email = $2, metadata = $3
       WHERE id = $4`,
      [update.enabled, update.updatedByEmail ?? null, update.metadata ? JSON.stringify(update.metadata) : null, id],
    );
  } else {
    id = randomBytes(6).toString("hex");
    await pool.query(
      `INSERT INTO admin_feature_flags (id, flag_name, enabled, workspace_id, updated_by_email, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        update.flagName,
        update.enabled,
        update.workspaceId ?? null,
        update.updatedByEmail ?? null,
        update.metadata ? JSON.stringify(update.metadata) : null,
      ],
    );
  }

  const result = await pool.query(
    `SELECT id, flag_name, enabled, workspace_id, created_at, updated_at, updated_by_email, metadata
     FROM admin_feature_flags WHERE id = $1`,
    [id],
  );

  const r = result.rows[0];
  return {
    id: r.id,
    flagName: r.flag_name,
    enabled: r.enabled,
    workspaceId: r.workspace_id || undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    updatedByEmail: r.updated_by_email,
    metadata: r.metadata,
  };
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(id: string): Promise<void> {
  await pgPool().query(`DELETE FROM admin_feature_flags WHERE id = $1`, [id]);
}

/**
 * Common feature flags
 */
export const FEATURE_FLAGS = {
  BETA_FEATURES: "beta_features",
  MAINTENANCE_MODE: "maintenance_mode",
  COHORT_SCHEDULING: "cohort_scheduling",
  COMMUNITY_FEATURES: "community_features",
  ADVANCED_ANALYTICS: "advanced_analytics",
  WORKSPACE_TEMPLATES: "workspace_templates",
  CUSTOM_BRANDING: "custom_branding",
  API_ACCESS: "api_access",
  BULK_OPERATIONS: "bulk_operations",
  DATA_EXPORT: "data_export",
} as const;
