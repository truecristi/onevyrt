import { requireAdmin } from "../../../../lib/admin";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";
import {
  getDefaultProgramme, addStage, updateStage, deleteStage, moveStage,
  addLesson, updateLesson, deleteLesson, moveLesson, duplicateLesson, setProgrammeStatus,
  curriculumDeleteImpact,
  type LessonPatch,
} from "../../../../lib/curriculum-store";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/admin/curriculum:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);

  // Read-only learner-impact check for the delete confirm dialogs (see
  // app/admin/curriculum/page.tsx) — ?lessonId=<id> checks one lesson,
  // ?stageId=<id> checks every lesson under that stage in one query (see
  // curriculumDeleteImpact). Called ahead of a delete, never part of one.
  // Returns just the count, not the whole programme, so the hover-prefetch
  // this powers stays cheap.
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");
  const stageId = url.searchParams.get("stageId");
  if (lessonId || stageId) {
    const programme = await getDefaultProgramme();
    const lessonIds = lessonId ? [lessonId] : (programme.stages.find((s) => s.id === stageId)?.lessons.map((l) => l.id) ?? null);
    if (lessonIds === null) return json({ error: "Stage not found." }, 404);
    return json({ impact: await curriculumDeleteImpact(lessonIds) });
  }

  return json({ programme: await getDefaultProgramme() });
});

/** One endpoint, many actions — the no-code content-editing surface for
 *  the programme curriculum. Every mutation is admin-only and audited;
 *  see curriculum-store.ts for the actual read-modify-write logic. */
export const POST = withRouteLogging("api/admin/curriculum:POST", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ error: "action is required" }, 400);

  const str = (k: string): string | undefined => (typeof body[k] === "string" ? body[k] as string : undefined);
  const dir = (): "up" | "down" | null => (body.direction === "up" || body.direction === "down" ? body.direction : null);

  let result;
  switch (body.action) {
    case "addStage":
      if (!str("title")) return json({ error: "title is required" }, 400);
      result = await addStage(str("title")!, str("outcome") ?? "");
      break;
    case "updateStage":
      if (!str("stageId")) return json({ error: "stageId is required" }, 400);
      result = await updateStage(str("stageId")!, { title: str("title"), outcome: str("outcome") });
      break;
    case "deleteStage":
      if (!str("stageId")) return json({ error: "stageId is required" }, 400);
      result = await deleteStage(str("stageId")!);
      break;
    case "moveStage": {
      const d = dir();
      if (!str("stageId") || !d) return json({ error: "stageId and direction are required" }, 400);
      result = await moveStage(str("stageId")!, d);
      break;
    }
    case "addLesson":
      if (!str("stageId") || !str("title")) return json({ error: "stageId and title are required" }, 400);
      result = await addLesson(str("stageId")!, str("title")!, str("outcome") ?? "");
      break;
    case "updateLesson": {
      if (!str("lessonId")) return json({ error: "lessonId is required" }, 400);
      const patch: LessonPatch = {
        title: str("title"), outcome: str("outcome"), content: str("content"),
        videoUrl: str("videoUrl"), toolDeepLink: str("toolDeepLink"),
        resourceUrls: Array.isArray(body.resourceUrls) ? (body.resourceUrls as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
        estimatedMinutes: typeof body.estimatedMinutes === "number" ? body.estimatedMinutes : undefined,
        assignment: body.assignment === null ? null : (body.assignment as LessonPatch["assignment"] | undefined),
      };
      result = await updateLesson(str("lessonId")!, patch);
      break;
    }
    case "deleteLesson":
      if (!str("lessonId")) return json({ error: "lessonId is required" }, 400);
      result = await deleteLesson(str("lessonId")!);
      break;
    case "moveLesson": {
      const d = dir();
      if (!str("lessonId") || !d) return json({ error: "lessonId and direction are required" }, 400);
      result = await moveLesson(str("lessonId")!, d);
      break;
    }
    case "duplicateLesson":
      if (!str("lessonId")) return json({ error: "lessonId is required" }, 400);
      result = await duplicateLesson(str("lessonId")!);
      break;
    case "setStatus":
      if (body.status !== "draft" && body.status !== "published") return json({ error: "status must be draft or published" }, 400);
      result = await setProgrammeStatus(body.status);
      break;
    default:
      return json({ error: "unknown action" }, 400);
  }

  if ("error" in result) return json(result, 400);
  await recordAudit({ actorEmail: admin.email, action: `curriculum.${body.action}`, targetType: "curriculum", detail: JSON.stringify(body).slice(0, 300) });
  return json({ programme: result });
});
