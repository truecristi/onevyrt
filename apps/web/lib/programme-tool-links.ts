/**
 * Corrected tool destinations for programme modules — a read-time override
 * layer, same pattern as programme-manual.ts and for the same reason: the
 * engine's toolDeepLink values are seeded into the DB by a versioned
 * migration, but several of them land on the wrong or a generic screen
 * (audit-verified):
 *
 *   - m-start-assessment / m-business-definition pointed at /business, whose
 *     hub has no "Define" step and never shows the Readiness Score — both
 *     live in the Studio's Business Intelligence (ProgramCentre).
 *   - Four modules pointed at the bare /studio canvas, leaving the learner to
 *     hunt for the Goals / 7 Systems / Freedom Plan / Assumptions tabs.
 *   - Growth Mathematics, Business Economics and the Finish module pointed at
 *     /numbers, which contains neither the profit-driver sensitivity view,
 *     the Money Machine, nor the Readiness tab.
 *
 * /studio?panel=bi opens the Studio directly in Business Intelligence mode
 * (funnel-studio honours the param), so every one of these now lands where
 * the module's assignment actually happens. Fixing the links here means
 * edit-and-deploy with no migration; a module with no entry keeps its
 * DB-seeded link untouched.
 */

const TOOL_LINK_OVERRIDES: Readonly<Record<string, string>> = {
  "m-start-assessment": "/studio?panel=bi",
  "m-business-definition": "/studio?panel=bi",
  "m-founder-psychology": "/studio?panel=bi",
  "m-strategic-direction": "/studio?panel=bi",
  "m-personal-freedom-number": "/studio?panel=bi",
  "m-improvement-loop": "/studio?panel=bi",
  "m-growth-mathematics": "/studio?panel=bi",
  "m-business-economics": "/studio?panel=bi",
  "m-finish-transformation": "/studio?panel=bi",
};

/** The corrected tool href for a module, or the seeded fallback when no
 *  override exists. `fallback` is the (already route-validated) deep link. */
export function resolveToolHref(lessonId: string, fallback: string | null): string | null {
  return TOOL_LINK_OVERRIDES[lessonId] ?? fallback;
}
