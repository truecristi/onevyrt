/**
 * The ordered Chapter 4 (IMPROVE & SCALE) curriculum: 4.1 Find the Bottleneck
 * through 4.5 Build the Growth Plan, each subchapter's own module (4-1.ts ..
 * 4-5.ts) reduced to one typed, numbered list — a single place the chapter
 * UI, the submission API, or the coach review surface can import from instead
 * of reaching into this directory's files individually.
 *
 * Alignment with the rest of the system (both still landing concurrently as
 * this was written, so noted explicitly for whoever wires these together):
 *  - moduleId matches packages/engine/src/curriculum-chapters.ts's
 *    CANONICAL_LESSON_LAYOUT for the "chapter-4" stage ("m-bottleneck",
 *    "m-improve-conversion", "m-improve-profit", "m-systemise-automate",
 *    "m-growth-plan", in that order) — this directory is the expanded
 *    teaching copy for those same five lesson ids, the same relationship
 *    lib/programme-manual.ts's MANUAL_TEACHING has to chapters 1-3's engine
 *    lessons (keyed by id, edit-and-deploy, no DB migration to change a
 *    paragraph).
 *  - code matches the string keys ("4.1".."4.5") apps/web/lib/chapter4-
 *    submissions.ts's Chapter4Subchapter type already uses for the same 5
 *    subchapters (plus its optional 4.6, which this directory intentionally
 *    has no content module for — see the file-level note below).
 *
 * 4.6 "Team & Capacity" (docs/IMPLEMENTATION_ROADMAP.md's optional,
 * only-if-the-business-has-staff subchapter) is out of scope here: this
 * curriculum-content lane covers the 5 required subchapters only. The
 * storage layer already accepts a "4.6" save (deciding whether to show it is
 * explicitly left to curriculum content, per that file's own comment) — a
 * future content module can be added here without touching storage.
 *
 * Content only: no I/O, no DB access. Persisting what a learner submits
 * against these subchapters is lib/chapter4-submissions.ts's job, not this
 * directory's.
 */
import * as s41 from "./4-1";
import * as s42 from "./4-2";
import * as s43 from "./4-3";
import * as s44 from "./4-4";
import * as s45 from "./4-5";
import type { Chapter4Subchapter, SubchapterContent } from "./types";

export type { ActionItem, SubchapterContent, Chapter4Subchapter } from "./types";

function toSubchapter(subchapterNum: number, code: string, slug: string, moduleId: string, mod: SubchapterContent): Chapter4Subchapter {
  return { subchapterNum, code, slug, moduleId, ...mod };
}

/** The 5 required Chapter 4 subchapters, in learning order. */
export const CHAPTER_4_SUBCHAPTERS: readonly Chapter4Subchapter[] = [
  toSubchapter(1, "4.1", "find-the-bottleneck", "m-bottleneck", s41),
  toSubchapter(2, "4.2", "improve-conversion", "m-improve-conversion", s42),
  toSubchapter(3, "4.3", "improve-profit", "m-improve-profit", s43),
  toSubchapter(4, "4.4", "systemise-automate", "m-systemise-automate", s44),
  toSubchapter(5, "4.5", "build-the-growth-plan", "m-growth-plan", s45),
];

/** Look up one subchapter by its 1-5 position. */
export function getChapter4Subchapter(subchapterNum: number): Chapter4Subchapter | undefined {
  return CHAPTER_4_SUBCHAPTERS.find((s) => s.subchapterNum === subchapterNum);
}

/** Look up one subchapter by its "4.1".."4.5" code — the same string shape
 *  lib/chapter4-submissions.ts's Chapter4Subchapter type uses. */
export function getChapter4SubchapterByCode(code: string): Chapter4Subchapter | undefined {
  return CHAPTER_4_SUBCHAPTERS.find((s) => s.code === code);
}

/** Look up one subchapter by its canonical engine lesson id
 *  ("m-bottleneck", etc.) — see the file header for where that id comes from. */
export function getChapter4SubchapterByModuleId(moduleId: string): Chapter4Subchapter | undefined {
  return CHAPTER_4_SUBCHAPTERS.find((s) => s.moduleId === moduleId);
}
