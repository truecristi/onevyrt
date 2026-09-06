/**
 * Unauthenticated health probe (Ch.090). Two modes, both safe to poll from
 * outside auth because neither returns internal state, paths, or user data:
 *
 *  - Liveness (default): uptime/version — "is the process up".
 *  - Readiness (`?ready`): also confirms the database is reachable, returning
 *    only ok/not-ok (503) with no error detail — so a load balancer can pull a
 *    container that's lost its DB without the endpoint leaking why.
 */
import { dbConfigured, pgPool } from "../../../lib/db";
import pkg from "../../../package.json";

export const runtime = "nodejs";

const startedAt = Date.now();
const json = (b: unknown, s = 200): Response =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

export async function GET(req: Request): Promise<Response> {
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0";

  if (new URL(req.url).searchParams.get("ready") !== null) {
    if (!dbConfigured()) return json({ ok: true, db: "not-configured", version });
    try {
      await pgPool().query("SELECT 1");
      return json({ ok: true, db: "up", version });
    } catch {
      return json({ ok: false, db: "down", version }, 503);
    }
  }

  return json({ ok: true, uptimeSec: Math.floor((Date.now() - startedAt) / 1000), version });
}
