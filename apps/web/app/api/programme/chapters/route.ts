import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getOrCreateEnrollment } from "../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { effectiveStageAccessLimit } from "../../../../lib/cohorts";
import { listChapterSubmissions } from "../../../../lib/chapter-submissions";
import { chapterGates } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** The chapter approval gates for this workspace's learner: each chapter's
 *  state (locked / in_progress / ready_to_submit / awaiting_review /
 *  changes_requested / approved) and whether it unlocks the next, computed by
 *  the engine from lesson progress plus the coach's per-chapter decisions.
 *  This is the read the UI uses to render the gated journey. Any workspace
 *  member can view — the gates are workspace-scoped, the same bar as the
 *  enrollment read. Respects a cohort's stage-access cap. */
export const GET = withRouteLogging("api/programme/chapters:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const [programme, stageAccessLimit, submissions] = await Promise.all([
    getDefaultProgramme(), effectiveStageAccessLimit(wsId), listChapterSubmissions(wsId),
  ]);
  const enrollment = await getOrCreateEnrollment(wsId, user.id, programme.id);
  const gates = chapterGates(programme, enrollment, submissions, stageAccessLimit);
  return json({ gates });
});
