import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getServerContext } from "@/lib/server";

/**
 * §13: "Health endpoints distinguish process health, dependency readiness
 * and deployment version." Never hardcodes "ok" - it actually pings the
 * database, and reports plainly if that fails rather than swallowing it.
 *
 * Forced dynamic: without this, Next statically renders a route with no
 * cookies/headers/searchParams access at build time and serves that one
 * frozen response forever - which for a health check would mean it always
 * reports whatever the database looked like during `next build`, never
 * the live state.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let databaseReachable = false;
  let databaseError: string | undefined;

  try {
    const { db } = getServerContext();
    await db.execute(sql`select 1`);
    databaseReachable = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Unknown database error";
  }

  const body = {
    process: "ok" as const,
    database: databaseReachable ? ("ok" as const) : ("unreachable" as const),
    databaseError,
    version: process.env.npm_package_version ?? "0.0.0",
    checkedInMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, { status: databaseReachable ? 200 : 503 });
}
