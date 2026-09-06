/**
 * Unit-economics break-even ("how many do I have to sell to stop losing
 * money?"): the classic fixed-cost / contribution-margin calculation, for the
 * MODEL layer where the user is putting real numbers on the plan.
 *
 * This is intentionally distinct from risk.ts's `BreakEven`, which asks how
 * far the funnel's traffic/conversion can slip before the graph's profit hits
 * zero. This one works from three plain numbers a founder already knows —
 * fixed costs, price, and variable cost per unit — and answers the textbook
 * break-even and margin-of-safety questions in minor units.
 *
 * All money is in minor units (cents). Units are whole things sold.
 */
export interface UnitBreakEvenInputs {
  /** fixed costs for the period (rent, salaries, tools…), minor units. */
  fixedCosts: number;
  /** price charged per unit, minor units. */
  pricePerUnit: number;
  /** variable cost incurred per unit sold (COGS, fees…), minor units. */
  variableCostPerUnit: number;
}

export interface UnitBreakEvenResult {
  /** price - variable cost, the profit each sale contributes to fixed costs
   *  (minor units). Can be negative if you lose money on every unit. */
  contributionPerUnit: number;
  /** contributionPerUnit / price, 0..1. null when price is 0 (no ratio). */
  contributionMarginPct: number | null;
  /** units you must sell to cover fixed costs, rounded UP to a whole unit.
   *  null when contribution per unit is <= 0 — you can never break even by
   *  selling more, because each sale loses money or adds nothing. */
  breakEvenUnits: number | null;
  /** revenue at the break-even point (breakEvenUnits * price), minor units.
   *  null whenever breakEvenUnits is null. */
  breakEvenRevenue: number | null;
  /** profit at `currentUnits` (contribution * units - fixed), minor units.
   *  null when currentUnits was not supplied. */
  currentProfit: number | null;
  /** how far current volume sits above break-even, in units
   *  (currentUnits - breakEvenUnits). Negative means below break-even. null
   *  when currentUnits was not supplied or break-even is unreachable. */
  marginOfSafetyUnits: number | null;
  /** marginOfSafetyUnits / currentUnits, the fraction of sales you could lose
   *  before hitting break-even. null when not computable (no currentUnits,
   *  currentUnits <= 0, or unreachable break-even). */
  marginOfSafetyPct: number | null;
}

/**
 * Compute break-even and, optionally, margin of safety against a current
 * sales volume.
 *
 * @param inputs      fixed costs, price, variable cost per unit (minor units).
 * @param currentUnits optional current/planned units sold, to derive current
 *                     profit and margin of safety.
 */
export function computeUnitBreakEven(
  inputs: UnitBreakEvenInputs,
  currentUnits?: number,
): UnitBreakEvenResult {
  const { fixedCosts, pricePerUnit, variableCostPerUnit } = inputs;
  const contributionPerUnit = pricePerUnit - variableCostPerUnit;

  const contributionMarginPct = pricePerUnit !== 0
    ? contributionPerUnit / pricePerUnit
    : null;

  const canBreakEven = contributionPerUnit > 0;
  const breakEvenUnits = canBreakEven ? Math.ceil(fixedCosts / contributionPerUnit) : null;
  const breakEvenRevenue = breakEvenUnits !== null ? breakEvenUnits * pricePerUnit : null;

  const hasCurrent = typeof currentUnits === "number" && Number.isFinite(currentUnits);
  const currentProfit = hasCurrent
    ? Math.round(contributionPerUnit * currentUnits! - fixedCosts)
    : null;

  const marginOfSafetyUnits = hasCurrent && breakEvenUnits !== null
    ? currentUnits! - breakEvenUnits
    : null;

  const marginOfSafetyPct = marginOfSafetyUnits !== null && currentUnits! > 0
    ? marginOfSafetyUnits / currentUnits!
    : null;

  return {
    contributionPerUnit,
    contributionMarginPct,
    breakEvenUnits,
    breakEvenRevenue,
    currentProfit,
    marginOfSafetyUnits,
    marginOfSafetyPct,
  };
}

/**
 * How many units you must sell to reach a target PROFIT for the period (not
 * just break even). It's the break-even calculation with the target folded
 * into the fixed costs you have to cover: ceil((fixedCosts + targetProfit) /
 * contributionPerUnit).
 *
 * Returns null when each sale contributes nothing (contribution per unit <= 0),
 * because no volume can reach the goal. A target of 0 is exactly break-even.
 * A negative target (an acceptable loss) is honoured and floored at 0 units.
 *
 * @param inputs       fixed costs, price, variable cost per unit (minor units).
 * @param targetProfit the profit you want for the period, minor units.
 */
export function unitsForTargetProfit(
  inputs: UnitBreakEvenInputs,
  targetProfit: number,
): number | null {
  const contributionPerUnit = inputs.pricePerUnit - inputs.variableCostPerUnit;
  if (contributionPerUnit <= 0) return null;
  return Math.max(0, Math.ceil((inputs.fixedCosts + targetProfit) / contributionPerUnit));
}
