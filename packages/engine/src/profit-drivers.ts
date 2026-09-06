/**
 * 5 Profit Drivers ("small improvements compound"): a coaching lens on top of
 * the real simulation, not a replacement for it. The user picks a % lift for
 * each of five classic growth levers — leads, sales-process effectiveness,
 * conversion, transaction value, retention/follow-up — and this shows the
 * compounded effect on revenue and profit versus the current model's
 * baseline. Traffic cost scales with the leads lift only; the other four
 * levers improve what happens to the same traffic, not its cost.
 */
export interface ProfitDriverInputs {
  leadsPct: number;             // e.g. 0.10 = +10% more leads/traffic
  salesProcessPct: number;      // +% more of those leads become real conversations/appointments
  conversionPct: number;        // +% more of those convert to a sale
  transactionValuePct: number;  // +% higher average order value
  retentionPct: number;         // +% more repeat/referral revenue
}

export const DEFAULT_PROFIT_DRIVER_INPUTS: ProfitDriverInputs = {
  leadsPct: 0, salesProcessPct: 0, conversionPct: 0, transactionValuePct: 0, retentionPct: 0,
};

export interface ProfitDriverBaseline {
  revenue: number; // minor units
  cost: number;    // minor units
}

export interface ProfitDriverResult {
  baseline: ProfitDriverBaseline;
  improved: ProfitDriverBaseline;
  profitBaseline: number;
  profitImproved: number;
  profitLift: number;         // improved profit - baseline profit, minor units
  profitLiftPct: number | null; // null when baseline profit is 0 (can't express a lift as a ratio of nothing)
  compoundMultiplier: number;   // the combined revenue multiplier from all 5 levers
}

export function simulateProfitDrivers(baseline: ProfitDriverBaseline, inputs: ProfitDriverInputs): ProfitDriverResult {
  const compoundMultiplier =
    (1 + inputs.leadsPct) * (1 + inputs.salesProcessPct) * (1 + inputs.conversionPct) *
    (1 + inputs.transactionValuePct) * (1 + inputs.retentionPct);

  const revenue = Math.round(baseline.revenue * compoundMultiplier);
  const cost = Math.round(baseline.cost * (1 + inputs.leadsPct));

  const profitBaseline = baseline.revenue - baseline.cost;
  const profitImproved = revenue - cost;
  const profitLift = profitImproved - profitBaseline;

  return {
    baseline, improved: { revenue, cost },
    profitBaseline, profitImproved, profitLift,
    profitLiftPct: profitBaseline !== 0 ? profitLift / Math.abs(profitBaseline) : null,
    compoundMultiplier,
  };
}
