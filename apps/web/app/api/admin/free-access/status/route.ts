/**
 * GET /api/admin/free-access/status?workspaceId=...
 *
 * Admin-only endpoint to check free-access status of a workspace.
 * Returns current status and expiry timestamp if active.
 *
 * Query parameters:
 * - workspaceId: The workspace to check
 *
 * Response:
 * {
 *   "success": true,
 *   "workspaceId": "workspace-hex-id",
 *   "isFreeAccess": true,
 *   "expiresAt": "2026-10-03T12:00:00Z",
 *   "expiresIn": "30 days",
 *   "message": "Free-access active"
 * }
 */

import { requireAdmin } from "@/lib/admin";
import { checkFreeAccessMode } from "@/lib/free-access-mode";
import { getWorkspace } from "@/lib/workspaces";

interface StatusResponse {
  success: boolean;
  workspaceId?: string;
  isFreeAccess?: boolean;
  expiresAt?: string;
  expiresIn?: string;
  message: string;
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs < 0) return "Expired";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"}${diffHours > 0 ? ` ${diffHours}h` : ""}`;
  }
  return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
}

export async function GET(req: Request): Promise<Response> {
  try {
    // 1. Auth check: admin only
    const user = await requireAdmin(req.headers.get("cookie"));
    if (!user) {
      const body: StatusResponse = { success: false, message: "Unauthorized: admin access required" };
      return Response.json(body, { status: 403 });
    }

    // 2. Parse query parameter
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      const body: StatusResponse = {
        success: false,
        message: "Missing required query parameter: workspaceId",
      };
      return Response.json(body, { status: 400 });
    }

    // 3. Verify workspace exists
    try {
      await getWorkspace(workspaceId);
    } catch (error) {
      const body: StatusResponse = { success: false, message: "Workspace not found" };
      return Response.json(body, { status: 404 });
    }

    // 4. Check free-access status
    const expiresAt = await checkFreeAccessMode(workspaceId);

    if (!expiresAt) {
      const body: StatusResponse = {
        success: true,
        workspaceId,
        isFreeAccess: false,
        message: "Free-access is not active",
      };
      return Response.json(body, { status: 200 });
    }

    // 5. Free-access is active
    const expiresIn = formatTimeRemaining(expiresAt);

    const body: StatusResponse = {
      success: true,
      workspaceId,
      isFreeAccess: true,
      expiresAt,
      expiresIn,
      message: `Free-access active (expires in ${expiresIn})`,
    };
    return Response.json(body, { status: 200 });
  } catch (error) {
    console.error("[free-access] Error in status route:", error);
    const body: StatusResponse = {
      success: false,
      message: "Internal server error",
    };
    return Response.json(body, { status: 500 });
  }
}
