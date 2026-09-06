/**
 * Transformation Report share links: create/inspect/revoke a 24-hour,
 * unauthenticated snapshot link at /share/transformation/[token]. Mirrors
 * api/projects/[id]/share's owner-only pattern — a share link exposes real
 * business numbers (revenue targets, the named constraint, the 90-day plan)
 * outside the app entirely, to anyone who gets the URL, which only the
 * workspace owner may decide to do.
 *
 * The HTML is rendered server-side from a freshly-compiled report (never
 * trusted from the client) — unlike the funnel-report share endpoint, this
 * report has no client-side simulation state the server can't already
 * reproduce itself, so there's nothing to gain from accepting client HTML
 * and a real security upside (no chance of an unrelated client-crafted body
 * ending up in the sandboxed-but-still-served snapshot).
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getTransformationReport, transformationReportToHtml } from "../../../../../lib/reports/transformation-report";
import { createTransformationReportShare, getActiveTransformationReportShare, revokeTransformationReportShare } from "../../../../../lib/reports/transformation-report-shares";
import { readSettings } from "../../../../../lib/settings";
import { recordActivity } from "../../../../../lib/activity";
import { checkRateLimit, rateLimitHeaders } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

async function requireOwner(req: Request): Promise<{ wsId: string; userId: string; email: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can share the Transformation Report." }, 403);
  return { wsId, userId: user.id, email: user.email };
}

function shareUrl(origin: string, token: string): string {
  return `${origin}/share/transformation/${token}`;
}

/** Whether this workspace currently has an active Transformation Report share link. */
export const GET = withRouteLogging("api/account/transformation-report/share:GET", async (req: Request): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;
  const active = await getActiveTransformationReportShare(scope.wsId);
  if (!active) return json({ active: null });
  const settings = await readSettings();
  const origin = settings.publicOrigin || new URL(req.url).origin;
  return json({ active: { url: shareUrl(origin, active.token), expiresAt: active.expiresAt } });
});

const SHARE_LIMIT = { windowMs: 3_600_000, max: 10 };

/** Compiles the current report server-side and stores it as a fresh
 *  24-hour share snapshot, replacing any link already active. */
export const POST = withRouteLogging("api/account/transformation-report/share:POST", async (req: Request): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;

  const rl = await checkRateLimit(`transformation-report-share:${scope.userId}`, SHARE_LIMIT);
  if (!rl.allowed) return json({ error: "Too many share links requested — try again later." }, 429, rateLimitHeaders(rl));

  const report = await getTransformationReport(scope.wsId, scope.userId);
  const html = transformationReportToHtml(report);
  const result = await createTransformationReportShare(scope.wsId, html);
  if ("error" in result) return json({ error: result.error }, 400);

  await recordActivity(scope.wsId, { actorEmail: scope.email, action: "transformation-report.share" });
  const settings = await readSettings();
  const origin = settings.publicOrigin || new URL(req.url).origin;
  return json({ url: shareUrl(origin, result.token), expiresAt: result.expiresAt });
});

/** Revokes whatever Transformation Report share link currently exists. */
export const DELETE = withRouteLogging("api/account/transformation-report/share:DELETE", async (req: Request): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;
  const revoked = await revokeTransformationReportShare(scope.wsId);
  if (revoked) await recordActivity(scope.wsId, { actorEmail: scope.email, action: "transformation-report.unshare" });
  return json({ ok: true, revoked });
});
