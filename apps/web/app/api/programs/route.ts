import { NextRequest, NextResponse } from "next/server";
import { createProgramRequestSchema } from "@onevyrt/contracts";
import { createProgram, listPrograms, DuplicateProgramSlugError } from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

// Not workspace-scoped: curriculum is platform-wide content (see the doc
// comment on schema.ts's programs table). Any authenticated user can list
// it - listPrograms itself decides how much to show (a platform admin
// sees every status, everyone else only "published").
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const programs = await listPrograms(db, { actorUserId: user.id });
  return NextResponse.json({ programs });
}

export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = createProgramRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const program = await createProgram(db, { actorUserId: user.id, ...parsed.data });
    logger.info("program created", { correlationId, userId: user.id, programId: program.id });
    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateProgramSlugError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("program creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to create program" }, { status: 500 });
  }
}
