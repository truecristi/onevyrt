import { pgPool } from "@/lib/db";

export interface ReflectionCheckpoint {
  id: string;
  workspaceId: string;
  userId: string;
  previousWhy: string;
  previousCreed: string;
  whyEvolution: string;
  creedEvolution: string;
  keyInsights: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get the latest reflection checkpoint for a workspace
 */
export async function getLatestReflection(
  workspaceId: string
): Promise<ReflectionCheckpoint | null> {
  const result = await pgPool().query(
    `SELECT id, workspace_id, user_id, previous_why, previous_creed,
       why_evolution, creed_evolution, key_insights, created_at, updated_at
     FROM workspace_90day_reflections
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    previousWhy: row.previous_why,
    previousCreed: row.previous_creed,
    whyEvolution: row.why_evolution,
    creedEvolution: row.creed_evolution,
    keyInsights: row.key_insights,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all reflection checkpoints for a workspace (paginated)
 */
export async function getReflectionHistory(
  workspaceId: string,
  limit = 10
): Promise<ReflectionCheckpoint[]> {
  const result = await pgPool().query(
    `SELECT id, workspace_id, user_id, previous_why, previous_creed,
       why_evolution, creed_evolution, key_insights, created_at, updated_at
     FROM workspace_90day_reflections
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    previousWhy: row.previous_why,
    previousCreed: row.previous_creed,
    whyEvolution: row.why_evolution,
    creedEvolution: row.creed_evolution,
    keyInsights: row.key_insights,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Check if a workspace is due for a 90-day reflection
 * (90+ days since last reflection, or no reflection yet)
 */
export async function isReflectionDue(workspaceId: string): Promise<boolean> {
  const latest = await getLatestReflection(workspaceId);

  if (!latest) {
    // No reflection yet - check if workspace is > 90 days old
    const wsResult = await pgPool().query(
      `SELECT created_at FROM workspaces WHERE id = $1`,
      [workspaceId]
    );

    if (!wsResult.rows[0]) return false;

    const workspaceAge = Date.now() - wsResult.rows[0].created_at.getTime();
    return workspaceAge > 90 * 24 * 60 * 60 * 1000; // 90 days in ms
  }

  // Check if 90 days have passed since latest reflection
  const daysSinceReflection =
    (Date.now() - latest.createdAt.getTime()) / (24 * 60 * 60 * 1000);
  return daysSinceReflection >= 90;
}

/**
 * Get the next scheduled reflection date (90 days from latest)
 */
export async function getNextReflectionDate(
  workspaceId: string
): Promise<Date | null> {
  const latest = await getLatestReflection(workspaceId);

  if (!latest) return null;

  const nextDate = new Date(latest.createdAt);
  nextDate.setDate(nextDate.getDate() + 90);
  return nextDate;
}

/**
 * Calculate metrics from reflection history
 * Useful for dashboard summaries
 */
export async function getReflectionMetrics(workspaceId: string) {
  const result = await pgPool().query(
    `SELECT
       COUNT(*) as total_reflections,
       MAX(created_at) as last_reflection_date,
       MIN(created_at) as first_reflection_date
     FROM workspace_90day_reflections
     WHERE workspace_id = $1`,
    [workspaceId]
  );

  const row = result.rows[0];
  return {
    totalReflections: parseInt(row.total_reflections || 0),
    lastReflectionDate: row.last_reflection_date,
    firstReflectionDate: row.first_reflection_date,
  };
}

/**
 * Archive old reflections (optional - for compliance/storage)
 * Keeps only the last N reflections per workspace
 */
export async function archiveOldReflections(
  workspaceId: string,
  keepCount = 24 // Keep 2 years of quarterly reflections (24 per year)
): Promise<number> {
  const result = await pgPool().query(
    `WITH ranked_reflections AS (
       SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_num
       FROM workspace_90day_reflections
       WHERE workspace_id = $1
     )
     DELETE FROM workspace_90day_reflections
     WHERE id IN (
       SELECT id FROM ranked_reflections WHERE row_num > $2
     )`,
    [workspaceId, keepCount]
  );

  return result.rowCount ?? 0;
}

/**
 * Generate a text summary of reflection progress
 * Useful for emails, notifications, dashboards
 */
export async function generateReflectionSummary(
  workspaceId: string
): Promise<string> {
  const history = await getReflectionHistory(workspaceId, 3);

  if (history.length === 0) {
    return "No reflections yet. Start your 90-day reflection journey today.";
  }

  const latest = history[0]!; // history.length === 0 was handled above
  const lines: string[] = [];

  lines.push("Your Latest 90-Day Reflection:");
  lines.push("");
  lines.push("📈 Why Evolution:");
  lines.push(truncate(latest.whyEvolution, 100));
  lines.push("");
  lines.push("⚡ Creed Evolution:");
  lines.push(truncate(latest.creedEvolution, 100));
  lines.push("");
  lines.push("💡 Key Insights:");
  lines.push(truncate(latest.keyInsights, 100));

  if (history.length > 1) {
    lines.push("");
    lines.push(`Total reflections: ${history.length}`);
    lines.push(`Journey started: ${history[history.length - 1]!.createdAt.toLocaleDateString()}`);
  }

  return lines.join("\n");
}

/**
 * Internal utility to truncate text
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
