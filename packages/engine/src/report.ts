/**
 * Report: assemble a client-facing summary from everything the engine knows —
 * plan totals, the profit leak (variance), the corrected forecast (calibration),
 * and the decision log. Pure: it derives, never mutates. Self-describing: it
 * carries node labels so a rendered/exported report needs nothing else.
 */
import type { Minor } from "./money.ts";
import type { Funnel, SimulationResult } from "./types.ts";
import type { Actuals } from "./actuals.ts";
import type { Decision } from "./loop.ts";
import { aggregateActuals, hasActuals } from "./actuals.ts";
import { computeVariance, type VarianceReport } from "./variance.ts";
import { computeCalibration, correctedForecast, type CalibrationReport } from "./calibrate.ts";
import { summarizeDecisions, type DecisionSummary } from "./loop.ts";

export interface ReportHeadline {
  planProfit: Minor;
  actualProfit: Minor | null;
  correctedProfit: Minor | null;
  profitGap: Minor | null;
  biggestLeakLabel: string | null;
  biggestLeakImpact: Minor | null;
}

export interface FunnelReport {
  name: string;
  generatedAt: string;
  labels: Record<string, string>;
  planTotals: SimulationResult["totals"];
  headline: ReportHeadline;
  variance: VarianceReport | null;
  calibration: CalibrationReport | null;
  decisions: { summary: DecisionSummary; items: Decision[] };
}

export function buildReport(
  name: string,
  funnel: Funnel,
  plan: SimulationResult,
  actuals: Actuals,
  decisions: Decision[],
  generatedAt: string,
): FunnelReport {
  const labels: Record<string, string> = {};
  for (const n of funnel.nodes) labels[n.id] = n.label ?? n.id;

  const has = hasActuals(actuals);
  const variance = has ? computeVariance(plan, actuals) : null;
  const calibration = has ? computeCalibration(funnel, plan, actuals) : null;
  const corrected = calibration && calibration.proposals.length ? correctedForecast(funnel, calibration.proposals) : null;
  const actualTotals = has ? aggregateActuals(actuals) : null;
  const biggest = variance?.biggestLeak ?? null;

  return {
    name,
    generatedAt,
    labels,
    planTotals: plan.totals,
    headline: {
      planProfit: plan.totals.grossProfit,
      actualProfit: actualTotals ? actualTotals.grossProfit : null,
      correctedProfit: corrected ? corrected.totals.grossProfit : null,
      profitGap: variance ? variance.profitGap : null,
      biggestLeakLabel: biggest ? (labels[biggest.nodeId] ?? biggest.nodeId) : null,
      biggestLeakImpact: biggest ? biggest.profitImpact : null,
    },
    variance,
    calibration,
    decisions: { summary: summarizeDecisions(decisions), items: decisions },
  };
}
