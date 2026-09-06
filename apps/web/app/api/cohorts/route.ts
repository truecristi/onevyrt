import { currentUser } from "../../../lib/auth";
import { getDefaultProgramme } from "../../../lib/curriculum-store";
import { createCohort, listCohortsForCoach } from "../../../lib/cohorts";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** A coach's own cohorts. Any signed-in user can create one — a cohort is
 *  useless until real workspaces are added to it, and adding a workspace is
 *  gated on already being its owner/manager, so this list start empty and
 *  stays scoped to what its creator can actually act on. */
export const GET = withRouteLogging("api/cohorts:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const cohorts = await listCohortsForCoach(user.id);
  return json({ cohorts });
});

export const POST = withRouteLogging("api/cohorts:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const body = await req.json().catch(() => null) as { name?: string; startDate?: string; endDate?: string } | null;
  if (!body?.name || !body.startDate || !body.endDate) return json({ error: "name, startDate and endDate are required" }, 400);
  const programme = await getDefaultProgramme();
  const result = await createCohort(user.id, user.email, programme.id, body.name, body.startDate, body.endDate);
  if ("error" in result) return json(result, 400);
  return json({ cohort: result });
});
