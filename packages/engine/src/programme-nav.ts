/**
 * The single canonical navigation + progress source for the ONEVYRT learner
 * experience — the "linchpin" of the Phase 2 spec
 * (docs/ONEVYRT_NAVIGATION_AND_USER_FLOW.md §9). Home, Programme, My Business
 * and Coaching ALL read the view-models produced here, so progress and "what's
 * next" are computed in exactly one place, from the canonical curriculum plus
 * the learner's enrollment. This is what stops the eight competing journeys
 * from each telling the learner something different.
 *
 * Pure: no storage, no I/O, no React. It composes the already-canonical engine
 * progress functions (summarizeEnrollment / effectiveStatus / capStatusByStage)
 * — it does not re-derive progress a second way.
 */
import type { ProgrammeTemplate } from "./curriculum.ts";
import { orderedStages, orderedLessons, findLesson } from "./curriculum.ts";
import { CANONICAL_STAGES, type PsychologicalState } from "./curriculum-chapters.ts";
import type { Enrollment, LessonStatus } from "./enrollment.ts";
import { effectiveStatus, capStatusByStage, summarizeEnrollment } from "./enrollment.ts";

// ── The global learner menu — exactly five destinations (spec §1) ────────────
export interface NavDestination {
  id: string;
  label: string;
  /** Canonical route. Synced with apps/web/lib/navigation/structure.ts
   *  (the web app's single source of truth). The engine does not enforce
   *  routing — it only provides view-models; actual routes are resolved
   *  by callers based on where they are deployed. */
  href: string;
  icon: string;
}

export const LEARNER_MENU: readonly NavDestination[] = [
  { id: "home", label: "Home", href: "/command-center", icon: "home" },
  { id: "programme", label: "Programme", href: "/programme", icon: "book" },
  { id: "my-business", label: "My Business", href: "/business", icon: "plan" },
  { id: "coaching", label: "Coaching", href: "/coaching", icon: "message" },
  { id: "resources", label: "Resources", href: "/studio", icon: "rocket" },
];

// ── Programme map (spec §3.1) ────────────────────────────────────────────────
export type NodeStatus = "complete" | "current" | "available" | "locked";

export interface MapLesson {
  id: string;
  title: string;
  order: number;
  status: LessonStatus;
}

export interface ProgrammeMapNode {
  stageId: string;
  title: string;
  order: number;
  /** Uncertainty → Clarity → Confidence → Control → Freedom. */
  state: PsychologicalState;
  /** The persistent output this chapter compiles toward, or null for a plain stage. */
  output: string | null;
  status: NodeStatus;
  lessons: MapLesson[];
  completedLessons: number;
  totalLessons: number;
}

export interface ProgrammeMap {
  nodes: ProgrammeMapNode[];
  /** The visible psychological arc across the canonical stages. */
  arc: PsychologicalState[];
  currentStageId: string | null;
  currentLessonId: string | null;
  overallPercent: number;
  completedLessons: number;
  totalLessons: number;
}

const STATE_BY_STAGE: Readonly<Record<string, PsychologicalState>> = Object.freeze(
  Object.fromEntries(CANONICAL_STAGES.map((s) => [s.id, s.state] as const)),
);
const OUTPUT_BY_STAGE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(CANONICAL_STAGES.map((s) => [s.id, s.output] as const)),
);

/** Statuses that mean "the learner can act on this lesson right now." */
const ACTIONABLE_STATUSES: ReadonlySet<LessonStatus> = new Set(["available", "in_progress", "submitted", "changes_requested"]);

/**
 * The first lesson the learner can actually act on, in curriculum order, WITH
 * the cohort pacing cap applied — so a paced-out learner correctly has no
 * current lesson (null) until their coach lifts the cap. This is the one
 * definition of "where am I" that every surface uses; unlike the engine's
 * uncapped summary, it respects pacing.
 */
