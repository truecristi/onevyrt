/**
 * Assumption Register: a business model is only as reliable as the
 * assumptions underneath it (a conversion rate, a retention number, "this
 * channel will keep working"). This makes those assumptions explicit,
 * separate from the risk register (a risk is a bad thing that COULD happen;
 * an assumption is a belief the plan is already resting on, right now,
 * whether or not anyone's said it out loud). Pure data + pure summary, no UI.
 */
export type AssumptionConfidence = "low" | "medium" | "high";
export type AssumptionStatus = "untested" | "testing" | "confirmed" | "invalidated";

export interface AssumptionEntry {
  id: string;
  text: string;
  confidence: AssumptionConfidence;
  status: AssumptionStatus;
  createdAt: string;
  category?: string;
  evidenceFor?: string;
  evidenceAgainst?: string;
  owner?: string;
  testByDate?: string;
  linkedNodeId?: string;
  reviewedAt?: string;
}

export interface AssumptionSummary {
  total: number;
  untested: number;
  testing: number;
  confirmed: number;
  invalidated: number;
  /** The specific combination worth surfacing on its own: something the plan
   *  is leaning on with high confidence, that has never actually been
   *  tested. High confidence without evidence is exactly the failure mode
   *  this register exists to catch. */
  overconfident: AssumptionEntry[];
  /** Invalidated but not yet marked reviewed — a signal the rest of the plan
   *  (forces, canvas, brief) may still be resting on something already
   *  known to be false. */
  unreviewedInvalidated: AssumptionEntry[];
}

export function summarizeAssumptions(assumptions: readonly AssumptionEntry[]): AssumptionSummary {
  const summary: AssumptionSummary = {
    total: assumptions.length, untested: 0, testing: 0, confirmed: 0, invalidated: 0,
    overconfident: [], unreviewedInvalidated: [],
  };
  for (const a of assumptions) {
    if (a.status === "untested") summary.untested++;
    else if (a.status === "testing") summary.testing++;
    else if (a.status === "confirmed") summary.confirmed++;
    else if (a.status === "invalidated") summary.invalidated++;
    if (a.confidence === "high" && a.status === "untested") summary.overconfident.push(a);
    if (a.status === "invalidated" && !a.reviewedAt) summary.unreviewedInvalidated.push(a);
  }
  return summary;
}
