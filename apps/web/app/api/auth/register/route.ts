import { NextRequest, NextResponse } from "next/server";
import { registerRequestSchema } from "@onevyrt/contracts";
import { registerUser, EmailAlreadyRegisteredError } from "@onevyrt/domain";
import { RateLimiter } from "@onevyrt/security";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { requireCsrf } from "@/lib/csrf";
import { setSessionCookie } from "@/lib/session";
import { getClientIdentifier } from "@/lib/client-ip";

// §11 rate limit: 5 registration attempts per IP per 15 minutes. In-memory
// per §RateLimiter's own documented limitation (not durable, single
// instance) - matches Phase 1's stated scope.
const registerLimiter = new RateLimiter(5, 15 * 60 * 1000);

export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const ip = getClientIdentifier(request);
  if (!registerLimiter.check(`register:${ip}`)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = registerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { env, db } = getServerContext();

  try {
    const result = await registerUser(db, env.AUTH_SECRET, parsed.data);
    setSessionCookie(result.sessionToken);
    logger.info("user registered", { correlationId, userId: result.user.id });

    return NextResponse.json({ user: result.user, workspace: result.workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("registration failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
