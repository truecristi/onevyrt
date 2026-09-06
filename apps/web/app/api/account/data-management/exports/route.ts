/**
 * Enhanced data export API: multiple formats (JSON/CSV/PDF), selective export,
 * and export history tracking.
 *
 * GET: Get export history for the workspace
 * POST: Initiate a new export (manual)
 */

import { currentUser } from "../../../../../lib/auth";
import { listForUser } from "../../../../../lib/workspaces";
import { checkRateLimit, rateLimitHeaders } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";
import { logExport, logExportFailure, getExportHistory } from "../../../../../lib/data-management/exports";
import { withAdvisoryLock, pgPool } from "../../../../../lib/db";

const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

export const GET = withRouteLogging("api/account/data-management/exports:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) return json({ error: "workspaceId required" }, 400);

  const workspaces = await listForUser(user.id);
  if (!workspaces.find((w) => w.id === workspaceId)) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const { records, total } = await getExportHistory(workspaceId, limit, offset);

  return json({
    records,
    total,
    limit,
    offset,
  });
});

export const POST = withRouteLogging("api/account/data-management/exports:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const rl = await checkRateLimit(`data-export:${user.id}`, { windowMs: 3_600_000, max: 5 });
  if (!rl.allowed) return json({ error: "too many export requests — try again later" }, 429, rateLimitHeaders(rl));

  const body = await req.json() as any;
  const { workspaceId, format, exportType, selectedCategories } = body;

  if (!workspaceId || !format || !exportType) {
    return json({ error: "workspaceId, format, and exportType required" }, 400);
  }

  if (!["json", "csv", "pdf"].includes(format)) {
    return json({ error: "format must be json, csv, or pdf" }, 400);
  }

  if (!["full", "selective"].includes(exportType)) {
    return json({ error: "exportType must be full or selective" }, 400);
  }

  const workspaces = await listForUser(user.id);
  if (!workspaces.find((w) => w.id === workspaceId)) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  try {
    // Log the export initiation
    const categories = exportType === "selective" && Array.isArray(selectedCategories) ? selectedCategories : [];
    const exportRecord = await withAdvisoryLock(`export:${workspaceId}`, async (locked) => {
      return logExport(
        locked,
        workspaceId,
        user.id,
        format as "json" | "csv" | "pdf",
        exportType as "full" | "selective",
        categories,
        0, // Size will be updated after export completes
        undefined, // URL will be set after file is generated
        // Set expiration to 30 days from now
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
    });

    return json({
      id: exportRecord.id,
      status: "processing",
      message: "Export initiated. You will receive a notification when ready.",
    });
  } catch (error) {
    console.error("Export error:", error);
    const categories = exportType === "selective" && Array.isArray(selectedCategories) ? selectedCategories : [];
    await logExportFailure(
      pgPool(),
      workspaceId,
      user.id,
      format as "json" | "csv" | "pdf",
      exportType as "full" | "selective",
      categories,
      error instanceof Error ? error.message : String(error)
    ).catch((logErr) => console.error("Failed to log export failure:", logErr));
    return json({ error: "failed to initiate export" }, 500);
  }
});
