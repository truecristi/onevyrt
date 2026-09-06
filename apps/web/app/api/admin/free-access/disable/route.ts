/**
 * POST /api/admin/free-access/disable
 *
 * Admin-only endpoint to disable free-access mode for a workspace.
 * Restores normal programme gating and submission review requirements.
 *
 * Request body:
 * {
 *   "workspaceId": "workspace-hex-id"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Free-access disabled",
 *   "workspaceId": "workspace-hex-id"
 * }
 */

import { requireAdmin } from "@/lib/admin";
import { disableFreeAccessMode, clearFreeAccessCache } from "@/lib/free-access-mode";
import { getWorkspace } from "@/lib/workspaces";

interface DisableFreeAccessRequest {
  workspaceId: string;
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
    const body: DisableFreeAccessRequest = await req.json();
    if (!body.workspaceId) {
      return Response.json(
        {
          success: false,
          message: "Missing required field: workspaceId",
        },
        { status: 400 },
      );
    }

    // 3. Verify workspace exists
    try {
      await getWorkspace(body.workspaceId);
    } catch (error) {
      return Response.json(
        { success: false, message: "Workspace not found" },
        { status: 404 },
      );
    }

    // 4. Disable free-access in database
    const success = await disableFreeAccessMode(body.workspaceId);

    if (!success) {
      return Response.json(
        { success: false, message: "Failed to update workspace" },
        { status: 500 },
      );
    }

    // 5. Clear cache to ensure next check hits fresh data
    clearFreeAccessCache(body.workspaceId);

    // 6. Return success response
    return Response.json(
      {
        success: true,
        message: "Free-access disabled",
        workspaceId: body.workspaceId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[free-access] Error in disable route:", error);
    return Response.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
