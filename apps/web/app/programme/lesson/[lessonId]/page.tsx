/**
 * Programme — a single module's guided step. The one place a learner lands from
 * the /programme journey to actually DO a module: what the step is, the teaching,
 * a button into its tool, and the assignment they mark started / submit for coach
 * review. Server-rendered STRUCTURE (title, outcome, teaching, assignment, tool
 * route) comes from the same curriculum the hub uses via findLesson, so it can
 * never drift; the live per-learner state (this module's status, the locks, the
 * start/submit actions) is layered on by the LessonGuide client component, which
 * reads the engine's buildProgrammeMap through /api/programme/enrollment.
 */
import type { Metadata } from "next";
import {
  CANONICAL_STAGES,
  findLesson,
  orderedStages,
  orderedLessons,
  type ProgrammeTemplate,
  type PsychologicalState,
} from "@onevyrt/engine";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { manualTeachingFor } from "../../../../lib/programme-manual";
import { resolveToolHref } from "../../../../lib/programme-tool-links";
import { LessonGuide, type LessonGuideAssignment, type LessonNeighbor } from "../../../../components/LessonGuide";

// Reads the DB at request time — never statically prerendered at build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Module — ONEVYRT" };

function stateOf(stageId: string): PsychologicalState {
  return CANONICAL_STAGES.find((s) => s.id === stageId)?.state ?? "clarity";
}
/** A route the page can link to, or null (a non-route deep-link stays text) — the
 *  same rule the hub uses so the two never disagree about what's a tool link. */
function toolHrefOf(deepLink: string | undefined): string | null {
  return typeof deepLink === "string" && deepLink.startsWith("/") ? deepLink : null;
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  // If the DB is unreachable we keep null and fall through to "module not found"
  // rather than throwing — the page always renders something walkable.
  let programme: ProgrammeTemplate | null = null;
  try {
    programme = await getDefaultProgramme();
  } catch {
    /* keep the null fallback */
  }

  const found = programme ? findLesson(programme, lessonId) : null;
  if (!found || !programme) return <ModuleNotFound />;

  const { stage, lesson } = found;
  const assignment: LessonGuideAssignment | null = lesson.assignment
    ? {
        title: lesson.assignment.title,
        instructions: lesson.assignment.instructions,
        evidencePrompt: lesson.assignment.evidencePrompt,
        checklist: lesson.assignment.checklist.map((c) => ({ id: c.id, label: c.label })),
      }
    : null;

  // The whole course, flattened into journey order, so this page knows the
  // module's neighbours (for prev/next) and its place inside its own chapter
  // ("Module 2 of 5"). The order is the single canonical one every surface
  // shares — orderedStages/orderedLessons — so it can never disagree with the hub.
  const stages = orderedStages(programme);
  const flat: { id: string; title: string }[] = [];
  let numInStage = 0;
  let countInStage = 0;
  for (const s of stages) {
    const lessons = orderedLessons(s);
    if (s.id === stage.id) {
      countInStage = lessons.length;
      numInStage = lessons.findIndex((l) => l.id === lesson.id) + 1;
    }
    for (const l of lessons) flat.push({ id: l.id, title: l.title });
  }
  const gi = flat.findIndex((l) => l.id === lesson.id);
  const prev: LessonNeighbor | null = gi > 0 ? flat[gi - 1]! : null;
  const next: LessonNeighbor | null = gi >= 0 && gi < flat.length - 1 ? flat[gi + 1]! : null;

  return (
    <LessonGuide
      lessonId={lesson.id}
      stageTitle={stage.title}
      stageState={stateOf(stage.id)}
      moduleTitle={lesson.title}
      outcome={lesson.outcome}
      content={lesson.content}
      teaching={manualTeachingFor(lesson.id)}
      toolHref={resolveToolHref(lesson.id, toolHrefOf(lesson.toolDeepLink))}
      assignment={assignment}
      numInStage={numInStage}
      countInStage={countInStage}
      prev={prev}
      next={next}
    />
  );
}

/** Rendered when the lesson id in the URL doesn't resolve to a module (a stale
 *  link, a deleted module, or the DB being unreachable). Pure server markup with
 *  the same --ds tokens so it's theme-aware without a client component. */
function ModuleNotFound() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "72px 20px", textAlign: "center", color: "var(--ds-text-primary, #111827)" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ds-brand, #088057)", margin: "0 0 10px" }}>
        ONEVYRT · Programme
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.01em", margin: "0 0 10px" }}>Module not found</h1>
      <p style={{ fontSize: 15, color: "var(--ds-text-secondary, #475569)", margin: "0 0 22px" }}>
        We couldn&rsquo;t find this module. It may have moved, or the link is out of date.
      </p>
      <a
        href="/programme"
        style={{
          display: "inline-block", textDecoration: "none", fontWeight: 700, fontSize: 14, color: "#fff",
          background: "var(--ds-brand-solid, #088057)", borderRadius: 10, padding: "11px 18px",
        }}
      >
        ← Back to your programme
      </a>
    </div>
  );
}