function cappedCurrentLessonId(programme: ProgrammeTemplate, enrollment: Enrollment, cap: number | null | undefined): string | null {
  for (const stage of orderedStages(programme)) {
    for (const lesson of orderedLessons(stage)) {
      const status = capStatusByStage(programme, lesson.id, effectiveStatus(programme, enrollment, lesson.id), cap);
      if (ACTIONABLE_STATUSES.has(status)) return lesson.id;
    }
  }
  return null;
}

/**
 * Build the full programme map view-model for one learner. Node status is
 * derived from the SAME per-lesson status the course uses (with the cohort
 * pacing cap applied), so the map can never disagree with the lesson list.
 */
export function buildProgrammeMap(
  programme: ProgrammeTemplate,
  enrollment: Enrollment,
  stageAccessLimit: number | null | undefined = null,
): ProgrammeMap {
  const summary = summarizeEnrollment(programme, enrollment);
  const currentLessonId = cappedCurrentLessonId(programme, enrollment, stageAccessLimit);
  const currentStageId = currentLessonId ? findLesson(programme, currentLessonId)?.stage.id ?? null : null;

  const nodes: ProgrammeMapNode[] = orderedStages(programme).map((stage) => {
    const lessons: MapLesson[] = orderedLessons(stage).map((l) => {
      const raw = effectiveStatus(programme, enrollment, l.id);
      const status = capStatusByStage(programme, l.id, raw, stageAccessLimit);
      return { id: l.id, title: l.title, order: l.order, status };
    });
    const totalLessons = lessons.length;
    const completedLessons = lessons.filter((l) => l.status === "approved" || l.status === "completed").length;

    let status: NodeStatus;
    if (totalLessons > 0 && completedLessons === totalLessons) status = "complete";
    else if (stage.id === currentStageId) status = "current";
    else if (lessons.some((l) => l.status !== "locked")) status = "available";
    else status = "locked";

    return {
      stageId: stage.id,
      title: stage.title,
      order: stage.order,
      state: STATE_BY_STAGE[stage.id] ?? "clarity",
      output: OUTPUT_BY_STAGE[stage.id] ?? null,
      status,
      lessons,
      completedLessons,
      totalLessons,
    };
  });

  return {
    nodes,
    arc: CANONICAL_STAGES.map((s) => s.state),
    currentStageId,
    currentLessonId,
    overallPercent: summary.percentComplete,
    completedLessons: summary.completedLessons,
    totalLessons: summary.totalLessons,
  };
}

// ── "What should I do next?" (spec §2 — the one Home CTA) ─────────────────────
export interface NextAction {
  currentStageId: string | null;
  currentLessonId: string | null;
  currentLessonTitle: string | null;
  overallPercent: number;
  /** Primary CTA copy for Home / "Continue Programme". */
  ctaLabel: string;
  /** Where the CTA goes — the programme hub, which surfaces the current module
   *  and links into its tool. */
  ctaHref: string;
  /** True once every lesson is complete — Home points at the Transformation Report. */
  done: boolean;
}

export function nextAction(
  programme: ProgrammeTemplate,
  enrollment: Enrollment,
  stageAccessLimit: number | null | undefined = null,
): NextAction {
  const summary = summarizeEnrollment(programme, enrollment);
  const currentLessonId = cappedCurrentLessonId(programme, enrollment, stageAccessLimit);
  const found = currentLessonId ? findLesson(programme, currentLessonId) : null;
  const done = currentLessonId === null && summary.totalLessons > 0 && summary.completedLessons === summary.totalLessons;

  let ctaLabel: string;
  if (done) ctaLabel = "View your Transformation Report";
  else if (currentLessonId === null) ctaLabel = "You're all caught up"; // paced out — waiting on the cohort
  else if (summary.completedLessons === 0) ctaLabel = "Start the programme";
  else ctaLabel = "Continue Programme";

  return {
    currentStageId: found?.stage.id ?? null,
    currentLessonId,
    currentLessonTitle: found?.lesson.title ?? null,
    overallPercent: summary.percentComplete,
    ctaLabel,
    // The journey hub — it highlights the current module and links straight into
    // that module's tool. (A dedicated /programme/lesson/[id] page can deep-link
    // here later; currentLessonId is returned so callers can when it exists.)
    ctaHref: "/programme",
    done,
  };
}
