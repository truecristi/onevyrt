/**
 * Curriculum content model: the admin-editable definition of the ONEVYRT
 * programme — stages, lessons, assignments — as opposed to any one
 * learner's progress through it (see enrollment.ts). Deliberately separate
 * from program.ts (the existing 8-lesson BusinessDefinition/ForceAction
 * model, which stays exactly as it is): a curriculum lesson can deep-link
 * into that existing content instead of duplicating it. Pure data + pure
 * helpers, no UI, no storage.
 */
export type CurriculumStatus = "draft" | "published";

export interface ChecklistTemplateItem {
  id: string;
  label: string;
}

export interface AssignmentTemplate {
  id: string;
  title: string;
  instructions: string;
  checklist: ChecklistTemplateItem[];
  /** What the learner should actually submit as evidence — a link, a
   *  number, a short writeup. Free-form prompt, not a rigid field type. */
  evidencePrompt: string;
}

export interface LessonTemplate {
  id: string;
  order: number;
  title: string;
  outcome: string;
  content: string;
  videoUrl?: string;
  resourceUrls?: string[];
  /** Deep-link into the existing app — a ProgramCentre tab key, an
   *  onboarding step, etc. Opaque to this module; the UI interprets it. */
  toolDeepLink?: string;
  assignment?: AssignmentTemplate;
  estimatedMinutes?: number;
}

export interface StageTemplate {
  id: string;
  order: number;
  title: string;
  outcome: string;
  lessons: LessonTemplate[];
}

export interface ProgrammeTemplate {
  id: string;
  name: string;
  status: CurriculumStatus;
  stages: StageTemplate[];
  createdAt: string;
  updatedAt: string;
  /** Curriculum-shape version. Absent (or < CURRICULUM_SCHEMA_VERSION) means a
   *  pre-chapter, flat-stage programme that a one-time migration should reshape
   *  into the canonical six-stage curriculum arc: Start, Chapter 1–4, Finish
   *  (see curriculum-chapters.ts). Present and current means "already canonical
   *  — leave the shape alone." This is the single flag the migration is
   *  idempotent on. */
  schemaVersion?: number;
}

export function orderedStages(programme: ProgrammeTemplate): StageTemplate[] {
  return [...programme.stages].sort((a, b) => a.order - b.order);
}

export function orderedLessons(stage: StageTemplate): LessonTemplate[] {
  return [...stage.lessons].sort((a, b) => a.order - b.order);
}

/** Every lesson across every stage, in curriculum order — the flat
 *  sequence learner progress is measured against. */
export function allLessons(programme: ProgrammeTemplate): LessonTemplate[] {
  return orderedStages(programme).flatMap((s) => orderedLessons(s));
}

export function findLesson(programme: ProgrammeTemplate, lessonId: string): { stage: StageTemplate; lesson: LessonTemplate } | null {
  for (const stage of programme.stages) {
    const lesson = stage.lessons.find((l) => l.id === lessonId);
    if (lesson) return { stage, lesson };
  }
  return null;
}

export function totalLessonCount(programme: ProgrammeTemplate): number {
  return programme.stages.reduce((sum, s) => sum + s.lessons.length, 0);
}
