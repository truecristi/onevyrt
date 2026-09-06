import { NextRequest, NextResponse } from "next/server";
import { createProgramVersionRequestSchema } from "@onevyrt/contracts";
import {
  createProgramVersion,
  listProgramVersions,
  ProgramNotFoundError,
  DuplicateProgramVersionError,
} from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const versions = await listProgramVersions(db, {
    actorUserId: user.id,
    programId: params.programId,
  });
  return NextResponse.json({ versions });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = createProgramVersionRequestSchema.safeParse(
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
    const version = await createProgramVersion(db, {
      actorUserId: user.id,
      programId: params.programId,
      ...parsed.data,
    });
    logger.info("program version created", {
      correlationId,
      userId: user.id,
      programId: params.programId,
      versionId: version.id,
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProgramNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DuplicateProgramVersionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("program version creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create program version" }, { status: 500 });
  }
}
