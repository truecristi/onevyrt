import { currentUser } from "@/lib/auth";
import { listForUser } from "@/lib/workspaces";
import { pgPool } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

/**
 * POST /api/workspace/[id]/reflection-checkpoint
 *
 * Save a 90-day reflection checkpoint. Captures how the user's Why and Creed
 * have evolved over the quarter.
 *
 * Request body:
 * {
 *   whyEvolution: string,
 *   creedEvolution: string,
 *   keyInsights: string
 * }
 *
 * Returns: saved checkpoint with id, timestamps, etc.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headerList = await headers();
    const user = await currentUser(headerList.get("cookie"));
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify workspace membership
    const workspaces = await listForUser(user.id);
    const workspace = workspaces.find((w) => w.id === id);
    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    const body = await req.json();
    const { whyEvolution, creedEvolution, keyInsights } = body;

    if (!whyEvolution?.trim() || !creedEvolution?.trim() || !keyInsights?.trim()) {
      return new Response("All fields are required", { status: 400 });
    }

    // Get current why/creed
    const whyCreedResult = await pgPool().query(
      `SELECT why, creed FROM workspace_why_creed
       WHERE workspace_id = $1 AND deleted_at IS NULL`,
      [id]
    );

    const previousWhy = whyCreedResult.rows[0]?.why || "";
    const previousCreed = whyCreedResult.rows[0]?.creed || "";

    // Insert checkpoint
    const checkpointId = randomUUID();
    const result = await pgPool().query(
      `INSERT INTO workspace_90day_reflections (
        id,
        workspace_id,
        user_id,
        previous_why,
        previous_creed,
        why_evolution,
        creed_evolution,
        key_insights,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, workspace_id, previous_why, previous_creed,
        why_evolution, creed_evolution, key_insights, created_at`,
      [
        checkpointId,
        id,
        user.id,
        previousWhy,
        previousCreed,
        whyEvolution,
        creedEvolution,
        keyInsights,
      ]
    );

    const checkpoint = result.rows[0];

    return Response.json({
      id: checkpoint.id,
      workspaceId: checkpoint.workspace_id,
      previousWhy: checkpoint.previous_why,
      previousCreed: checkpoint.previous_creed,
      whyEvolution: checkpoint.why_evolution,
      creedEvolution: checkpoint.creed_evolution,
      keyInsights: checkpoint.key_insights,
      createdAt: checkpoint.created_at.toISOString(),
    });
  } catch (error) {
    console.error("Reflection checkpoint error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

/**
 * GET /api/workspace/[id]/reflection-checkpoint
 *
 * Get the latest reflection checkpoint and history for a workspace.
 *
 * Returns:
 * {
 *   latest: checkpoint | null,
 *   history: checkpoint[],
 *   nextReminderAt: ISO string
 * }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headerList = await headers();
    const user = await currentUser(headerList.get("cookie"));
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify workspace membership
    const workspaces = await listForUser(user.id);
    const workspace = workspaces.find((w) => w.id === id);
    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    // Get latest checkpoint
    const latestResult = await pgPool().query(
      `SELECT id, workspace_id, previous_why, previous_creed,
         why_evolution, creed_evolution, key_insights, created_at
       FROM workspace_90day_reflections
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    const latest = latestResult.rows[0] || null;

    // Get all checkpoints (history)
    const historyResult = await pgPool().query(
      `SELECT id, workspace_id, previous_why, previous_creed,
         why_evolution, creed_evolution, key_insights, created_at
       FROM workspace_90day_reflections
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [id]
    );

    // Calculate next reminder (90 days from latest)
    let nextReminderAt = null;
    if (latest) {
      const latestDate = new Date(latest.created_at);
      const nextDate = new Date(latestDate);
      nextDate.setDate(nextDate.getDate() + 90);
      nextReminderAt = nextDate.toISOString();
    }

    return Response.json({
      latest: latest
        ? {
            id: latest.id,
            workspaceId: latest.workspace_id,
            previousWhy: latest.previous_why,
            previousCreed: latest.previous_creed,
            whyEvolution: latest.why_evolution,
            creedEvolution: latest.creed_evolution,
            keyInsights: latest.key_insights,
            createdAt: latest.created_at.toISOString(),
          }
        : null,
      history: historyResult.rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        previousWhy: row.previous_why,
        previousCreed: row.previous_creed,
        whyEvolution: row.why_evolution,
        creedEvolution: row.creed_evolution,
        keyInsights: row.key_insights,
        createdAt: row.created_at.toISOString(),
      })),
      nextReminderAt,
    });
  } catch (error) {
    console.error("Failed to get reflection checkpoints:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
