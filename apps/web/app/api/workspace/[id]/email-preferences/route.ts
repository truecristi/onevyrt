/**
 * GET /api/workspace/[id]/email-preferences
 * POST /api/workspace/[id]/email-preferences
 *
 * GET: Fetch email preferences for a workspace
 * POST: Update email preferences for a workspace
 *
 * Requires workspace membership (workspace owner/manager can update).
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listForUser } from "@/lib/workspaces";
import {
  getEmailPreferences,
  updateEmailPreferences,
  resetToDefaults,
} from "@/lib/email-preferences";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const user = await currentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workspaceId } = await params;

    // Verify user has access to this workspace (read-only check)
    const workspaces = await listForUser(user.id);
    const workspace = workspaces.find((ws) => ws.id === workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // Get and return email preferences
    const preferences = await getEmailPreferences(workspaceId);
    return NextResponse.json(preferences);
  } catch (error) {
    console.error("[GET /api/workspace/[id]/email-preferences]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const user = await currentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workspaceId } = await params;

    // Verify user has write access (owner or manager role)
    const workspaces = await listForUser(user.id);
    const workspace = workspaces.find((ws) => ws.id === workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // Check user has write permission (owner or manager)
    const member = workspace.members.find((m) => m.userId === user.id);
    if (!member || !["owner", "manager"].includes(member.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();

    // Handle reset-to-defaults request
    if (body.resetToDefaults === true) {
      const reset = await resetToDefaults(workspaceId);
      return NextResponse.json(reset);
    }

    // Validate and update partial preferences
    const updates = body;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No preferences to update" }, { status: 400 });
    }

    // Update email preferences
    const updated = await updateEmailPreferences(workspaceId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST /api/workspace/[id]/email-preferences]", error);
    if (error instanceof Error && error.message.includes("Invalid preference field")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
