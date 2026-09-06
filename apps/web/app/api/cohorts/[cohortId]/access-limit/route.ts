import { currentUser } from "../../../../../lib/auth";
import { setCohortStageAccessLimit } from "../../../../../lib/cohorts";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** The "programme access rules" the spec asks for on a cohort — caps
 *  members to stages up to and including a given order. null clears it. */
export const POST = withRouteLogging("api/cohorts/[cohortId]/access-limit:POST", async (req: Request, { params }: { params: Promise<{ cohortId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const body = await req.json().catch(() => null) as { stageAccessLimit?: number | null } | null;
  if (body?.stageAccessLimit !== null && typeof body?.stageAccessLimit !== "number") return json({ error: "stageAccessLimit must be a number or null" }, 400);
  const { cohortId } = await params;
  const result = await setCohortStageAccessLimit(cohortId, user.id, body.stageAccessLimit);
  if ("error" in result) return json(result, 404);
  return json({ cohort: result });
});
