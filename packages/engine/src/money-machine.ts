/**
 * Money Machine (Force 5 / Phase 2): turns profit the engine already computes
 * into owner freedom. A Freedom Fund percentage is set aside from profit first,
 * then split across Security, Growth and Dream buckets. Pure math over numbers
 * the simulator already produces — no new financial model, just an allocation
 * lens on top of it.
 */
export interface MoneyMachineConfig {
  freedomFundRate: number; // 0..1, share of profit set aside
  securityRate: number;    // 0..1, share of the Freedom Fund
  growthRate: number;      // 0..1, share of the Freedom Fund
  dreamRate: number;       // 0..1, share of the Freedom Fund
}

export const DEFAULT_MONEY_MACHINE_CONFIG: MoneyMachineConfig = {
  freedomFundRate: 0.1,
  securityRate: 0.5,
  growthRate: 0.3,
  dreamRate: 0.2,
};

export interface MoneyMachineProjection {
  monthlyProfit: number; // minor units
  annualProfit: number;  // minor units
  freedomFundMonthly: number;
  freedomFundAnnual: number;
  securityMonthly: number;
  growthMonthly: number;
  dreamMonthly: number;
  securityAnnual: number;
  growthAnnual: number;
  dreamAnnual: number;
}

/** Bucket rates need not sum to exactly 1 (rounding, in-progress edits) — this
 *  normalises them so the split always accounts for the whole Freedom Fund. */
function normalizedBucketRates(cfg: MoneyMachineConfig): { security: number; growth: number; dream: number } {
  const total = cfg.securityRate + cfg.growthRate + cfg.dreamRate;
  if (total <= 0) return { security: 0, growth: 0, dream: 0 };
  return { security: cfg.securityRate / total, growth: cfg.growthRate / total, dream: cfg.dreamRate / total };
}

/** monthlyProfit is the funnel's monthly gross profit, in minor units. */
export function projectMoneyMachine(monthlyProfit: number, cfg: MoneyMachineConfig): MoneyMachineProjection {
  const annualProfit = monthlyProfit * 12;
  const freedomFundMonthly = Math.round(monthlyProfit * cfg.freedomFundRate);
  const freedomFundAnnual = freedomFundMonthly * 12;
  const { security, growth, dream } = normalizedBucketRates(cfg);
  const securityMonthly = Math.round(freedomFundMonthly * security);
  const growthMonthly = Math.round(freedomFundMonthly * growth);
  const dreamMonthly = freedomFundMonthly - securityMonthly - growthMonthly; // remainder, exact conservation
  return {
    monthlyProfit, annualProfit, freedomFundMonthly, freedomFundAnnual,
    securityMonthly, growthMonthly, dreamMonthly,
    securityAnnual: securityMonthly * 12, growthAnnual: growthMonthly * 12, dreamAnnual: dreamMonthly * 12,
  };
}
