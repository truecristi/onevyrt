/**
 * Profit-driver sensitivity ("which lever should I pull first?"): a decision
 * lens built directly on top of the 5 Profit Drivers model (see
 * profit-drivers.ts), not a new model of its own. It applies the SAME test
 * lift to each of the five levers one at a time and measures the profit each
 * one moves in isolation, then ranks them biggest-first — a tornado view of
 * where this specific business's leverage actually is.
 *
 * This is deliberately different from risk.ts's `Sensitivity`, which perturbs
 * node fields on the funnel graph. This one speaks the coaching model's
 * language (leads, sales process, conversion, transaction value, retention)
 * so it can sit next to the Profit Drivers panel and answer "of these five,
 * which is worth working on for us?".
 */
import {
  simulateProfitDrivers,
  DEFAULT_PROFIT_DRIVER_INPUTS,
  type ProfitDriverBaseline,
  type ProfitDriverInputs,
} from "./profit-drivers.ts";

/** The five levers, as keys of ProfitDriverInputs. */
export type ProfitDriverKey = keyof ProfitDriverInputs;

/** Human labels for each lever, matching the Profit Drivers panel wording. */
export const PROFIT_DRIVER_LABELS: Record<ProfitDriverKey, string> = {
  leadsPct: "Leads / Traffic",
  salesProcessPct: "Sales Process",
  conversionPct: "Conversion",
  transactionValuePct: "Transaction Value",
  retentionPct: "Retention / Follow-up",
};

/** Stable ordering of the levers, so callers that don't sort still get a
 *  predictable sequence (matches the Profit Drivers input order). */
export const PROFIT_DRIVER_KEYS: readonly ProfitDriverKey[] = [
  "leadsPct",
  "salesProcessPct",
  "conversionPct",
  "transactionValuePct",
  "retentionPct",
];

export interface DriverSensitivity {
  driver: ProfitDriverKey;
  label: string;
  /** profit change (minor units) from applying the test lift to THIS lever
   *  alone, everything else held at baseline. */
  profitLift: number;
  /** profitLift as a ratio of |baseline profit|; null when baseline profit is
   *  exactly 0 (a lift over nothing has no meaningful ratio). */
  profitLiftPct: number | null;
  /** 1 = the highest-leverage driver at this test lift. Ties share the lower
   *  rank number (both rank 1) and the next distinct value skips accordingly. */
  rank: number;
  /** this lift as a fraction of the top driver's lift, 0..1. Lets a UI draw
   *  tornado bars relative to the winner. null when the top lift is <= 0 (no
   *  lever helps, so "share of the best" is undefined). */
  shareOfTop: number | null;
}

export interface DriverSensitivityResult {
  /** the uniform % lift applied to each lever in isolation (e.g. 0.1 = +10%). */
  testLift: number;
  /** every lever, sorted by profitLift descending (tornado order). */
  drivers: DriverSensitivity[];
  /** the highest-leverage lever, or null when no lever produces a positive
   *  lift (e.g. testLift of 0, or a degenerate baseline). */
  topDriver: ProfitDriverKey | null;
  /** baseline profit (revenue - cost), minor units — the reference the lifts
   *  are measured against. */
  baselineProfit: number;
}

/**
 * Rank the five profit drivers by the profit each moves at an equal test lift.
 *
 * @param baseline current revenue/cost of the business (minor units).
 * @param testLift the % lift to apply to each lever in isolation. Defaults to
 *   +10%, the classic "small improvements compound" figure the model uses.
 */
export function analyzeDriverSensitivity(
  baseline: ProfitDriverBaseline,
  testLift = 0.1,
): DriverSensitivityResult {
  const baselineProfit = baseline.revenue - baseline.cost;

  const raw = PROFIT_DRIVER_KEYS.map((driver) => {
    const inputs: ProfitDriverInputs = { ...DEFAULT_PROFIT_DRIVER_INPUTS, [driver]: testLift };
    const r = simulateProfitDrivers(baseline, inputs);
    return {
      driver,
      label: PROFIT_DRIVER_LABELS[driver],
      profitLift: r.profitLift,
      profitLiftPct: r.profitLiftPct,
    };
  });

  // Sort biggest lift first. Ties broken by the stable lever order so the
  // result is fully deterministic.
  raw.sort((a, b) => {
    if (b.profitLift !== a.profitLift) return b.profitLift - a.profitLift;
    return PROFIT_DRIVER_KEYS.indexOf(a.driver) - PROFIT_DRIVER_KEYS.indexOf(b.driver);
  });

  const topLift = raw.length > 0 ? raw[0].profitLift : 0;

  const drivers: DriverSensitivity[] = raw.map((d, i) => ({
    ...d,
    // Standard competition ranking ("1224"): equal lifts share a rank, and
    // the next distinct lift skips to its ordinal position.
    rank: i > 0 && raw[i - 1].profitLift === d.profitLift ? -1 : i + 1,
    shareOfTop: topLift > 0 ? d.profitLift / topLift : null,
  }));
  for (let i = 1; i < drivers.length; i++) {
    if (drivers[i].rank === -1) drivers[i].rank = drivers[i - 1].rank;
  }

  return {
    testLift,
    drivers,
    topDriver: topLift > 0 ? drivers[0].driver : null,
    baselineProfit,
  };
}
