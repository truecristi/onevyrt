/**
 * Cron entry point: intended to be hit periodically by host-level cron
 * (the same pattern already used for healthcheck-alert.sh/error-alert.sh —
 * see repo root), since this app runs as a single container with no
 * separate worker process. Protected by a shared secret rather than a
 * user session, because there is no user on the other end of a cron job.
 */
import { timingSafeEqual } from "node:crypto";
import { runDueJobs } from "../../../../lib/jobs";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Constant-time, same reasoning as verifyStripeSignature/changePassword's
 *  comparisons elsewhere — a plain !== leaks how many leading bytes matched
 *  through response timing. */
function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a), bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export const POST = withRouteLogging("api/cron/tick:POST", async (req: Request): Promise<Response> => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET is not configured on this server." }, 503);
  const provided = req.headers.get("x-cron-secret");
  if (!provided || !secretsMatch(provided, secret)) return json({ error: "unauthorized" }, 401);

  const results = await runDueJobs();
  return json({ ok: true, results });
});
