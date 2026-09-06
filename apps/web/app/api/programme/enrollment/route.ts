import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, getWorkspace } from "../../../../lib/workspaces";
import { getOrCreateEnrollment, ensureReadinessBaseline, applyFreeAccessMode } from "../../../../lib/enrollments";
import { listChapterSubmissions } from "../../../../lib/chapter-submissions";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { getBusinessSnapshot } from "../../../../lib/programme-business-snapshot";
import { listCohortsForWorkspace, effectiveStageAccessLimit } from "../../../../lib/cohorts";
import { summarizeEnrollment, nextAction, buildProgrammeMap, chapterGates } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** The signed-in user's own enrollment + progress summary for this
 *  workspace, created on first touch. Any member can view — enrollment is
 *  shared at the workspace level, the same scope goals/definition use.
 *  coachNotes is stripped unless the caller is a "manager" — the actual
 *  invited-coach role, distinct from "owner" (the client themselves). A
 *  workspace's own owner must never see "private" notes about them. */
export const GET = withRouteLogging("api/programme/enrollment:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const [programme, snapshot, cohorts, stageAccessLimit, chapterSubs, workspace] = await Promise.all([
    getDefaultProgramme(), getBusinessSnapshot(wsId), listCohortsForWorkspace(wsId), effectiveStageAccessLimit(wsId),
    listChapterSubmissions(wsId), getWorkspace(wsId),
  ]);
  const enrollment = await getOrCreateEnrollment(wsId, user.id, programme.id);
  const summary = summarizeEnrollment(programme, enrollment);
  // The canonical "what should I do next?" for this learner, computed here where
  // the full programme is loaded. Home reads this so its "Your next move" starts
  // at the beginning of the programme road (the foundational identity work), not
  // at a mid-path selling tool. Respects the cohort pacing cap.
  const action = nextAction(programme, enrollment, stageAccessLimit);
  // The full per-learner journey map (chapter nodes + per-module status, current
  // step, progress) — computed here where the programme is loaded, so the
  // /programme hub can render the walkable, locked-in-order journey directly.
  const map = buildProgrammeMap(programme, enrollment, stageAccessLimit);
  // The write-once Start baseline for the Readiness meter: the first time a
  // real score exists for this workspace it's captured permanently, so the
  // Finish module can show "Start → now" instead of asking the learner to
  // compare from memory.
  const readinessBaseline = await ensureReadinessBaseline(wsId, snapshot.readinessScore);
  // Chapter-level gates (a coach signs off each chapter's OUTPUT before the next
  // opens) + whether a coach is even on this workspace. The UI uses hasCoach to
  // decide whether a completed chapter needs submitting for review or is simply
  // "complete" on the self-paced track — NEVER to hard-lock lessons, which stay
  // governed by module progression so a solo learner can never stall.
  let gates = chapterGates(programme, enrollment, chapterSubs, stageAccessLimit);
  // In free-access mode, all chapters are immediately approved and unlock the next
  const isFreeAccess = workspace?.freeAccessMode ?? false;
  gates = applyFreeAccessMode(gates, isFreeAccess);
  const hasCoach = workspace?.members.some((m) => m.role === "manager") ?? false;
  const visible = role === "manager" ? enrollment : { ...enrollment, coachNotes: undefined };
  return json({ enrollment: visible, summary, nextAction: action, map, role, snapshot: { ...snapshot, readinessBaseline }, cohorts, stageAccessLimit, chapterGates: gates, hasCoach });
});
