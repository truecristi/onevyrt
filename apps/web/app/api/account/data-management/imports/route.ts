/**
 * Data import API: initiate and track data imports (users, funnels, learners).
 *
 * GET: Get import history for a workspace
 * POST: Initiate a new import
 */

import { currentUser } from "../../../../../lib/auth";
import { listForUser, roleOf } from "../../../../../lib/workspaces";
import { checkRateLimit, rateLimitHeaders } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";
import {
  createImportRecord,
  getImportHistory,
  parseCSV,
  validateCSVStructure,
} from "../../../../../lib/data-management/imports";
import type { ImportType } from "../../../../../lib/data-management/imports";

const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

export const GET = withRouteLogging("api/account/data-management/imports:GET", async (req: Request): Promise<Response> => {
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

  const { records, total } = await getImportHistory(workspaceId, limit, offset);

  return json({
    records,
    total,
    limit,
    offset,
  });
});

export const POST = withRouteLogging("api/account/data-management/imports:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const rl = await checkRateLimit(`data-import:${user.id}`, { windowMs: 3_600_000, max: 10 });
  if (!rl.allowed) return json({ error: "too many import requests — try again later" }, 429, rateLimitHeaders(rl));

  const formData = await req.formData();
  const workspaceId = formData.get("workspaceId") as string;
  const importType = formData.get("importType") as string;
  const file = formData.get("file") as File;

  if (!workspaceId || !importType || !file) {
    return json({ error: "workspaceId, importType, and file required" }, 400);
  }

  if (!["users", "funnels", "learners"].includes(importType)) {
    return json({ error: "importType must be users, funnels, or learners" }, 400);
  }

  const workspaces = await listForUser(user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  // Check that user is owner or manager
  const role = await roleOf(workspaceId, user.id);
  if (role !== "owner" && role !== "manager") {
    return json({ error: "insufficient permissions" }, 403);
  }

  try {
    const fileSize = file.size;
    const fileContent = await file.text();

    // Parse CSV
    const { headers, rows } = parseCSV(fileContent);

    // Validate CSV structure
    const validation = validateCSVStructure(importType as ImportType, headers);
    if (!validation.isValid) {
      return json(
        { error: "Invalid CSV structure", details: validation.errors },
        400
      );
    }

    // Create import record
    const importRecord = await createImportRecord(
      workspaceId,
      user.id,
      importType as ImportType,
      file.name,
      fileSize,
      rows.length,
      { headers }
    );

    return json({
      id: importRecord.id,
      status: "processing",
      message: "Import initiated. Processing your data...",
      totalRows: rows.length,
    }, 202); // 202 Accepted
  } catch (error) {
    console.error("Import error:", error);
    return json({ error: "failed to initiate import" }, 500);
  }
});
