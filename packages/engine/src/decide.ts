/**
 * Decide: the coaching decision layer (Phase 7). Distinct from the canvas's
 * Decision Log (loop.ts) — that's a running record of decisions already
 * made; this is "given everything else already computed (Forces, Risk,
 * Variance), what actually matters most right now." Pure aggregation, no
 * new math — every number here already comes from an existing engine
 * function, this module just picks out the ones worth surfacing.
 */
import type { ForceActionItem } from "./program.ts";
import type { RiskReport, Sensitivity } from "./risk.ts";
import type { VarianceReport, NodeVariance } from "./variance.ts";

const CONFIDENCE_WEIGHT: Record<string, number> = { high: 1, medium: 0.7, low: 0.4 };

export interface BottleneckFinding {
  source: "measured" | "modeled";
  label: string;
  detail: string;
}

export interface DecidePhaseSummary {
  /** The single open/in-progress action with the most confidence-weighted
   *  dollar value on the table — the thing to do next if you can only do one. */
  highestLeverageAction: ForceActionItem | null;
  /** From actual variance data when it exists (a real, measured leak);
   *  otherwise the model's single most profit-sensitive lever, clearly
   *  labeled as modeled rather than observed. */
  biggestBottleneck: BottleneckFinding | null;
  /** The open/in-progress action with a dollar value and the nearest
   *  deadline — the fastest plausible cash-in-hand improvement, not
   *  necessarily the biggest one. */
  fastestCashImprovement: ForceActionItem | null;
  /** The risk engine's own headline — already a single sentence, so this
   *  is passed through rather than re-derived. */
  biggestRisk: string | null;
  /** One-sentence synthesis of the above, for a Decide summary. */
  decisionSummary: string;
  generatedAt: string;
}

function actionScore(a: ForceActionItem): number {
  return (a.dollarValue ?? 0) * (CONFIDENCE_WEIGHT[a.confidence ?? "medium"] ?? 0.7);
}

export function pickHighestLeverageAction(forceActions: ForceActionItem[]): ForceActionItem | null {
  const open = forceActions.filter((a) => a.status !== "done" && (a.dollarValue ?? 0) > 0);
  if (open.length === 0) return null;
  return [...open].sort((a, b) => actionScore(b) - actionScore(a))[0];
}

export function pickFastestCashImprovement(forceActions: ForceActionItem[]): ForceActionItem | null {
  const withDeadline = forceActions.filter((a) => a.status !== "done" && (a.dollarValue ?? 0) > 0 && a.deadline);
  if (withDeadline.length === 0) return null;
  return [...withDeadline].sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string))[0];
}

function biggestVarianceLeak(variance: VarianceReport | null): NodeVariance | null {
  return variance?.biggestLeak ?? null;
}
function topSensitivity(risk: RiskReport | null): Sensitivity | null {
  return risk?.sensitivities?.[0] ?? null;
}

export function buildDecidePhaseSummary(
  forceActions: ForceActionItem[],
  risk: RiskReport | null,
  variance: VarianceReport | null,
  generatedAt = new Date().toISOString(),
): DecidePhaseSummary {
  const highestLeverageAction = pickHighestLeverageAction(forceActions);
  const fastestCashImprovement = pickFastestCashImprovement(forceActions);

  const leak = biggestVarianceLeak(variance);
  const sensitivity = topSensitivity(risk);
  const biggestBottleneck: BottleneckFinding | null = leak
    ? { source: "measured", label: leak.nodeId, detail: `Reality is running ${leak.profitImpact < 0 ? "behind" : "ahead of"} plan here — the biggest measured swing in profit.` }
    : sensitivity
      ? { source: "modeled", label: sensitivity.label, detail: `Not measured yet — but a 10% move in ${sensitivity.field} here swings modeled profit more than anywhere else in the plan.` }
      : null;

  const biggestRisk = risk?.headline ?? null;

  const parts: string[] = [];
  if (highestLeverageAction) parts.push(`Highest leverage: ${highestLeverageAction.actionItem}.`);
  if (biggestBottleneck) parts.push(`Watch: ${biggestBottleneck.label} (${biggestBottleneck.source}).`);
  if (biggestRisk) parts.push(biggestRisk);
  const decisionSummary = parts.length > 0 ? parts.join(" ") : "Not enough data yet — log a Force action with a dollar value, or run a risk assessment, to get a real recommendation here.";

  return { highestLeverageAction, biggestBottleneck, fastestCashImprovement, biggestRisk, decisionSummary, generatedAt };
}
