import { NextRequest, NextResponse } from "next/server";
import { artifactTypeSchema, snapshotArtifactVersionRequestSchema } from "@onevyrt/contracts";
import {
  snapshotArtifactVersion,
  listArtifactVersions,
  ArtifactNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; artifactType: string; artifactId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const artifactType = artifactTypeSchema.safeParse(params.artifactType);
  if (!artifactType.success) {
    return NextResponse.json({ error: "Invalid artifact type" }, { status: 400 });
  }

  const { db } = getServerContext();

  try {
    const versions = await listArtifactVersions(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      artifactType: artifactType.data,
      artifactId: params.artifactId,
    });
    return NextResponse.json({ versions });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

// A dedicated action route rather than folding into an offer/customer-profile
// PATCH: snapshotting is a deliberate "save this state as a version" step
// (see artifact-version-use-cases.ts's doc comment), not a side effect of
// every edit.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

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

  const parsed = snapshotArtifactVersionRequestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const version = await snapshotArtifactVersion(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      artifactType: artifactType.data,
      artifactId: params.artifactId,
      changeNote: parsed.data.changeNote,
    });
    logger.info("artifact version snapshotted", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      artifactType: artifactType.data,
      artifactId: params.artifactId,
      version: version.version,
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ArtifactNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("artifact version snapshot failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to snapshot artifact version" }, { status: 500 });
  }
}
