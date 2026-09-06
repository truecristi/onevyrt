/**
 * Scheduled exports API: create, read, update, delete scheduled export configurations.
 *
 * GET: List scheduled exports for a workspace
 * POST: Create a new scheduled export
 */

import { currentUser } from "../../../../../lib/auth";
import { listForUser, roleOf } from "../../../../../lib/workspaces";
import { withRouteLogging } from "../../../../../lib/logger";
import {
  createScheduledExport,
  getScheduledExports,
} from "../../../../../lib/data-management/exports";
import type { ExportFormat } from "../../../../../lib/data-management/exports";

const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

export const GET = withRouteLogging("api/account/data-management/scheduled-exports:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) return json({ error: "workspaceId required" }, 400);

  const workspaces = await listForUser(user.id);
  if (!workspaces.find((w) => w.id === workspaceId)) {
    return json({ error: "workspace not found or access denied" }, 403);
  }

  const records = await getScheduledExports(workspaceId);
  return json({ records });
});

export const POST = withRouteLogging("api/account/data-management/scheduled-exports:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const body = await req.json() as any;
  const { workspaceId, name, format, selectedCategories, frequency, scheduleDayOrWeekday, scheduleHour, recipientEmail } = body;

  if (!workspaceId || !name || !format || !frequency || !recipientEmail) {
    return json({ error: "missing required fields" }, 400);
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
    const config = await createScheduledExport(workspaceId, user.id, {
      name,
      format: format as ExportFormat,
      selectedCategories: Array.isArray(selectedCategories) ? selectedCategories : [],
      frequency: frequency as "daily" | "weekly" | "monthly",
      scheduleDayOrWeekday,
      scheduleHour,
      recipientEmail,
    });

    return json(config, 201);
  } catch (error) {
    console.error("Failed to create scheduled export:", error);
    return json({ error: "failed to create scheduled export" }, 500);
  }
});
