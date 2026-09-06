/**
 * Canonical four-chapter ONEVYRT programme structure, and the PURE,
 * deterministic transform that reshapes any stored ProgrammeTemplate into it
 * without losing, renaming, or duplicating a single lesson or assignment id.
 *
 * Why this module exists
 * ----------------------
 * The canonical learner journey is a six-position arc:
 *
 *   Start → Chapter 1 → Chapter 2 → Chapter 3 → Chapter 4 → Finish
 *   (Uncertainty → Clarity → Confidence → Control → Momentum → Freedom)
 *
 * with 25 modules placed across it (the ONEVYRT Master Course Map). This is the
 * single source of truth for that arc AND for the module layout; the module
 * CONTENT lives in curriculum-content.ts, which assembles the programme from the
 * layout here. It is pure (no storage, no I/O), so the seed, the DB migration,
 * and the tests share exactly one layout — no second, hand-maintained copy.
 *
 * reconcileToChapters() PRESERVES whatever lesson ids it is given (it re-homes,
 * it never renames). The separate id change — the old 22-lesson seed's ids →
 * the new module ids — is a one-time data migration keyed on OLD_TO_NEW_LESSON.
 * Chapter 4 (IMPROVE & SCALE) is a later, PURELY ADDITIVE insertion between
 * Chapter 3 and Finish — see CURRICULUM_SCHEMA_VERSION 4 below; it renames
 * nothing and needs no OLD_TO_NEW_LESSON entries of its own.
 *
 * Invariants (enforced by curriculum-chapters.test.ts)
 * ----------------------------------------------------
 *  1. Lesson ids are PRESERVED exactly — the lesson id is the universal join
 *     key for every enrollment, submission, and coach review, so preserving it
 *     preserves all learner progress automatically.
 *  2. Assignment + checklist ids are preserved (a lesson is MOVED, not rewritten).
 *  3. Nothing is dropped or duplicated: every input lesson id appears once in
 *     the output.
 *  4. Idempotent: reconcileToChapters(reconcileToChapters(p)) deep-equals
 *     reconcileToChapters(p).
 *  5. Any lesson whose id is not in the canonical layout is preserved in an
 *     explicit "Legacy / Unmapped" stage for admin review — never discarded and
 *     never inserted at random into the required course.
 *
 * IMPORTANT: this transform is applied ONCE, by the versioned migration — never
 * as a side effect of an ordinary read. Reads stay pure.
 */
import type { ProgrammeTemplate, StageTemplate, LessonTemplate } from "./curriculum.ts";

/** v1 = legacy flat 11-stage seed; v2 = three-chapter arc keyed on the old 22
 *  lesson ids; v3 = the canonical 20-module course map (Master Course Map), each
 *  module keyed by a stable semantic id and wired to its tool. The v2→v3 data
 *  migration remaps every old lesson id to its new module id so no progress is
 *  lost (see OLD_TO_NEW_LESSON + remapEnrollmentLessonIds). v4 = Chapter 4
 *  (IMPROVE & SCALE) inserted between Chapter 3 and Finish — five new modules
 *  (bottleneck → conversion → profit → systemise → the Growth & Improvement
 *  Plan), purely additive: every v3 module id, order and content is unchanged,
 *  so v3→v4 needs no lesson-id remap, only a cohort stage_access_limit shift
 *  (see remapStageAccessLimitForChapter4 below — Finish moves from order 4 to 5). */
export const CURRICULUM_SCHEMA_VERSION = 4;

export type PsychologicalState = "uncertainty" | "clarity" | "confidence" | "control" | "momentum" | "freedom";

export interface CanonicalStageMeta {
  id: string;
  order: number;
  title: string;
  outcome: string;
  /** The state this position is meant to move the learner into. */
  state: PsychologicalState;
  /** The persistent client document this position compiles toward. */
  output: string;
}

/** The six canonical stages, in order. Titles/outcomes here become the stage
 *  headers; individual lesson titles and content are left untouched. */
