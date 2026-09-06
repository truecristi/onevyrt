/**
 * Per-workspace managed-AI usage meter. Counts generations done through the
 * managed path (lib/managed-ai) within the current calendar month, so the
 * /api/ai/generate route can enforce a monthly quota and show remaining usage.
 * Stored in the `aiUsage` section of the workspace_business blob (same durable
 * Postgres as the rest), as { month: "YYYY-MM", count: N }.
 *
 * The increment is a single atomic UPDATE (jsonb_set with a CASE), so
 * concurrent generations can't lose a count via read-modify-write, and a new
 * calendar month resets the counter in the same statement.
 */
import { pgPool } from "./db";

export interface AiUsage {
  month: string; // "YYYY-MM"
  count: number;
}

/** The calendar-month key for a date, in UTC (matches the server's clock). */
export function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Current usage for the workspace this month (0 when a new month or none). */
export async function getAiUsage(workspaceId: string, now: Date): Promise<AiUsage> {
  const month = monthKey(now);
  const res = await pgPool().query<{ data: { aiUsage?: AiUsage } }>(
    "SELECT data FROM workspace_business WHERE workspace_id = $1",
    [workspaceId],
  );
  const raw = res.rows[0]?.data?.aiUsage;
  if (!raw || raw.month !== month || typeof raw.count !== "number" || raw.count < 0) {
    return { month, count: 0 };
  }
  return { month, count: Math.floor(raw.count) };
}

/**
 * Atomically add one to this month's count (resetting on a new month) and
 * return the new count. Single statement — safe under concurrent generations.
 */
/** Refund one generation for THIS month (floored at 0). Used to undo an
 *  over-quota reservation or a failed generation, so the reserve-before-generate
 *  pattern in the generate route stays exact. No-op if the stored month differs
 *  (nothing to refund into a fresh month). */
export async function decrementAiUsage(workspaceId: string, now: Date): Promise<void> {
  const month = monthKey(now);
  await pgPool().query(
    `UPDATE workspace_business SET
       data = jsonb_set(
         COALESCE(data, '{}'::jsonb),
         '{aiUsage}',
         jsonb_build_object('month', $2::text,
           'count', GREATEST(0, COALESCE((data->'aiUsage'->>'count')::int, 0) - 1))
       ),
       updated_at = $3
     WHERE workspace_id = $1 AND (data->'aiUsage'->>'month') = $2::text`,
    [workspaceId, month, now.toISOString()],
  );
}

export async function incrementAiUsage(workspaceId: string, now: Date): Promise<number> {
  const month = monthKey(now);
  const ts = now.toISOString();
  const res = await pgPool().query<{ count: number }>(
    `INSERT INTO workspace_business (workspace_id, data, created_at, updated_at)
     VALUES ($1, jsonb_build_object('aiUsage', jsonb_build_object('month', $2::text, 'count', 1)), $3, $3)
     ON CONFLICT (workspace_id) DO UPDATE SET
       data = jsonb_set(
         COALESCE(workspace_business.data, '{}'::jsonb),
         '{aiUsage}',
         CASE
           WHEN (workspace_business.data->'aiUsage'->>'month') = $2::text
             THEN jsonb_build_object('month', $2::text, 'count', COALESCE((workspace_business.data->'aiUsage'->>'count')::int, 0) + 1)
           ELSE jsonb_build_object('month', $2::text, 'count', 1)
         END
       ),
       updated_at = $3
     RETURNING (data->'aiUsage'->>'count')::int AS count`,
    [workspaceId, month, ts],
  );
  return res.rows[0]?.count ?? 1;
}
