/**
 * Business Diagnostic — data model (platform spec Section 2, "Business
 * diagnostic and 7 Forces wheel"). Pure and server-free (no React, no db):
 * this module owns the 8-category shape, labels/prompts, and sanitisation
 * so the capture page (a client component), the server store
 * (lib/business-diagnostic.ts) and fast unit tests all share one source of
 * truth without pulling Postgres (and its Node-only `pg` dependency) into
 * the browser bundle — the same split lib/studio/offer-coach.ts already
 * uses for lib/offer.ts, for the identical reason.
 *
 * See lib/business-diagnostic.ts's file header for how this fits into the
 * platform spec and what's deliberately deferred from this first slice.
 */

/** The spec's own 8 named categories (docs/PLATFORM_SPECIFICATION.md,
 *  Section 2) — a FIXED taxonomy, unlike lib/constraint.ts's open-ended,
 *  user-editable area list. Order matches the spec's own listing. */
export type DiagnosticCategoryId =
  | "ownerPsychology"
  | "purposeVision"
  | "businessPlanning"
  | "salesMarketing"
  | "peopleCulture"
  | "operationsSystems"
  | "financeMeasurement"
  | "customerExperience";

export const DIAGNOSTIC_CATEGORY_ORDER: DiagnosticCategoryId[] = [
  "ownerPsychology", "purposeVision", "businessPlanning", "salesMarketing",
  "peopleCulture", "operationsSystems", "financeMeasurement", "customerExperience",
];

export const DIAGNOSTIC_CATEGORY_LABELS: Record<DiagnosticCategoryId, string> = {
  ownerPsychology: "Owner Psychology",
  purposeVision: "Purpose & Vision",
  businessPlanning: "Business Planning",
  salesMarketing: "Sales & Marketing",
  peopleCulture: "People & Culture",
  operationsSystems: "Operations & Systems",
  financeMeasurement: "Finance & Measurement",
  customerExperience: "Customer Experience",
};

/** A one-line prompt per category — what "score this" actually means, shown
 *  under the category name so an untrained owner knows what they're rating. */
export const DIAGNOSTIC_CATEGORY_PROMPTS: Record<DiagnosticCategoryId, string> = {
  ownerPsychology: "How clear-headed, resilient and in control does the owner feel running this business day to day?",
  purposeVision: "How clear and shared is the reason this business exists and where it's going?",
  businessPlanning: "How real is the plan — priorities, milestones, who owns what?",
  salesMarketing: "How reliably does the business attract and convert the right customers?",
  peopleCulture: "How strong is the team, and the culture that holds it together?",
  operationsSystems: "How much runs on documented systems versus the owner's head?",
  financeMeasurement: "How clearly does the business know its numbers — margin, cash, unit economics?",
  customerExperience: "How good is the experience customers actually get, start to finish?",
};

export type DiagnosticConfidence = "low" | "medium" | "high";

export interface DiagnosticCategoryEntry {
  score: number;                    // 0..100 — current
  target: number;                   // 0..100 — where the owner wants this to be
  confidence: DiagnosticConfidence; // how sure the owner is the score is accurate
  evidence: string;                 // what tells you this — a number, a symptom, a story
  biggestConstraint: string;        // the #1 thing holding this category back right now
  recommendedActions: string;       // what to do about it (freeform — see lib/business-diagnostic.ts)
}

export type DiagnosticCategories = Partial<Record<DiagnosticCategoryId, DiagnosticCategoryEntry>>;

export interface BusinessDiagnostic {
  categories: DiagnosticCategories;
  updatedAt?: string;
}

export const EMPTY_ENTRY: DiagnosticCategoryEntry = { score: 0, target: 0, confidence: "low", evidence: "", biggestConstraint: "", recommendedActions: "" };
export const EMPTY_DIAGNOSTIC: BusinessDiagnostic = { categories: {} };

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");
const clipScore = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };
const clipConfidence = (v: unknown): DiagnosticConfidence => (v === "medium" || v === "high" ? v : "low");

function sanitizeEntry(raw: unknown): DiagnosticCategoryEntry {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    score: clipScore(r.score),
    target: clipScore(r.target),
    confidence: clipConfidence(r.confidence),
    evidence: clip(r.evidence, 1000),
    biggestConstraint: clip(r.biggestConstraint, 500),
    recommendedActions: clip(r.recommendedActions, 1000),
  };
}

export function sanitizeDiagnostic(v: unknown): BusinessDiagnostic {
  const d = (v ?? {}) as Record<string, unknown>;
  const rawCategories = (d.categories ?? {}) as Record<string, unknown>;
  const categories: DiagnosticCategories = {};
  for (const id of DIAGNOSTIC_CATEGORY_ORDER) {
    const entry = rawCategories[id];
    // Only keep a category once it's actually been touched — an eagerly-
    // filled shell of all 8 at score 0 would make "nothing scored yet"
    // indistinguishable from "8 categories genuinely scored 0" in any later
    // gap-ranking/reporting feature (deferred, but no reason to bake the
    // ambiguity in now).
    if (entry && typeof entry === "object") categories[id] = sanitizeEntry(entry);
  }
  return { categories };
}

/** Merges `entry` onto `base` field-by-field and re-sanitises the result —
 *  the one place both the server store's patch function and (indirectly,
 *  via that function) the capture page's "save" rely on for partial-update
 *  semantics, so there's exactly one merge rule to get right. */
export function mergeEntry(base: DiagnosticCategoryEntry | undefined, entry: Partial<DiagnosticCategoryEntry>): DiagnosticCategoryEntry {
  return sanitizeEntry({ ...(base ?? EMPTY_ENTRY), ...entry });
}
