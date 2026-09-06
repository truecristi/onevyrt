import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { getEnrollment } from "../../../../lib/enrollments";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { summarizeEnrollment, findLesson } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Coach view of one workspace's programme progress — submissions awaiting
 *  review, joined with the lesson titles they belong to. Owner/manager
 *  only, same bar as acting on a review. */
export const GET = withRouteLogging("api/programme/review:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner" && role !== "manager") return json({ error: "Only the workspace owner or a manager can view submissions." }, 403);

  const programme = await getDefaultProgramme();
  const enrollment = await getEnrollment(wsId);
  if (!enrollment) return json({ summary: null, awaitingReview: [] });

  const summary = summarizeEnrollment(programme, enrollment);
  const awaitingReview = summary.awaitingReview.map(({ lessonId, submission }) => {
    const found = findLesson(programme, lessonId);
    return { lessonId, lessonTitle: found?.lesson.title ?? lessonId, stageTitle: found?.stage.title ?? "", submission };
  });
  return json({ summary, awaitingReview });
});
