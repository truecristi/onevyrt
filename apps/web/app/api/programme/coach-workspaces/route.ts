import { currentUser } from "../../../../lib/auth";
import { listForUser } from "../../../../lib/workspaces";
import { getOrCreateEnrollment, readinessBaselineOf } from "../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { getBusinessSnapshot } from "../../../../lib/programme-business-snapshot";
import { pacingForWorkspaces } from "../../../../lib/cohorts";
import { listActivity } from "../../../../lib/activity";
import { listChapterSubmissions } from "../../../../lib/chapter-submissions";
import { summarizeEnrollment, nextAction, chapterGates } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Every workspace the signed-in user coaches (owner or manager of) — the
 *  "all my clients" list a coach needs instead of switching workspaces one
 *  at a time to find out who needs attention. No cohort grouping yet (see
 *  lib/enrollments.ts's header on why "coach" = manager, not a real
 *  cross-workspace role) — this is every workspace the existing role
 *  system already lets them act on. */
export const GET = withRouteLogging("api/programme/coach-workspaces:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const all = await listForUser(user.id);
  const coached = all
    .map((ws) => ({ ws, role: ws.members.find((m) => m.userId === user.id)?.role }))
    .filter((x): x is { ws: (typeof all)[number]; role: "owner" | "manager" } => x.role === "owner" || x.role === "manager");

  const programme = await getDefaultProgramme();
  // One batched cohort-pacing lookup for the whole client list: gives each
  // workspace its (endDate-aware) stage cap and the dormant pacing_needs_review
  // flag, without fanning out a cohort query per client.
  const pacing = await pacingForWorkspaces(coached.map(({ ws }) => ws.id));
  const clients = await Promise.all(coached.map(async ({ ws, role }) => {
    const [enrollment, snapshot, activity, chapterSubmissions] = await Promise.all([
      getOrCreateEnrollment(ws.id, user.id, programme.id),
      getBusinessSnapshot(ws.id),
      listActivity(ws.id, 1),
      listChapterSubmissions(ws.id),
    ]);
    const cap = pacing.get(ws.id)?.stageAccessLimit ?? null;
    const summary = summarizeEnrollment(programme, enrollment);
    // Current module WITH the cohort pacing cap applied (same value as the
    // learner's map/drawer — programme-nav.cappedCurrentLessonId) so "Reach
    // out" names a module the learner can actually open, not one past the cap.
    const next = nextAction(programme, enrollment, cap);
    // Chapter-level approval gates — same call shape as api/programme/chapters
    // GET (chapterGates(programme, enrollment, submissions, stageAccessLimit)).
    // A gate in "awaiting_review" has a learner-submitted chapter output with
    // nowhere in the product for a coach to act on it; surface those here so
    // the coach-review UI can list and decide them.
    const chaptersAwaitingReview = chapterGates(programme, enrollment, chapterSubmissions, cap)
      .filter((g) => g.state === "awaiting_review" && g.submission)
      .map((g) => ({ stageId: g.stageId, stageTitle: g.title, order: g.order, submission: g.submission! }));
    return {
      workspaceId: ws.id, workspaceName: ws.name, plan: ws.plan ?? "free", role,
      summary: { ...summary, currentLessonId: next.currentLessonId },
      currentLessonTitle: next.currentLessonTitle,
      snapshot: { ...snapshot, readinessBaseline: readinessBaselineOf(enrollment) },
      lastActivityAt: activity[0]?.at ?? null,
      // A cohort this learner is in has an auto-remapped cap the coach should
      // confirm (see migration 1786700000000 / cohorts.ts pacingForWorkspaces).
      pacingNeedsReview: pacing.get(ws.id)?.pacingNeedsReview ?? false,
      // Private notes only ever leave the server for the actual invited
      // coach (manager) — never for the workspace's own owner.
      coachNotes: role === "manager" ? (enrollment.coachNotes ?? "") : undefined,
      accessGranted: enrollment.accessGranted !== false,
      chaptersAwaitingReview,
    };
  }));

  // Whoever needs attention most (awaiting review, then overdue work) first.
  clients.sort((a, b) => {
    const attentionA = a.summary.awaitingReview.length * 10 + a.snapshot.overdueCount;
    const attentionB = b.summary.awaitingReview.length * 10 + b.snapshot.overdueCount;
    return attentionB - attentionA;
  });

  return json({ clients });
});
