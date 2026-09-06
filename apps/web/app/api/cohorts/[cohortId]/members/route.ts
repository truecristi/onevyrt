import { currentUser } from "../../../../../lib/auth";
import { roleOf } from "../../../../../lib/workspaces";
import { addCohortMember, removeCohortMember } from "../../../../../lib/cohorts";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Adding a workspace to a cohort is gated on the caller already being its
 *  owner/manager — a coach can only enrol clients they actually coach,
 *  never an arbitrary workspace id. */
export const POST = withRouteLogging("api/cohorts/[cohortId]/members:POST", async (req: Request, { params }: { params: Promise<{ cohortId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const body = await req.json().catch(() => null) as { workspaceId?: string } | null;
  if (!body?.workspaceId) return json({ error: "workspaceId is required" }, 400);
  const role = await roleOf(body.workspaceId, user.id);
  if (role !== "owner" && role !== "manager") return json({ error: "You can only add workspaces you coach." }, 403);
  const { cohortId } = await params;
  const result = await addCohortMember(cohortId, user.id, body.workspaceId);
  if ("error" in result) return json(result, 404);
  return json({ cohort: result });
});

export const DELETE = withRouteLogging("api/cohorts/[cohortId]/members:DELETE", async (req: Request, { params }: { params: Promise<{ cohortId: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws");
  if (!wsId) return json({ error: "ws query param is required" }, 400);
  const { cohortId } = await params;
  const result = await removeCohortMember(cohortId, user.id, wsId);
  if ("error" in result) return json(result, 404);
  return json({ cohort: result });
});
