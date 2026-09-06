/**
 * Business Readiness Score: one number that rolls up the three registers
 * (Goal Hierarchy, Assumption Register, Experiment Register) into a single
 * "how solid is this plan, really" signal — so a founder doesn't have to
 * check three tabs to notice the goals look fine but the plan is quietly
 * resting on three overconfident, untested assumptions. Pure data + pure
 * scoring, no UI.
 */
import { summarizeGoals, type GoalNode } from "./goals.ts";
import { summarizeAssumptions, type AssumptionEntry } from "./assumptions.ts";
import { summarizeExperiments, type ExperimentEntry } from "./experiments.ts";

export type ReadinessLabel = "no_data" | "fragile" | "developing" | "strong";

export interface ReadinessScore {
  /** null only when all three registers are empty — there is nothing to
   *  score yet, and reporting a numeric 0 there would read as "fragile"
   *  when the truth is just "not started." */
  score: number | null;
  label: ReadinessLabel;
  goalsScore: number | null;
  assumptionsScore: number | null;
  experimentsScore: number | null;
  /** Plain-language callouts, worst first, for whatever is actually dragging
   *  the score down right now — not a restatement of the numbers. */
  topIssues: string[];
  /** Soft nudges for registers that are still empty while at least one other
   *  register has data — distinct from topIssues: these aren't red flags
   *  found in what's logged, they're a reminder the score is only as
   *  complete as what's been entered. Empty whenever score is null (a
   *  totally blank plan is "not started," not "has gaps"). */
  gaps: string[];
}

const WEIGHTS = { goals: 0.4, assumptions: 0.3, experiments: 0.3 } as const;

function goalsScoreOf(goals: readonly GoalNode[]): number | null {
  if (goals.length === 0) return null;
  const s = summarizeGoals(goals);
  const points = s.done * 100 + s.onTrack * 65 + s.notStarted * 35 + s.atRisk * 0;
  return Math.round(points / s.total);
}

function assumptionsScoreOf(assumptions: readonly AssumptionEntry[]): number | null {
  if (assumptions.length === 0) return null;
  const s = summarizeAssumptions(assumptions);
  const penalty = s.overconfident.length * 15 + s.unreviewedInvalidated.length * 20;
  return Math.max(0, 100 - penalty);
}

function experimentsScoreOf(experiments: readonly ExperimentEntry[]): number | null {
  if (experiments.length === 0) return null;
  const s = summarizeExperiments(experiments);
  const penalty = s.awaitingDecision.length * 20;
  const stalePlanned = experiments.length > 0 && s.completed === 0 && s.abandoned === 0 ? 10 : 0;
  return Math.max(0, 100 - penalty - stalePlanned);
}

function labelFor(score: number | null): ReadinessLabel {
  if (score === null) return "no_data";
  if (score >= 80) return "strong";
  if (score >= 60) return "developing";
  return "fragile";
}

export function computeReadiness(
  goals: readonly GoalNode[],
  assumptions: readonly AssumptionEntry[],
  experiments: readonly ExperimentEntry[],
): ReadinessScore {
  const goalsScore = goalsScoreOf(goals);
  const assumptionsScore = assumptionsScoreOf(assumptions);
  const experimentsScore = experimentsScoreOf(experiments);

  const parts: { score: number; weight: number }[] = [];
  if (goalsScore !== null) parts.push({ score: goalsScore, weight: WEIGHTS.goals });
  if (assumptionsScore !== null) parts.push({ score: assumptionsScore, weight: WEIGHTS.assumptions });
  if (experimentsScore !== null) parts.push({ score: experimentsScore, weight: WEIGHTS.experiments });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = totalWeight === 0 ? null : Math.round(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight);

  const topIssues: string[] = [];
  const goalSummary = summarizeGoals(goals);
  const assumptionSummary = summarizeAssumptions(assumptions);
  const experimentSummary = summarizeExperiments(experiments);
  if (goalSummary.atRiskRoots.length > 0) {
    topIssues.push(`${goalSummary.atRiskRoots.length} top-level goal${goalSummary.atRiskRoots.length === 1 ? "" : "s"} at risk`);
  }
  if (assumptionSummary.overconfident.length > 0) {
    topIssues.push(`${assumptionSummary.overconfident.length} high-confidence assumption${assumptionSummary.overconfident.length === 1 ? "" : "s"} never tested`);
  }
  if (assumptionSummary.unreviewedInvalidated.length > 0) {
    topIssues.push(`${assumptionSummary.unreviewedInvalidated.length} invalidated assumption${assumptionSummary.unreviewedInvalidated.length === 1 ? "" : "s"} not yet reviewed`);
  }
  if (experimentSummary.awaitingDecision.length > 0) {
    topIssues.push(`${experimentSummary.awaitingDecision.length} completed experiment${experimentSummary.awaitingDecision.length === 1 ? "" : "s"} with no decision recorded`);
  }

  const gaps: string[] = [];
  if (score !== null) {
    if (goals.length === 0) gaps.push("No goals logged yet — add at least one so the score reflects real progress toward it.");
    if (assumptions.length === 0) gaps.push("No assumptions logged yet — every plan rests on some; write down the biggest one.");
    if (experiments.length === 0) gaps.push("No experiments logged yet — an assumption doesn't get tested by being marked confident, only by an actual experiment.");
  }

  return { score, label: labelFor(score), goalsScore, assumptionsScore, experimentsScore, topIssues, gaps };
}
