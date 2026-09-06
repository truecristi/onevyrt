import { NextRequest, NextResponse } from "next/server";
import { updateProgramRequestSchema } from "@onevyrt/contracts";
import { updateProgram, ProgramNotFoundError } from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = updateProgramRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  // exactOptionalPropertyTypes: strip keys Zod left as `undefined` (field
  // not provided) rather than spreading them - same pattern as the
  // offers/business-metrics PATCH routes.
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const program = await updateProgram(db, {
      actorUserId: user.id,
      programId: params.programId,
      ...patch,
    });
    logger.info("program updated", { correlationId, userId: user.id, programId: program.id });
    return NextResponse.json({ program });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProgramNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("program update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
  }
}
