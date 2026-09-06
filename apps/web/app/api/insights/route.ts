/**
 * Insights snapshot API — the factual metrics the AI digest reads from. Returns
 * the same acquisition/funnel/creative numbers shown elsewhere, gathered into
 * one object. No AI here: generation happens client-side with the connected
 * model (a BYO key, or the included managed AI via /api/ai/generate).
 */
import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../lib/workspaces";
import { buildInsightsSnapshot } from "../../../lib/insights/snapshot";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

function pad(n: number): string { return String(n).padStart(2, "0"); }

export const GET = withRouteLogging("api/insights:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const d = new Date();
  const todayISO = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const snapshot = await buildInsightsSnapshot(wsId, todayISO);
  return json({ snapshot });
});
