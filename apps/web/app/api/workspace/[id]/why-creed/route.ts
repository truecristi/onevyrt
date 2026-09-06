/**
 * GET /api/workspace/[id]/why-creed — Get why and creed for a workspace
 * POST /api/workspace/[id]/why-creed — Save why and creed for a workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listForUser } from "@/lib/workspaces";
import { getWhyAndCreed, saveWhyAndCreed } from "@/lib/dashboard/why-creed";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await currentUser(request.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaces = await listForUser(user.id);
    const workspace = workspaces.find((ws) => ws.id === id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await getWhyAndCreed(id);
    return NextResponse.json(
      data || { workspaceId: id, why: "", creed: "" }
    );
  } catch (error) {
    console.error("GET /api/workspace/[id]/why-creed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await currentUser(request.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaces = await listForUser(user.id);
    const workspace = workspaces.find((ws) => ws.id === id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { why = "", creed = "" } = body;

    if (typeof why !== "string" || typeof creed !== "string") {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    const data = await saveWhyAndCreed(id, why, creed);
    return NextResponse.json(data);
  } catch (error) {
    console.error("POST /api/workspace/[id]/why-creed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
