/**
 * Shared shape for a Chapter 4 (IMPROVE & SCALE) subchapter module.
 *
 * Each subchapter (4-1.ts .. 4-5.ts in this directory) exports these five
 * bindings directly — title / description / keyPoints / learningObjectives /
 * actionItems — rather than one object literal, so a lesson-rendering surface
 * can import exactly the field it needs (`import { keyPoints } from
 * "./chapter-4/4-1"`) without pulling the rest. This file is the structural
 * contract each module is written against, and the one place another lane
 * (the chapter UI, the submission API, coach review) can import the type from
 * instead of re-declaring its own copy.
 *
 * This is presentation/teaching content, the same kind of thing
 * lib/programme-manual.ts is for chapters 1-3 (expanded, edit-and-deploy
 * copy with no DB migration) rather than the engine's terser canonical
 * curriculum-content.ts entries. See index.ts's header for how the two line
 * up for Chapter 4 specifically.
 *
 * Pure data, no I/O.
 */

/** One concrete, trackable task a learner can act on this subchapter and
 *  later report progress against — deliberately just {title, description},
 *  not a checklist-with-ids, so a subchapter can list 3-5 of these as plain
 *  data without inventing per-item identifiers this layer doesn't need. */
export interface ActionItem {
  /** Short, imperative — what to do (e.g. "Score your four growth areas"). */
  title: string;
  /** How to do it and what "done" looks like — specific enough to act on
   *  today, not a restatement of the title. */
  description: string;
}

/** The five bindings every apps/web/lib/chapter-4/4-N.ts module exports. */
export interface SubchapterContent {
  /** Clean subchapter name, no leading "4.N" — numbering is the barrel's job
   *  (see index.ts), the same way engine lesson titles never embed an order. */
  title: string;
  /** The lesson body: ~500-1000 words of practical teaching, written as
   *  paragraphs separated by a blank line. */
  description: string;
  /** 4-6 short, memorable one-line takeaways — summary, not new content. */
  keyPoints: string[];
  /** 3-5 outcomes the learner should be able to do after this subchapter. */
  learningObjectives: string[];
  /** 3-5 concrete, measurable, trackable tasks the learner does this week. */
  actionItems: ActionItem[];
}

/** A subchapter plus the numbering/identity the barrel (index.ts) adds. */
export interface Chapter4Subchapter extends SubchapterContent {
  /** "4.1".."4.5" — matches the string codes apps/web/lib/chapter4-submissions.ts's
   *  Chapter4Subchapter type already uses for the same 5 (plus optional 4.6). */
  code: string;
  /** 1-based position among the 5 required subchapters. */
  subchapterNum: number;
  /** URL-friendly identifier for routing/anchors. */
  slug: string;
  /** The canonical engine lesson id this subchapter's expanded content maps
   *  to (packages/engine/src/curriculum-chapters.ts's CANONICAL_LESSON_LAYOUT,
   *  "chapter-4" stage) — "m-bottleneck", "m-improve-conversion", etc. Lets a
   *  rendering surface look this content up by the same id the engine already
   *  uses for the lesson, exactly how lib/programme-manual.ts's
   *  MANUAL_TEACHING is keyed for chapters 1-3. */
  moduleId: string;
}
