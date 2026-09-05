import { NextRequest, NextResponse } from "next/server";
import { loginRequestSchema } from "@onevyrt/contracts";
import { loginUser, InvalidCredentialsError } from "@onevyrt/domain";
import { RateLimiter } from "@onevyrt/security";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { requireCsrf } from "@/lib/csrf";
import { setSessionCookie } from "@/lib/session";
import { getClientIdentifier } from "@/lib/client-ip";

// §11 rate limit: 10 login attempts per IP per 15 minutes - looser than
// register since legitimate users mistype passwords more often than they
// register twice.
const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);

export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const ip = getClientIdentifier(request);
  if (!loginLimiter.check(`login:${ip}`)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = loginRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { env, db } = getServerContext();

  try {
    const result = await loginUser(db, env.AUTH_SECRET, parsed.data);
    setSessionCookie(result.sessionToken);
    logger.info("user logged in", { correlationId, userId: result.user.id });

    return NextResponse.json({ user: result.user });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    logger.error("login failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
