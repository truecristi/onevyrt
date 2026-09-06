import { currentUser, getUserById } from "../../../../lib/auth";
import { roleOf, getWorkspace } from "../../../../lib/workspaces";
import { isAdminEmail } from "../../../../lib/admin";
import { getOrCreateEnrollment, readinessBaselineOf } from "../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { getBusinessSnapshot } from "../../../../lib/programme-business-snapshot";
import { effectiveStageAccessLimit } from "../../../../lib/cohorts";
import { listActivity } from "../../../../lib/activity";
import { getWhyAndCreed } from "../../../../lib/dashboard/why-creed";
import { summarizeEnrollment, buildProgrammeMap } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** A coach's (or platform admin's) full-detail view of ONE learner's
 *  workspace — the drill-down behind the engagement console's stalled-learner
 *  list, where a click needs the whole picture (progress, business snapshot,
 *  recent activity) to make outreach specific instead of generic. This is
 *  the coach/admin-authorised sibling of /api/programme/enrollment, which is
 *  self/member-scoped; this route is deliberately read-only — it must never
 *  mutate the learner's own state (e.g. the readiness baseline) just because
 *  a coach looked. */
export const GET = withRouteLogging("api/coach/learner:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws");
  if (!wsId) return json({ error: "ws is required" }, 400);
  const role = await roleOf(wsId, user.id);
  const allowed = role === "owner" || role === "manager" || isAdminEmail(user.email);
  if (!allowed) return json({ error: "You don't coach this learner." }, 403);

  const [ws, programme, snapshot, stageAccessLimit, activity, whyCreedData] = await Promise.all([
    getWorkspace(wsId), getDefaultProgramme(), getBusinessSnapshot(wsId), effectiveStageAccessLimit(wsId), listActivity(wsId, 12), getWhyAndCreed(wsId),
  ]);
  if (!ws) return json({ error: "workspace not found" }, 404);

  const enrollment = await getOrCreateEnrollment(wsId, user.id, programme.id);
  const summary = summarizeEnrollment(programme, enrollment);
  // The same walkable journey map the learner's own /programme hub renders,
  // so a coach sees exactly where this learner is stuck, not a paraphrase.
  const map = buildProgrammeMap(programme, enrollment, stageAccessLimit);

  const owner = await getUserById(ws.ownerId);
  const recentActivity = activity.map((a) => ({ at: a.at, action: a.action, detail: a.detail, actorEmail: a.actorEmail }));

  return json({
    workspaceId: ws.id,
    workspaceName: ws.name,
    ownerEmail: owner?.email ?? null,
    plan: ws.plan ?? "free",
    lastActivityAt: recentActivity[0]?.at ?? null,
    summary,
    snapshot: { ...snapshot, readinessBaseline: readinessBaselineOf(enrollment) },
    map,
    recentActivity,
    whyCreed: whyCreedData ? { why: whyCreedData.why, creed: whyCreedData.creed } : null,
  });
});
