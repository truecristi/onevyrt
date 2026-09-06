import { NextRequest, NextResponse } from "next/server";
import { publishFormulaDefinition, FormulaDefinitionNotFoundError } from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { formulaDefinitionId: string };
}

// A dedicated action route rather than a generic PATCH: publishing has a
// side effect (archiving the previously-published version of the same
// key) beyond setting one field - see publishFormulaDefinition's doc
// comment, same reasoning as the program-version publish route.
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
    const formula = await publishFormulaDefinition(db, {
      actorUserId: user.id,
      formulaDefinitionId: params.formulaDefinitionId,
    });
    logger.info("formula definition published", {
      correlationId,
      userId: user.id,
      formulaDefinitionId: formula.id,
    });
    return NextResponse.json({ formula });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FormulaDefinitionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("formula definition publish failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to publish formula definition" }, { status: 500 });
  }
}