export const CANONICAL_STAGES: readonly CanonicalStageMeta[] = [
  {
    id: "start", order: 0, state: "uncertainty",
    title: "Start — Personal & Business Assessment",
    outcome: "An honest before-picture: who you are as a founder and where the business actually stands today — your Personal & Business Baseline.",
    output: "Personal & Business Baseline",
  },
  {
    id: "chapter-1", order: 1, state: "clarity",
    title: "Chapter 1 — Define the Business and Psychology",
    outcome: "Clarity: your founder psychology, a sharp business definition, the customer's psychology, your core message and your strategic direction — compiled into your Business Psychology Blueprint.",
    output: "Business Psychology Blueprint",
  },
  {
    id: "chapter-2", order: 2, state: "confidence",
    title: "Chapter 2 — Implement It in the Business",
    outcome: "Confidence: the psychology turned into a live system — positioning & brand, offer, customer journey, marketing, sales, delivery and a 90-day plan — your Implemented Business System.",
    output: "Implemented Business System",
  },
  {
    id: "chapter-3", order: 3, state: "control",
    title: "Chapter 3 — Define and Control the Numbers",
    outcome: "Control: your freedom number, unit economics, growth maths, business economics, plan-versus-actual and an improvement loop — your Numbers & Control Dashboard.",
    output: "Numbers & Control Dashboard",
  },
  {
    id: "chapter-4", order: 4, state: "momentum",
    title: "Chapter 4 — Improve and Scale the Business",
    outcome: "Momentum: the single biggest constraint on growth found and named, conversion improved, profit improved, the repetitive work systemised, and all of it turned into a dated 90-day roadmap — your Growth & Improvement Plan.",
    output: "Growth & Improvement Plan",
  },
  {
    id: "finish", order: 5, state: "freedom",
    title: "Finish — Transformation Report & Next 90 Days",
    outcome: "Freedom: your before-and-after compared, and a concrete next 90-day plan — your Transformation Report.",
    output: "Transformation Report",
  },
];

export const LEGACY_STAGE_ID = "legacy-unmapped";
const LEGACY_STAGE_ORDER = CANONICAL_STAGES.length; // 5 — always after the canonical arc

/**
 * The canonical ONEVYRT Master Course Map: 25 modules placed into the six
 * stages, in order. This is the whole product decision — reviewable and
 * adjustable — expressed as data. The module CONTENT (titles, teaching, tool
 * links, assignments) lives in curriculum-content.ts, which assembles the
 * programme from THIS layout, so there is exactly one source for the order.
 *
 * Start = the honest baseline. Chapter 1 = define the business + the psychology
 * (founder, definition, customer, message, direction). Chapter 2 = implement it
 * live (positioning/brand → offer → journey → marketing → sales → delivery →
 * 90-day plan). Chapter 3 = define & control the numbers (freedom number, unit
 * economics, growth maths, business economics, plan-vs-actual, improvement loop).
 * Chapter 4 = improve & scale (find the bottleneck → improve conversion →
 * improve profit → systemise & automate → the 90-day Growth & Improvement Plan).
 * Finish = the before-and-after transformation report + next 90 days.
 */
export const CANONICAL_LESSON_LAYOUT: readonly { stageId: string; lessonIds: readonly string[] }[] = [
  { stageId: "start", lessonIds: ["m-start-assessment"] },
  { stageId: "chapter-1", lessonIds: ["m-founder-psychology", "m-business-definition", "m-customer-psychology", "m-transformation-message", "m-strategic-direction"] },
  { stageId: "chapter-2", lessonIds: ["m-positioning-brand", "m-offer", "m-customer-journey", "m-marketing-system", "m-sales-system", "m-delivery-operations", "m-90-day-plan"] },
  { stageId: "chapter-3", lessonIds: ["m-personal-freedom-number", "m-price-unit-economics", "m-growth-mathematics", "m-business-economics", "m-plan-vs-actual", "m-improvement-loop"] },
  { stageId: "chapter-4", lessonIds: ["m-bottleneck", "m-improve-conversion", "m-improve-profit", "m-systemise-automate", "m-growth-plan"] },
  { stageId: "finish", lessonIds: ["m-finish-transformation"] },
];

