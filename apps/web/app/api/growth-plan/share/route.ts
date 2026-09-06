/**
 * Growth & Improvement Plan share links: generate a 24-hour, unauthenticated
 * shareable link at /share/growth-plan/[token]. Mirrors
 * api/account/transformation-report/share's owner-only pattern — a share
 * link exposes real business numbers (revenue, margins, the named constraint,
 * the 90-day plan) outside the app entirely, to anyone who gets the URL,
 * which only the workspace owner may decide to do.
 *
 * Uses stateless HMAC-signed tokens (no database storage, no garbage
 * collection) — simpler than the Transformation Report's snapshot approach,
 * and ensures shared links always reflect the latest plan data.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { readSettings } from "../../../../lib/settings";
import { recordActivity } from "../../../../lib/activity";
import { checkRateLimit, rateLimitHeaders } from "../../../../lib/rate-limit";
import { generateGrowthPlanShareLink } from "../../../../lib/reports/growth-plan-share-link";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";

const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

async function requireOwner(req: Request): Promise<{ wsId: string; userId: string; email: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can share the Growth & Improvement Plan." }, 403);
  return { wsId, userId: user.id, email: user.email };
}

function shareUrl(origin: string, token: string): string {
  return `${origin}/share/growth-plan/${token}`;
}

const SHARE_LIMIT = { windowMs: 3_600_000, max: 10 };

/**
 * POST /api/growth-plan/share — Generates a new 24-hour share link for the
 * current workspace's Growth & Improvement Plan. Only the workspace owner can
 * do this. Returns the shareable URL and expiry timestamp.
 */
export const POST = withRouteLogging("api/growth-plan/share:POST", async (req: Request): Promise<Response> => {
  const scope = await requireOwner(req);
  if (scope instanceof Response) return scope;

  const rl = await checkRateLimit(`growth-plan-share:${scope.userId}`, SHARE_LIMIT);
  if (!rl.allowed) return json({ error: "Too many share links requested — try again later." }, 429, rateLimitHeaders(rl));

  const result = generateGrowthPlanShareLink(scope.wsId);
  await recordActivity(scope.wsId, { actorEmail: scope.email, action: "growth-plan.share" });

  const settings = await readSettings();
  const origin = settings.publicOrigin || new URL(req.url).origin;
  return json({ url: shareUrl(origin, result.token), expiresAt: result.expiresAt });
});
