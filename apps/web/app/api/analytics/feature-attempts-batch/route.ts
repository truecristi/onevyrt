/**
 * POST /api/analytics/feature-attempts-batch
 * Record multiple feature access attempts for analytics and personalized email campaigns.
 * Used to send aggregated attempt data for upsell targeting.
 */

import { currentUser } from "../../../../lib/auth";
import { pgPool } from "../../../../lib/db";
import type { NextRequest } from "next/server";

interface LockedFeatureAttempt {
  featureId: string;
  attemptedAt: string;
  count: number;
  lastAttemptedAt: string;
}

interface FeatureAttemptsBatchBody {
  userId: string;
  workspaceId: string;
  attempts: LockedFeatureAttempt[];
  sentAt: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser(req.headers.get("cookie"));
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json()) as FeatureAttemptsBatchBody;
    if (!body.workspaceId || !Array.isArray(body.attempts)) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Verify workspace membership
    const wsRes = await pgPool().query(
      `SELECT 1 FROM workspaces_users WHERE workspace_id = $1 AND user_id = $2`,
      [body.workspaceId, user.id]
    );
    if (!wsRes.rowCount) {
      return new Response("Forbidden", { status: 403 });
    }

    // Record batch (non-blocking, best-effort)
    pgPool()
      .query(
        `INSERT INTO feature_access_attempts_batch (workspace_id, user_id, attempts_json, recorded_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET
           attempts_json = EXCLUDED.attempts_json,
           recorded_at = EXCLUDED.recorded_at`,
        [
          body.workspaceId,
          user.id,
          JSON.stringify(body.attempts),
          body.sentAt,
        ]
      )
      .catch(() => {
        // Silently ignore errors - analytics is non-critical
      });

    return new Response("OK", { status: 200 });
  } catch {
    // Silently ignore errors - analytics is non-critical
    return new Response("OK", { status: 200 });
  }
}