/**
 * v2 → v3 progress bridge: every historical lesson id (the old 22-lesson seed)
 * mapped to the new module it now lives in. Several old lessons consolidate into
 * one module (e.g. the two follow-up lessons both become the Sales System). The
 * v3 migration rewrites each stored enrollment entry through this map (merging
 * entries that collapse onto the same module, keeping the most-advanced status)
 * so a learner's place and submissions carry across the restructure. New modules
 * with no historical source (e.g. Business Definition) simply start unstarted —
 * they are genuinely new work.
 */
export const OLD_TO_NEW_LESSON: Readonly<Record<string, string>> = Object.freeze({
  "l-0-1": "m-start-assessment",
  "l-0-2": "m-start-assessment",
  "l-1-1": "m-founder-psychology",
  "l-1-2": "m-strategic-direction",
  "l-2-1": "m-strategic-direction",
  "l-2-2": "m-strategic-direction",
  "l-3-1": "m-offer",
  "l-3-2": "m-personal-freedom-number",
  "l-4-1": "m-customer-psychology",
  "l-4-2": "m-transformation-message",
  "l-5-1": "m-customer-journey",
  "l-5-2": "m-customer-journey",
  "l-6-1": "m-marketing-system",
  "l-6-2": "m-marketing-system",
  "l-7-1": "m-sales-system",
  "l-7-2": "m-sales-system",
  "l-8-1": "m-delivery-operations",
  "l-8-2": "m-delivery-operations",
  "l-9-1": "m-improvement-loop",
  "l-9-2": "m-improvement-loop",
  "l-10-1": "m-finish-transformation",
  "l-10-2": "m-finish-transformation",
});

/** lessonId → canonical stage id (derived from the layout above). */
export const LESSON_TO_STAGE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    CANONICAL_LESSON_LAYOUT.flatMap((g) => g.lessonIds.map((id) => [id, g.stageId] as const)),
  ),
);

const STAGE_ORDER_BY_ID: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(CANONICAL_STAGES.map((s) => [s.id, s.order] as const)),
);

/** The new stage ORDER a canonical lesson lands in, or null if it isn't part of
 *  the canonical layout (an admin/legacy lesson). */
export function canonicalStageOrderOfLesson(lessonId: string): number | null {
  const stageId = LESSON_TO_STAGE[lessonId];
  return stageId === undefined ? null : STAGE_ORDER_BY_ID[stageId];
}

/** True once a programme has been reshaped to the canonical arc. */
export function isCanonical(programme: Pick<ProgrammeTemplate, "schemaVersion">): boolean {
  return (programme.schemaVersion ?? 1) >= CURRICULUM_SCHEMA_VERSION;
}

/**
 * Reshape a programme into the canonical chapter arc. Pure: the input is
 * never mutated (lessons are deep-cloned). See the invariants at the top.
 */
export function reconcileToChapters(programme: ProgrammeTemplate): ProgrammeTemplate {
  // Every lesson, indexed by id — first occurrence wins (a malformed duplicate
  // id collapses to one rather than being duplicated downstream).
  const byId = new Map<string, LessonTemplate>();
  for (const stage of programme.stages) {
    for (const lesson of stage.lessons) {
      if (!byId.has(lesson.id)) byId.set(lesson.id, lesson);
    }
  }

  const placed = new Set<string>();
  const stages: StageTemplate[] = CANONICAL_STAGES.map((meta) => {
    const ids = CANONICAL_LESSON_LAYOUT.find((g) => g.stageId === meta.id)?.lessonIds ?? [];
    const lessons: LessonTemplate[] = [];
    let order = 1;
    for (const id of ids) {
      const lesson = byId.get(id);
      if (!lesson) continue; // a standard lesson missing from this instance — just absent
      placed.add(id);
      lessons.push({ ...structuredClone(lesson), order: order++ });
    }
    return { id: meta.id, order: meta.order, title: meta.title, outcome: meta.outcome, lessons };
  });

  // Preserve every remaining lesson (admin-created, or from an older curriculum)
  // in stable input order — never dropped, never scattered into the required arc.
  const leftovers: LessonTemplate[] = [];
  const seenLeftover = new Set<string>();
  for (const stage of programme.stages) {
    for (const lesson of stage.lessons) {
      if (placed.has(lesson.id) || seenLeftover.has(lesson.id)) continue;
      seenLeftover.add(lesson.id);
      leftovers.push(lesson);
    }
  }
  if (leftovers.length > 0) {
    stages.push({
      id: LEGACY_STAGE_ID,
      order: LEGACY_STAGE_ORDER,
      title: "Legacy / Unmapped — admin review",
      outcome:
        "Lessons preserved from a previous curriculum or added by an admin that aren't part of the canonical chapter arc. Nothing here is deleted — review and re-home each one.",
      lessons: leftovers.map((l, i) => ({ ...structuredClone(l), order: i + 1 })),
    });
  }

  return { ...programme, schemaVersion: CURRICULUM_SCHEMA_VERSION, stages };
}

