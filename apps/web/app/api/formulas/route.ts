import { NextRequest, NextResponse } from "next/server";
import { createFormulaDefinitionRequestSchema } from "@onevyrt/contracts";
import {
  createFormulaDefinition,
  listFormulaDefinitions,
  DuplicateFormulaVersionError,
  FormulaImplementationNotFoundError,
} from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

// Not workspace-scoped: the formula library is platform-wide content
// (schema.ts's formulaDefinitions doc comment), same as /api/programs.
// Any authenticated user can list it - listFormulaDefinitions itself
// decides how much to show (a platform admin sees every status,
// everyone else only "published").
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const key = request.nextUrl.searchParams.get("key");
  const formulas = await listFormulaDefinitions(db, {
    actorUserId: user.id,
    ...(key !== null ? { key } : {}),
  });
  return NextResponse.json({ formulas });
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

  const parsed = createFormulaDefinitionRequestSchema.safeParse(
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
    const formula = await createFormulaDefinition(db, { actorUserId: user.id, ...parsed.data });
    logger.info("formula definition created", {
      correlationId,
      userId: user.id,
      formulaDefinitionId: formula.id,
    });
    return NextResponse.json({ formula }, { status: 201 });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateFormulaVersionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof FormulaImplementationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("formula definition creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create formula definition" }, { status: 500 });
  }
}
