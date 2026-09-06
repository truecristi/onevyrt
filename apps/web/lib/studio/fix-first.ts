/**
 * "What to fix first" — folds the funnel's separate warning signals (money
 * leaks, below-benchmark conversion, weak landing-audit scores, overdue
 * decisions, high-severity risks) into one list ranked by urgency, so the
 * user sees the single highest-leverage thing to fix next instead of five
 * separate panels. Pure and dependency-free so it's unit-testable.
 */
export type FixKind = "leak" | "benchmark" | "audit" | "decision" | "risk" | "actionItem";

export interface FixSignal {
  kind: FixKind;
  title: string;
  detail: string;
  /** dollars/mo at stake, when known — drives ranking for money signals */
  impact?: number;
  /** 0..100 urgency used to rank non-money signals */
  weight: number;
  nodeId?: string;
}

export interface FixItem extends FixSignal {
  rank: number;
}

// Base weights per kind: a real money leak outranks a soft benchmark nudge.
const KIND_WEIGHT: Record<FixKind, number> = {
  leak: 100, decision: 80, audit: 60, benchmark: 45, risk: 70, actionItem: 70,
};

/** Score one signal 0..1000ish. Money impact dominates when present; otherwise
 *  the signal's own weight blended with its kind weight. */
export function scoreSignal(s: FixSignal): number {
  const kind = KIND_WEIGHT[s.kind] ?? 40;
  const money = typeof s.impact === "number" && Number.isFinite(s.impact) ? Math.min(500, Math.abs(s.impact) / 100) : 0;
  return kind + s.weight * 0.5 + money;
}

/** Rank signals highest-urgency first and stamp a 1-based rank. Ties break by
 *  kind weight so the ordering is stable across runs. */
export function rankFixes(signals: FixSignal[]): FixItem[] {
  return [...signals]
    .sort((a, b) => {
      const d = scoreSignal(b) - scoreSignal(a);
      if (d !== 0) return d;
      return (KIND_WEIGHT[b.kind] ?? 0) - (KIND_WEIGHT[a.kind] ?? 0);
    })
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
