import { requireAdmin } from "../../../../lib/admin";
import { listAllWorkspaces, type Plan } from "../../../../lib/workspaces";
import { pgPool } from "../../../../lib/db";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { pacingForWorkspaces } from "../../../../lib/cohorts";
import { summarizeEnrollment, nextAction, type Enrollment, type EnrollmentSummary } from "@onevyrt/engine";
import { classifyEngagement } from "../../../../lib/coach/engagement";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export interface AdminLearner {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string | null;
  plan: Plan;
  summary: EnrollmentSummary;
  currentLessonTitle: string | null;
  /** A cohort this learner is in carries the migration's pacing_needs_review
   *  flag — its auto-remapped cap needs a coach to confirm (see cohorts.ts). */
  pacingNeedsReview: boolean;
  lastActivityAt: string | null;
}

/**
 * Platform-admin learner console: EVERY enrolled learner across EVERY
 * workspace on the instance, with progress + last activity, so the platform
 * owner can see who's stuck without opening workspaces one at a time. This is
 * the admin-scope sibling of GET /api/programme/coach-workspaces — that route
 * is scoped to the workspaces the *signed-in* user personally coaches
 * (owner/manager); this one is gated on lib/admin's ADMIN_EMAILS allowlist
 * instead and covers every workspace regardless of who coaches it.
 *
 * Deliberately cheap: exactly 3 batched queries total (all workspaces, all
 * enrollments, latest activity grouped per enrolled workspace) plus one
 * owner-email lookup per enrolled workspace, all run concurrently — no other
 * per-workspace fan-out. There's no bulk "every user" query the way
 * /api/admin/overview has one (listAllUsers): with likely far more workspaces
 * than enrollments, resolving just the owners of workspaces that actually
 * have an enrollment is the cheaper of the two shapes.
 */
export const GET = withRouteLogging("api/admin/learners:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);

  const workspaces = await listAllWorkspaces();
  const wsById = new Map(workspaces.map((ws) => [ws.id, ws]));

  const enr = await pgPool().query<{ workspace_id: string; enrollment: Enrollment }>(
    "SELECT workspace_id, enrollment FROM enrollments",
  );

  // Latest activity per enrolled workspace: one grouped query scoped to just
  // the workspace_ids that have an enrollment, instead of a per-workspace
  // lookup. Note the column is ws_id here (unlike enrollments.workspace_id).
  const ids = enr.rows.map((row) => row.workspace_id);
  const actRows = ids.length
    ? (await pgPool().query<{ ws_id: string; at: Date }>(
        "SELECT ws_id, max(at) AS at FROM activity WHERE ws_id = ANY($1) GROUP BY ws_id",
        [ids],
      )).rows
    : [];
  const lastActivityByWsId = new Map(actRows.map((row) => [row.ws_id, (row.at as Date).toISOString()]));

  const programme = await getDefaultProgramme();

  // Batch the two lookups the old row loop fanned out one-per-learner: the
  // owner's email (WHERE id = ANY) and each workspace's cohort pacing (cap +
  // the dormant pacing_needs_review flag). The roster is now a fixed handful of
  // queries regardless of learner count, and the per-row work below is pure.
  const ownerIds = [...new Set(enr.rows.map((row) => wsById.get(row.workspace_id)?.ownerId).filter((id): id is string => !!id))];
  const ownerEmailById = new Map<string, string>();
  if (ownerIds.length) {
    const owners = await pgPool().query<{ id: string; email: string }>("SELECT id, email FROM users WHERE id = ANY($1)", [ownerIds]);
    for (const o of owners.rows) ownerEmailById.set(o.id, o.email);
  }
  const pacing = await pacingForWorkspaces(ids);

  const learners = enr.rows.map((row): AdminLearner | null => {
    const ws = wsById.get(row.workspace_id);
    if (!ws) return null; // Enrollment for a workspace that's since been deleted.
    const cap = pacing.get(ws.id)?.stageAccessLimit ?? null;
    const summary = summarizeEnrollment(programme, row.enrollment);
    // Current module WITH the cohort pacing cap applied — the same value the
    // learner's map/drawer resolves (programme-nav.cappedCurrentLessonId), so a
    // paced-out learner's currentLessonId/title match every other surface and
    // "Reach out" can't name a module they can't open.
    const next = nextAction(programme, row.enrollment, cap);
    return {
      workspaceId: ws.id,
      workspaceName: ws.name,
      ownerEmail: ownerEmailById.get(ws.ownerId) ?? null,
      plan: ws.plan ?? "free",
      summary: { ...summary, currentLessonId: next.currentLessonId },
      currentLessonTitle: next.currentLessonTitle,
      pacingNeedsReview: pacing.get(ws.id)?.pacingNeedsReview ?? false,
      lastActivityAt: lastActivityByWsId.get(row.workspace_id) ?? null,
    };
  }).filter((l): l is AdminLearner => l !== null);

  // Same "who needs attention most" ordering the coach roster uses (see
  // lib/coach/engagement.ts) — absence and pending review outrank steady
  // progress. overdueCount doesn't exist at this cross-workspace scope (it's
  // part of the per-business Readiness snapshot, not the enrollment itself),
  // so it's passed as 0 here.
  learners.sort((a, b) => {
    const attentionA = classifyEngagement({
      percentComplete: a.summary.percentComplete,
      awaitingReviewCount: a.summary.awaitingReview.length,
      changesRequestedCount: a.summary.changesRequested.length,
      overdueCount: 0,
      lastActivityAt: a.lastActivityAt,
    }).attention;
    const attentionB = classifyEngagement({
      percentComplete: b.summary.percentComplete,
      awaitingReviewCount: b.summary.awaitingReview.length,
      changesRequestedCount: b.summary.changesRequested.length,
      overdueCount: 0,
      lastActivityAt: b.lastActivityAt,
    }).attention;
    return attentionB - attentionA;
  });

  return json({ learners });
});
