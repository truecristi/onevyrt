/**
 * Experiment Register: hypothesis -> experiment -> result -> decision. Kept
 * separate from the Decision Log (loop.ts) — a Decision there is "we're
 * making this change," already committed; an experiment here is "we don't
 * know yet, so we're testing it first," and only becomes a Decision once it
 * actually resolves. Can optionally point at the specific assumption it's
 * testing, closing the loop that assumption-register alone can't: an
 * assumption doesn't really get "tested" by being marked confident, it gets
 * tested by an actual experiment with a real result. Pure data, no UI.
 */
export type ExperimentStatus = "planned" | "running" | "completed" | "abandoned";
/** "reject" is a deprecated synonym for "stop", kept so existing stored data
 *  still reads correctly — new writes should use "stop". */
export type ExperimentDecision = "adopt" | "iterate" | "retest" | "stop" | "insufficient_evidence" | "reject";
/** Same 3-point scale as AssumptionConfidence (assumptions.ts) — reused
 *  rather than inventing a second confidence vocabulary. This is confidence
 *  IN THE RESULT (how much to trust it), not confidence in the hypothesis
 *  going in. */
export type ExperimentConfidence = "low" | "medium" | "high";

export interface ExperimentEntry {
  id: string;
  hypothesis: string;
  status: ExperimentStatus;
  createdAt: string;
  /** What is actually being measured (e.g. "opt-in conversion rate"). */
  metric?: string;
  /** Where that metric stood before the experiment started. */
  baseline?: string;
  sampleSize?: number;
  /** What counts as success — doubles as the spec's "target" (the value the
   *  metric needs to reach), stored as free text since a threshold isn't
   *  always a bare number ("statistically significant at n>200"). */
  successThreshold?: string;
  /** How the test is actually run — the method, not just the hypothesis. */
  testDesign?: string;
  /** Who is being tested (a segment, a channel, a cohort). */
  audience?: string;
  /** Who is accountable for running this experiment to a result. */
  owner?: string;
  cost?: number;
  startDate?: string;
  endDate?: string;
  /** What happened, factually. */
  result?: string;
  /** How much to trust that result. */
  confidence?: ExperimentConfidence;
  decision?: ExperimentDecision;
  /** What this experiment changed our minds about — distinct from `result`
   *  (the fact) vs. this (the belief it produced). */
  learning?: string;
  /** A "retest"/"iterate" decision often spawns a new experiment — link to
   *  it so the chain stays traceable instead of orphaned. */
  followUpExperimentId?: string;
  linkedNodeId?: string;
  /** The assumption this experiment exists to actually test. */
  linkedAssumptionId?: string;
}

export interface ExperimentSummary {
  total: number;
  planned: number;
  running: number;
  completed: number;
  abandoned: number;
  /** Completed, but nobody's recorded what to actually DO about the result —
   *  the exact gap that turns "we ran a test" into "and then nothing
   *  changed." */
  awaitingDecision: ExperimentEntry[];
}

export function summarizeExperiments(experiments: readonly ExperimentEntry[]): ExperimentSummary {
  const summary: ExperimentSummary = { total: experiments.length, planned: 0, running: 0, completed: 0, abandoned: 0, awaitingDecision: [] };
  for (const e of experiments) {
    if (e.status === "planned") summary.planned++;
    else if (e.status === "running") summary.running++;
    else if (e.status === "completed") summary.completed++;
    else if (e.status === "abandoned") summary.abandoned++;
    if (e.status === "completed" && !e.decision) summary.awaitingDecision.push(e);
  }
  return summary;
}
