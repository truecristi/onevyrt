/**
 * POST /api/admin/free-access/enable
 *
 * Admin-only endpoint to enable free-access mode for a workspace.
 * Free-access mode bypasses all programme gates and auto-approves submissions.
 *
 * Request body:
 * {
 *   "workspaceId": "workspace-hex-id",
 *   "expiresAt": "2026-10-03T12:00:00Z"  // ISO 8601 datetime
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Free-access enabled until 2026-10-03T12:00:00Z",
 *   "workspaceId": "workspace-hex-id",
 *   "expiresAt": "2026-10-03T12:00:00Z"
 * }
 */

import { requireAdmin } from "@/lib/admin";
import { enableFreeAccessMode, clearFreeAccessCache } from "@/lib/free-access-mode";
import { getWorkspace } from "@/lib/workspaces";

interface EnableFreeAccessRequest {
  workspaceId: string;
  expiresAt: string; // ISO 8601
}

export async function POST(
  req: Request,
): Promise<Response> {
  try {
    // 1. Auth check: admin only
    const user = await requireAdmin(req.headers.get("cookie"));
    if (!user) {
      return Response.json(
        { success: false, message: "Unauthorized: admin access required" },
        { status: 403 },
      );
    }

    // 2. Parse and validate request
    const body: EnableFreeAccessRequest = await req.json();
    if (!body.workspaceId || !body.expiresAt) {
      return Response.json(
        {
          success: false,
          message: "Missing required fields: workspaceId, expiresAt",
        },
        { status: 400 },
      );
    }

    // 3. Validate ISO 8601 timestamp
    const expiry = new Date(body.expiresAt);
    if (isNaN(expiry.getTime())) {
      return Response.json(
        {
          success: false,
          message: "Invalid expiresAt: must be valid ISO 8601 datetime (e.g., 2026-10-03T12:00:00Z)",
        },
        { status: 400 },
      );
    }

    // 4. Prevent backdating (expiry must be in the future)
    if (expiry <= new Date()) {
      return Response.json(
        {
          success: false,
          message: "Invalid expiresAt: must be in the future",
        },
        { status: 400 },
      );
    }

    // 5. Verify workspace exists
    try {
      await getWorkspace(body.workspaceId);
    } catch (error) {
      return Response.json(
        { success: false, message: "Workspace not found" },
        { status: 404 },
      );
    }

    // 6. Enable free-access in database
    const success = await enableFreeAccessMode(body.workspaceId, body.expiresAt);

    if (!success) {
      return Response.json(
        { success: false, message: "Failed to update workspace" },
        { status: 500 },
      );
    }

    // 7. Clear cache to ensure next check hits fresh data
    clearFreeAccessCache(body.workspaceId);

    // 8. Return success response
    return Response.json(
      {
        success: true,
        message: `Free-access enabled until ${body.expiresAt}`,
        workspaceId: body.workspaceId,
        expiresAt: body.expiresAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[free-access] Error in enable route:", error);
    return Response.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
