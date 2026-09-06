/**
 * The golden ratio as a design primitive. Proportions and scales in the UI
 * derive from φ so relationships read as harmonious rather than arbitrary:
 * card shape, a type scale, and a spacing scale all step by φ (or its inverse).
 *
 * φ  = 1.618… (long/short)
 * 1/φ = 0.618… (short/long) — a golden portrait card is this wide vs tall.
 */
export const PHI = 1.618033988749895;
export const INV_PHI = 1 / PHI; // 0.6180339…

/** A golden portrait aspect ratio (width / height) — taller than wide. */
export const GOLDEN_PORTRAIT = INV_PHI;
/** A golden landscape aspect ratio (width / height) — wider than tall. */
export const GOLDEN_LANDSCAPE = PHI;

/**
 * A type scale stepping by φ from a base size. `goldenType(0)` is the base;
 * positive steps grow by √φ per step (a gentle golden progression that keeps
 * body/heading sizes usable — a full φ per step is too aggressive for text),
 * negative steps shrink. Rounded to the nearest 0.5px.
 */
const TYPE_RATIO = Math.sqrt(PHI); // ≈1.272 per step — a calmer golden cadence
export function goldenType(step: number, base = 15): number {
  return Math.round(base * TYPE_RATIO ** step * 2) / 2;
}

/**
 * A spacing scale stepping by φ from a base unit — for gaps/padding that should
 * feel proportional to each other. Rounded to whole pixels.
 */
export function goldenSpace(step: number, base = 8): number {
  return Math.round(base * PHI ** step);
}
