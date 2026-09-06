/**
 * Backup management API: get backup history, stats, and manage backups.
 *
 * GET: Get backup records and statistics for a workspace
 * POST: Trigger a manual backup (owner-only)
 */

import { currentUser } from "../../../../../lib/auth";
import { listForUser } from "../../../../../lib/workspaces";
import { withRouteLogging } from "../../../../../lib/logger";
import {
  getBackups,
  getBackupStats,
  getLatestBackup,
  createBackupRecord,
} from "../../../../../lib/data-management/backups";

const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

export const GET = withRouteLogging("api/account/data-management/backups:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const includeStats = url.searchParams.get("includeStats") === "true";

  if (!workspaceId) return json({ error: "workspaceId required" }, 400);

  const workspaces = await listForUser(user.id);
  if (!workspaces.find((w) => w.id === workspaceId)) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  try {
    const { records, total } = await getBackups(workspaceId, limit, offset);
    const response: any = { records, total, limit, offset };

    if (includeStats) {
      response.stats = await getBackupStats(workspaceId);
      response.latest = await getLatestBackup(workspaceId);
    }

    return json(response);
  } catch (error) {
    console.error("Backup retrieval error:", error);
    return json({ error: "failed to retrieve backups" }, 500);
  }
});

export const POST = withRouteLogging("api/account/data-management/backups:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const body = await req.json() as any;
  const { workspaceId, includeMedia } = body;

  if (!workspaceId) return json({ error: "workspaceId required" }, 400);

  const workspaces = await listForUser(user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  // Only owners can trigger manual backups
  if (workspace.ownerId !== user.id) {
    return json({ error: "only workspace owners can trigger backups" }, 403);
  }

  try {
    const now = new Date();
    const storageLocation = `s3://onevyrt-backups/${workspaceId}/${now.getTime()}`;

    // Set retention to 90 days
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + 90);

    const backupRecord = await createBackupRecord(
      workspaceId,
      "manual",
      now,
      storageLocation,
      0, // Size will be updated after backup completes
      includeMedia ?? false,
      retentionUntil
    );

    return json({
      id: backupRecord.id,
      status: "processing",
      message: "Backup initiated. This may take several minutes.",
      estimatedCompletionTime: new Date(Date.now() + 10 * 60 * 1000), // ~10 mins
    }, 202); // 202 Accepted
  } catch (error) {
    console.error("Backup creation error:", error);
    return json({ error: "failed to initiate backup" }, 500);
  }
});
