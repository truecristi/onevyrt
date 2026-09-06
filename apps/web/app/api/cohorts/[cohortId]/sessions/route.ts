import { currentUser } from "../../../../../lib/auth";
import { addCohortSession } from "../../../../../lib/cohorts";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/cohorts/[cohortId]/sessions:POST", async (req: Request, { params }: { params: Promise<{ cohortId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const body = await req.json().catch(() => null) as { title?: string; date?: string; meetingUrl?: string } | null;
  if (!body?.title || !body.date) return json({ error: "title and date are required" }, 400);
  const { cohortId } = await params;
  const result = await addCohortSession(cohortId, user.id, body.title, body.date, body.meetingUrl);
  if ("error" in result) return json(result, 400);
  return json({ cohort: result });
});
