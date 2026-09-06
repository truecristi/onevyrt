/**
 * Presentation & trust checklist — the fourth Psychology area ("how it looks
 * when you show it"). A curated set of landing-page presentation essentials the
 * owner checks off; a readiness score keeps it honest. Deliberately a guided
 * self-audit, not an automated scan — the visual build itself lives in Brand.
 *
 * Pure and server-free: items + scoring live here so the page and unit tests
 * share one source of truth. Check state persists client-side (localStorage);
 * no store or migration needed.
 */

export type PresentationGroup = "Clarity" | "Trust" | "Craft";

export interface PresentationItem {
  id: string;
  group: PresentationGroup;
  label: string;
  hint: string;
}

export const PRESENTATION_GROUPS: PresentationGroup[] = ["Clarity", "Trust", "Craft"];

export const PRESENTATION_ITEMS: PresentationItem[] = [
  // — Clarity —
  { id: "hero", group: "Clarity", label: "The hero states the offer in one sentence", hint: "A visitor should know what you do and who it's for in five seconds." },
  { id: "benefit", group: "Clarity", label: "The headline leads with the outcome, not features", hint: "What they get, not what it is — the transformation over the mechanism." },
  { id: "one-cta", group: "Clarity", label: "One primary call to action, repeated", hint: "The same action down the page beats three competing buttons." },
  { id: "above-fold", group: "Clarity", label: "The next step is obvious above the fold", hint: "Don't make them scroll to find out how to say yes." },
  { id: "one-idea", group: "Clarity", label: "One idea per section — uncluttered", hint: "Cut copy until each section makes a single point." },

  // — Trust —
  { id: "proof", group: "Trust", label: "Real proof is visible (testimonials, logos, numbers)", hint: "Specific proof from real people beats adjectives." },
  { id: "guarantee", group: "Trust", label: "A guarantee / risk reversal is shown", hint: "Reversing the risk near the CTA lifts conversions." },
  { id: "objection", group: "Trust", label: "The top objection is answered near the CTA", hint: "Handle the biggest doubt right where they decide." },

  // — Craft —
  { id: "mobile", group: "Craft", label: "It reads cleanly at phone width", hint: "Most visitors are on mobile — no squashed grids or tiny text." },
  { id: "brand", group: "Craft", label: "Brand is consistent — colour, logo, voice", hint: "One look and one voice across every asset builds recognition." },
];

export interface PresentationScore { done: number; total: number; score: number; }

/** Readiness score: percentage of items checked (0–100). */
export function scorePresentation(checked: Iterable<string>): PresentationScore {
  const set = checked instanceof Set ? checked : new Set(checked);
  const ids = new Set(PRESENTATION_ITEMS.map((i) => i.id));
  let done = 0;
  for (const id of set) if (ids.has(id)) done += 1;
  const total = PRESENTATION_ITEMS.length;
  return { done, total, score: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function itemsByGroup(group: PresentationGroup): PresentationItem[] {
  return PRESENTATION_ITEMS.filter((i) => i.group === group);
}

/** Keep only real, known item ids (deduped) — used before persisting so a
 *  stale or hand-edited value can never poison the store or the score. */
export function sanitizeCheckedIds(v: unknown): string[] {
  const ids = new Set(PRESENTATION_ITEMS.map((i) => i.id));
  const arr = Array.isArray(v) ? v : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    if (typeof x !== "string" || !ids.has(x) || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}
