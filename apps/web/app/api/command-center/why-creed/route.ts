/**
 * GET /api/command-center/why-creed — Get the current user's workspace why & creed
 * POST /api/command-center/why-creed — Save the current user's workspace why & creed
 *
 * Wrapper route that fetches/saves the user's why/creed from their first workspace.
 * Automatically resolves the workspace ID from the current user's workspace list.
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { listForUser } from "../../../../lib/workspaces";
import { getWhyAndCreed, saveWhyAndCreed } from "../../../../lib/dashboard/why-creed";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaces = await listForUser(user.id);
    // Use the first workspace (primary workspace)
    const [workspace] = workspaces;
    if (!workspace) {
      return NextResponse.json(
        { workspaceId: "", why: "", creed: "" },
        { status: 200 }
      );
    }

    const data = await getWhyAndCreed(workspace.id);

    return NextResponse.json(
      data || { workspaceId: workspace.id, why: "", creed: "" }
    );
  } catch (error) {
    console.error("GET /api/command-center/why-creed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser(request.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaces = await listForUser(user.id);
    // Use the first workspace (primary workspace)
    const [workspace] = workspaces;
    if (!workspace) {
      return NextResponse.json(
        { error: "No workspace found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { why = "", creed = "" } = body;

    if (typeof why !== "string" || typeof creed !== "string") {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    const data = await saveWhyAndCreed(workspace.id, why, creed);

    return NextResponse.json(data);
  } catch (error) {
    console.error("POST /api/command-center/why-creed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
