/**
 * Business OS — Business Diagnostic (platform spec Section 2, "Business
 * diagnostic and 7 Forces wheel"). A periodic full-business baseline across
 * 8 fixed categories, genuinely different from lib/constraint.ts's Growth
 * Constraint Engine: constraint.ts declares the ONE currently-active growth
 * bottleneck from an open-ended, user-editable area list; this scores the
 * WHOLE business against a fixed taxonomy on a slower cadence. Conflating
 * the two would degrade constraint.ts's focused job without making this
 * assessment any better — see docs/IMPLEMENTATION_ROADMAP.md's "Section 2 —
 * dedicated scoping pass" for the full reasoning.
 *
 * First slice only — the spec's own "required outputs" for this section
 * (radar/wheel chart, current-vs-target comparison, gap ranking, top three
 * priorities, historical trend, coach-vs-owner comparison, generated 90-day
 * plan) are deliberately NOT built here. This ships the underlying data
 * model + capture UI those outputs would eventually read from: per category,
 * current score, target score, confidence in the score, evidence, biggest
 * constraint, and recommended actions. `recommendedActions` is deliberately
 * a freeform string, not a structured action item — the cross-cutting "one
 * action-plan system" question (see the roadmap doc) is still open, and
 * inventing a ninth action-item shape here would make that worse, not better.
 *
 * The 8-category shape, labels and sanitisation live in the pure
 * lib/studio/diagnostic-model.ts (no db import) so a client component can
 * import the category order/labels/prompts without pulling Postgres's
 * Node-only `pg` dependency into the browser bundle — this file is just the
 * persistence, the same split lib/offer.ts uses with lib/studio/offer-coach.ts.
 *
 * Stored under the `diagnostic` section of the shared workspace_business
 * blob (lib/business.ts) — no new migration, same storage pattern as
 * lib/constraint.ts / lib/offer.ts / lib/message.ts / lib/reality.ts.
 * Locked with withAdvisoryLock the way offer/message/reality are (see their
 * own comments for why) — this module is new, so it's built with that
 * protection from the start rather than needing a follow-up fix.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { withAdvisoryLock } from "./db";
import { sanitizeDiagnostic, mergeEntry, EMPTY_DIAGNOSTIC, type BusinessDiagnostic, type DiagnosticCategoryId, type DiagnosticCategoryEntry, type DiagnosticCategories } from "./studio/diagnostic-model";

export {
  DIAGNOSTIC_CATEGORY_ORDER, DIAGNOSTIC_CATEGORY_LABELS, DIAGNOSTIC_CATEGORY_PROMPTS, EMPTY_DIAGNOSTIC, sanitizeDiagnostic,
} from "./studio/diagnostic-model";
export type {
  DiagnosticCategoryId, DiagnosticConfidence, DiagnosticCategoryEntry, DiagnosticCategories, BusinessDiagnostic,
} from "./studio/diagnostic-model";

// One lock per workspace (not per category): every category lives inside
// the SAME `diagnostic` section of workspace_business, so two concurrent
// edits to DIFFERENT categories still read-modify-write the same jsonb
// value and must serialize, exactly like offer/message's multiple fields
// within one section. saveBusinessSection's cross-SECTION `||` merge is
// what keeps a diagnostic write from blocking a completely different
// section's write (constraint, offer, …) — that part is unaffected.
const diagnosticLockKey = (workspaceId: string) => `workspace-business:diagnostic:${workspaceId}`;

export async function getDiagnostic(workspaceId: string): Promise<BusinessDiagnostic> {
  const biz = await getBusiness(workspaceId);
  const raw = biz.diagnostic as BusinessDiagnostic | undefined;
  return raw ? { ...sanitizeDiagnostic(raw), updatedAt: raw.updatedAt } : { ...EMPTY_DIAGNOSTIC };
}

// Unlocked — only ever called from inside withAdvisoryLock(diagnosticLockKey)
// below. Never call this directly, and never add a lock here: it would
// deadlock against the lock patchDiagnosticCategory already holds for its
// whole read-merge-write body (two separate pooled connections, each
// waiting on the other to release).
async function writeDiagnosticRaw(workspaceId: string, data: unknown): Promise<BusinessDiagnostic> {
  const clean = sanitizeDiagnostic(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "diagnostic", clean);
  return clean;
}

/** The only write path: a true partial merge at the CATEGORY level — only
 *  the one category being edited is touched, every other category already
 *  stored survives untouched. The capture UI is 8 independently-expandable
 *  cards (one per category), so a category-at-a-time save fits it far
 *  better than resending all 8 categories' fields on every edit — this is
 *  why there's no whole-diagnostic saveDiagnostic() the way constraint.ts
 *  has a whole-blob saveConstraint(): there's no real caller that would
 *  ever need one. The read-merge-write runs under the advisory lock, so a
 *  concurrent save of a DIFFERENT category can't land between this patch's
 *  read and write and get silently dropped (mirrors lib/offer.ts's
 *  patchOffer — see its comment for the exact race this prevents). */
export async function patchDiagnosticCategory(workspaceId: string, categoryId: DiagnosticCategoryId, entry: Partial<DiagnosticCategoryEntry>): Promise<BusinessDiagnostic> {
  return withAdvisoryLock(diagnosticLockKey(workspaceId), async () => {
    const current = await getDiagnostic(workspaceId);
    const merged: DiagnosticCategories = { ...current.categories };
    merged[categoryId] = mergeEntry(merged[categoryId], entry);
    return writeDiagnosticRaw(workspaceId, { categories: merged });
  });
}
