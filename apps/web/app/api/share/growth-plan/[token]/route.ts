/**
 * Public, unauthenticated endpoint for fetching a shared Growth &
 * Improvement Plan. Verifies the share token (HMAC signature + expiry),
 * then returns the plan data and workspace name. No auth beyond the token
 * being valid and unexpired — that's the whole point of a share link.
 */
import { getChapter4Submission } from "../../../../../lib/chapter4-submissions";
import { verifyGrowthPlanShareToken } from "../../../../../lib/reports/growth-plan-share-link";
import { pgPool } from "../../../../../lib/db";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";

const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/**
 * GET /api/share/growth-plan/[token] — Public endpoint for viewing a shared
 * Growth & Improvement Plan. Verifies the token's signature and expiry, then
 * fetches the plan from the database. Returns both the submission and the
 * workspace name for display.
 */
export const GET = withRouteLogging("api/share/growth-plan/[token]:GET", async (_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> => {
  const { token } = await ctx.params;

  // Verify token signature and expiry
  const verified = verifyGrowthPlanShareToken(token);
  if (!verified) return json({ error: "This share link is invalid or has expired." }, 404);

  try {
    // Fetch the plan from the database
    const submission = await getChapter4Submission(verified.workspaceId);
    if (!submission) return json({ error: "This plan is no longer available." }, 404);

    // Fetch workspace name for display
    const wsRow = await pgPool().query("SELECT name FROM workspaces WHERE id = $1", [verified.workspaceId]);
    const workspaceName = wsRow.rows[0]?.name || "workspace";

    return json({
      submission,
      workspaceName,
    });
  } catch {
    return json({ error: "Could not load the plan." }, 500);
  }
});
