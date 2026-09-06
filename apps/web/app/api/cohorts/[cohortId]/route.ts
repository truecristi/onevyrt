import { currentUser } from "../../../../lib/auth";
import { getCohort } from "../../../../lib/cohorts";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** One cohort's full detail — coach only. Members see the same data via
 *  the /api/programme/enrollment response's cohort summary instead, which
 *  deliberately omits coach-only fields (no private coach notes exist on
 *  cohorts yet, but this keeps the boundary in one place if they're added). */
export const GET = withRouteLogging("api/cohorts/[cohortId]:GET", async (req: Request, { params }: { params: Promise<{ cohortId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const { cohortId } = await params;
  const cohort = await getCohort(cohortId);
  if (!cohort || cohort.coachUserId !== user.id) return json({ error: "Cohort not found." }, 404);
  return json({ cohort });
});
