/**
 * Calendar projection: takes the current plan's monthly baseline and rolls it
 * forward N months, optionally compounding a growth rate (e.g. reinvesting
 * profit into more traffic) — the "where does this go if nothing changes but
 * scale" question that a single month's numbers can't answer on their own.
 * Same unit economics assumed to hold at every scale (a simplification, not a
 * claim that CAC/conversion stay flat forever — worth surfacing as a caveat
 * in the UI, not something this pure function needs to know about).
 */
export interface MonthlyBaseline {
  visitors: number;
  revenue: number; // minor units
  cost: number;    // minor units
}

export interface MonthProjection {
  month: number; // 1-indexed
  visitors: number;
  revenue: number;
  cost: number;
  profit: number;
  cumulativeProfit: number;
}

export function projectMonths(baseline: MonthlyBaseline, months: number, growthRatePerMonth: number): MonthProjection[] {
  const out: MonthProjection[] = [];
  let cumulative = 0;
  for (let m = 1; m <= months; m++) {
    const multiplier = Math.pow(1 + growthRatePerMonth, m - 1);
    const visitors = Math.round(baseline.visitors * multiplier);
    const revenue = Math.round(baseline.revenue * multiplier);
    const cost = Math.round(baseline.cost * multiplier);
    const profit = revenue - cost;
    cumulative += profit;
    out.push({ month: m, visitors, revenue, cost, profit, cumulativeProfit: cumulative });
  }
  return out;
}
