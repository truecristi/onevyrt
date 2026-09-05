import { NextRequest, NextResponse } from "next/server";
import { publishProgramVersion, ProgramVersionNotFoundError } from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string; versionId: string };
}

// A dedicated action route rather than a generic PATCH on the version:
// publishing has a side effect (archiving the previously-published
// version of the same program) beyond setting one field - see the doc
// comment on curriculum-use-cases.ts's publishProgramVersion.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { db } = getServerContext();

  try {
    const version = await publishProgramVersion(db, {
      actorUserId: user.id,
      programId: params.programId,
      programVersionId: params.versionId,
    });
    logger.info("program version published", {
      correlationId,
      userId: user.id,
      programId: params.programId,
      versionId: version.id,
    });
    return NextResponse.json({ version });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProgramVersionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("program version publish failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to publish program version" }, { status: 500 });
  }
}
