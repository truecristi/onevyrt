/**
 * POST /api/analytics/feature-attempt
 * Record a single feature access attempt for analytics and personalized upselling.
 */

import { currentUser } from "../../../../lib/auth";
import { pgPool } from "../../../../lib/db";
import type { NextRequest } from "next/server";

interface FeatureAttemptBody {
  featureId: string;
  workspaceId: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser(req.headers.get("cookie"));
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json()) as FeatureAttemptBody;
    if (!body.featureId || !body.workspaceId) {
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

    // Record the attempt (non-blocking, best-effort)
    pgPool()
      .query(
        `INSERT INTO feature_access_attempts (workspace_id, user_id, feature_id, attempted_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [body.workspaceId, user.id, body.featureId, body.timestamp]
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
