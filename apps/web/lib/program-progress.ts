/**
 * Shared "is this lesson done" logic for the guided Business Intelligence
 * course — used by both ProgramCentre (rendering the lesson list) and the
 * project library (rendering a "resume where you left off" badge), so the
 * two never quietly disagree about what counts as complete.
 */
import type { BusinessDefinition, ForceActionItem, ClientPromise, RavingFansInputs, MindfulnessEntry } from "@onevyrt/engine";

export const LESSON_KEYS = ["define", "story", "mindfulness", "money", "forces", "drivers", "raving", "brief"] as const;
export type LessonKey = typeof LESSON_KEYS[number];

export interface ProgramProgressCtx {
  definition: BusinessDefinition;
  forceActions: ForceActionItem[];
  mindfulness: MindfulnessEntry[];
  clientPromises: ClientPromise[];
  ravingFansInputs: RavingFansInputs;
  visitedLessons: string[];
}

/** Lessons with their own "wrote something down" signal are done based on
 *  that; the rest (Money, Profit Drivers, Brief) have sensible defaults
 *  that never look "empty", so those are done once actually opened. */
export function isLessonDone(key: LessonKey, ctx: ProgramProgressCtx): boolean {
  switch (key) {
    case "define": return !!(ctx.definition.businessName?.trim() && ctx.definition.mainOffer?.trim());
    case "story": return !!(ctx.definition.currentState?.trim() || ctx.definition.newStory?.trim());
    case "mindfulness": return !!ctx.definition.weeklyFocus?.trim() || ctx.mindfulness.length > 0;
    case "money": return ctx.visitedLessons.includes("money");
    case "forces": return ctx.forceActions.length > 0;
    case "drivers": return ctx.visitedLessons.includes("drivers");
    case "raving": return ctx.clientPromises.length > 0 || ctx.ravingFansInputs.retentionRate > 0 || ctx.ravingFansInputs.referralRate > 0;
    case "brief": return ctx.visitedLessons.includes("brief");
  }
}

export interface ProgramProgress {
  statuses: { key: LessonKey; done: boolean }[];
  doneCount: number;
  total: number;
  firstIncomplete: LessonKey | null;
  allDone: boolean;
}

export function computeProgramProgress(ctx: ProgramProgressCtx): ProgramProgress {
  const statuses = LESSON_KEYS.map((key) => ({ key, done: isLessonDone(key, ctx) }));
  const doneCount = statuses.filter((s) => s.done).length;
  return {
    statuses, doneCount, total: LESSON_KEYS.length,
    firstIncomplete: statuses.find((s) => !s.done)?.key ?? null,
    allDone: doneCount === LESSON_KEYS.length,
  };
}
