/**
 * Manual/HTTP trigger for the coach digest (the proactive-alert counterpart to
 * the /admin/learners console). The digest normally fires on its own as a job on
 * the cron tick (see lib/jobs.ts, key "coach_digest") — this route lets a host
 * cron hit it directly, or a signed-in platform admin fire it by hand, using the
 * same shared logic (lib/coach/digest-run). Emails INTERNAL recipients only
 * (admins + mentors); learners are never on this list.
 *
 * Gated exactly like /api/cron/tick: an unconfigured CRON_SECRET is a hard 503;
 * a matching x-cron-secret passes; otherwise a signed-in admin cookie passes.
 */
import { timingSafeEqual } from "node:crypto";
import { requireAdmin } from "../../../../lib/admin";
import { runCoachDigest } from "../../../../lib/coach/digest-run";
import { withRouteLogging } from "../../../../lib/logger";
import { validateCsrf } from "../../../../lib/middleware/csrf";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Constant-time, same reasoning as /api/cron/tick's comparison — a plain
 *  !== leaks how many leading bytes matched through response timing. */
function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a), bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export const POST = withRouteLogging("api/cron/digest:POST", async (req: Request): Promise<Response> => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET is not configured on this server." }, 503);
  const provided = req.headers.get("x-cron-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    // Falling back to a signed-in admin's session cookie — the one path here
    // a forged cross-site request could ride (the shared-secret path above
    // never touches cookies at all). This route is exempt from the central
    // CSRF check in proxy.ts specifically because of this mixed auth shape —
    // see docs/CSRF_ROUTE_AUDIT.md — so the fallback branch checks for itself.
    const csrfError = await validateCsrf(req);
    if (csrfError) return csrfError;
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);
  }

  const result = await runCoachDigest();
  return json(result);
});