export interface StageAccessLimitRemap {
  /** The new cohort stage-access cap (a new-stage ORDER, or null = uncapped). */
  value: number | null;
  /** True when the new cap admits exactly the same lessons the old cap did.
   *  When false, the remap is a safe approximation and the cohort should be
   *  flagged for a coach to re-set its pacing. */
  exact: boolean;
}

/**
 * Conservatively remap a cohort's `stage_access_limit` from the old 11-stage
 * order space (0…10) to the new 5-stage order space (0…4).
 *
 * The cap means "members may reach stages with order ≤ cap." Because the
 * restructure regroups lessons by theme, a single old cap rarely lines up with
 * a single new stage boundary. The rule here guarantees the ONE unacceptable
 * outcome never happens — a cohort is never accidentally UNLOCKED past where it
 * was — by choosing the largest new cap whose every lesson was already reachable
 * under the old cap. When that isn't an exact match, `exact:false` tells the
 * migration to preserve the original value and flag the cohort for review
 * rather than silently guess. (The engine never re-locks a lesson a member has
 * already started, so an approximate cap can only gate not-yet-started lessons,
 * never destroy progress.)
 *
 * Derivation of the table (old cap → new cap), verified from first principles in
 * curriculum-chapters.test.ts:
 *   0        → 0   (exact: old stage-0 == new "start")
 *   1,2,3    → 0   (approx: old 1-3 lessons now split across chapter-1 & 3)
 *   4,5,6,7  → 1   (approx: chapter-1 fully covered at old-4; ch2 not until old-8)
 *   8,9      → 2   (approx: chapter-2 fully covered at old-8; ch3 not until old-10)
 *   ≥10      → 4   (exact: everything reachable == whole arc)
 */
export function remapStageAccessLimit(oldLimit: number | null | undefined): StageAccessLimitRemap {
  if (oldLimit == null) return { value: null, exact: true };
  if (oldLimit < 0) return { value: -1, exact: false }; // anomalous "locks everything" — kept, flagged
  if (oldLimit >= 10) return { value: 4, exact: true };
  const table: Readonly<Record<number, number>> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2 };
  return { value: table[oldLimit], exact: oldLimit === 0 };
}

/**
 * Remap a cohort's `stage_access_limit` from the v3 five-stage order space
 * (0=start … 4=finish) to the v4 six-stage space that Chapter 4's insertion
 * creates (0=start … 3=chapter-3, 4=chapter-4, 5=finish).
 *
 * Unlike remapStageAccessLimit above (v1→v2, an approximate regrouping), this
 * remap is always EXACT: Chapter 4 is inserted purely additively after Chapter
 * 3 and before Finish, so every boundary below it (start/chapter-1/chapter-2/
 * chapter-3, orders 0-3) is completely unchanged, and the only old value whose
 * MEANING shifts is the old "everything, including Finish" cap (old order 4) —
 * it must become the new "everything" cap (order 5), or a cohort that could
 * already reach Finish would suddenly find it re-locked behind a Chapter 4 it
 * never had before. A null cap (uncapped) stays null.
 *
 *   0,1,2,3  → unchanged  (chapter boundaries below the insertion point)
 *   4        → 5          (old "through Finish" → new "through Finish")
 *   null     → null       (uncapped stays uncapped)
 */
export function remapStageAccessLimitForChapter4(oldLimit: number | null | undefined): number | null {
  if (oldLimit == null) return null;
  if (oldLimit >= 4) return 5;
  return oldLimit;
}
