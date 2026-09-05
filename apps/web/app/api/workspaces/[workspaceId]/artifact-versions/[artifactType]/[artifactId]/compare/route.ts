import { NextRequest, NextResponse } from "next/server";
import { artifactTypeSchema, compareArtifactVersionsRequestSchema } from "@onevyrt/contracts";
import { compareArtifactVersions, ArtifactVersionNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; artifactType: string; artifactId: string };
}

// A computation route, same reasoning as the formula compute and funnel
// requirements routes: the diff is derived fresh from two stored
// snapshots, never itself persisted.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const artifactType = artifactTypeSchema.safeParse(params.artifactType);
  if (!artifactType.success) {
    return NextResponse.json({ error: "Invalid artifact type" }, { status: 400 });
  }

  const parsed = compareArtifactVersionsRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const comparison = await compareArtifactVersions(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      artifactType: artifactType.data,
      artifactId: params.artifactId,
      fromVersion: parsed.data.fromVersion,
      toVersion: parsed.data.toVersion,
    });
    return NextResponse.json({ comparison });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ArtifactVersionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
