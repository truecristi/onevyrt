/**
 * The Transformation Report, compiled fresh for the caller's workspace (see
 * lib/reports/transformation-report.ts). Any workspace member may view it —
 * the same bar the rest of Business OS uses (e.g. api/business/constraint's
 * "any member reads, owner/manager saves") — since every input this report
 * reads is already visible to any member elsewhere in the app.
 *
 * Rate-limited to 1 per hour per user: assembling it touches ~8 separate
 * reads, and it's the one report expensive enough to deserve a real limit
 * rather than the lighter per-endpoint ones already used elsewhere (e.g.
 * data-export's 5/hour). This limits the compile-and-return action alone —
 * the Export-to-PDF button reuses whatever this call already returned
 * client-side, and Share/Email (their own routes, their own limits) don't
 * recompile through here either — so one page load still gets a fully
 * working export/share/email session even under the strict limit.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getTransformationReport } from "../../../../lib/reports/transformation-report";
import { checkRateLimit, rateLimitHeaders } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

const REPORT_LIMIT = { windowMs: 3_600_000, max: 1 };

export const GET = withRouteLogging("api/account/transformation-report:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const rl = await checkRateLimit(`transformation-report:${user.id}`, REPORT_LIMIT);
  if (!rl.allowed) {
    return json(
      { error: "You've already generated your Transformation Report this hour — try again later." },
      429,
      rateLimitHeaders(rl),
    );
  }

  const report = await getTransformationReport(wsId, user.id);
  return json({ report }, 200, rateLimitHeaders(rl));
});
