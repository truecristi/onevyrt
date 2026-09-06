/**
 * DECIDE + MEASURE: the closing half of the Reality Loop. A Decision records a
 * planned change (problem, hypothesis, move, expected impact...). A Measurement
 * closes it with baseline/expected/observed, and the outcome is computed
 * deterministically. Pure + testable; the UI supplies ids and timestamps.
 */
export type Confidence = "low" | "medium" | "high";
export type DecisionStatus = "open" | "measured";
export type Outcome = "hit" | "partial" | "missed" | "inconclusive";

export interface Measurement {
  baseline: number;
  expected: number;
  observed: number;
  outcome: Outcome;
  learning: string;
  measuredAt: string;
}

export interface Decision {
  id: string;
  createdAt: string;
  problem: string;
  hypothesis: string;
  move: string;
  reason: string;
  expectedImpact: string;
  confidence: Confidence;
  owner: string;
  dueDate: string;
  linkedNodeId?: string;
  status: DecisionStatus;
  measurement?: Measurement;
  /** Sign-off record: who approved this move, and when. Absent means unapproved. */
  approvedBy?: string;
  approvedAt?: string;
}

/** Returns a copy of the decision with a sign-off attached. Pure — never mutates. */
export function approveDecision(d: Decision, approvedBy: string, approvedAt = new Date().toISOString()): Decision {
  return { ...d, approvedBy, approvedAt };
}

/** Returns a copy of the decision with its sign-off removed. */
export function revokeApproval(d: Decision): Decision {
  const { approvedBy: _approvedBy, approvedAt: _approvedAt, ...rest } = d;
  return rest;
}

/** Did the observed result move far enough in the intended direction? */
export function outcomeOf(baseline: number, expected: number, observed: number): Outcome {
  const target = expected - baseline;
  if (target === 0) return "inconclusive";
  const move = observed - baseline;
  const sameDirection = (move > 0 && target > 0) || (move < 0 && target < 0);
  if (!sameDirection || move === 0) return "missed";
  return Math.abs(move) >= Math.abs(target) ? "hit" : "partial";
}

/** Close a decision with a measurement; returns a NEW decision (no mutation). */
export function closeDecision(
  d: Decision,
  m: { baseline: number; expected: number; observed: number; learning: string; measuredAt: string },
): Decision {
  return {
    ...d,
    status: "measured",
    measurement: { ...m, outcome: outcomeOf(m.baseline, m.expected, m.observed) },
  };
}

export interface DecisionSummary {
  total: number; open: number; measured: number;
  hit: number; partial: number; missed: number; inconclusive: number;
}

export function summarizeDecisions(decisions: Decision[]): DecisionSummary {
  const s: DecisionSummary = { total: 0, open: 0, measured: 0, hit: 0, partial: 0, missed: 0, inconclusive: 0 };
  for (const d of decisions) {
    s.total++;
    if (d.status === "open") s.open++;
    else {
      s.measured++;
      const o = d.measurement?.outcome;
      if (o === "hit") s.hit++;
      else if (o === "partial") s.partial++;
      else if (o === "missed") s.missed++;
      else s.inconclusive++;
    }
  }
  return s;
}
