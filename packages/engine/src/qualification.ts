/**
 * Lead qualification: the pure brain of the acquisition funnel. Given a
 * visitor's answers and a set of rules, it decides whether the lead is a
 * qualified sales opportunity, a nurture candidate, or a reject — and where to
 * route them next. Deliberately pure and deterministic (same answers + rules
 * in → same verdict out), with no UI, no I/O and no dependence on the funnel
 * simulation. It is the piece that lets the system tell Meta about *qualified*
 * leads instead of every form-fill.
 *
 * Two layers, mirroring how real qualification works:
 *   - Hard gates: absolute disqualifiers (wrong country, under a revenue
 *     floor). Any gate that fires forces "unqualified", regardless of score.
 *   - Weighted rules: points awarded for signals of a good buyer (budget,
 *     urgency, decision-maker, right industry). The total, against a
 *     threshold, separates qualified from nurture.
 */

export type QualAnswer = string | string[] | number;
export type QualAnswers = Record<string, QualAnswer>;

/** Comparison operators for a single answer. Numeric ops coerce to number;
 *  `in`/`not_in`/`contains` work over string lists (multi-select answers). */
export type QualOp =
  | "equals" | "not_equals"
  | "in" | "not_in"
  | "gte" | "lte" | "gt" | "lt"
  | "contains"
  | "exists" | "missing";

export interface QualCondition {
  questionId: string;
  op: QualOp;
  /** compared against; unused for exists/missing */
  value?: QualAnswer;
}

/** A hard disqualifier. If `when` evaluates true, the lead is rejected. */
export interface QualGate {
  id: string;
  when: QualCondition;
  /** optional human-readable reason, surfaced to analytics, never to the lead */
  reason?: string;
}

/** A weighted signal. If `when` is true, `points` are added to the score.
 *  Points may be negative (a mild red flag that docks the score). */
export interface QualScoreRule {
  id: string;
  when: QualCondition;
  points: number;
}

export type QualStatus = "qualified" | "nurture" | "unqualified";

/** A routing rule, evaluated top-to-bottom; the first match wins. A route with
 *  no `status` and no `minScore` is an unconditional catch-all. */
export interface QualRoute {
  id: string;
  destination: string;
  status?: QualStatus;
  minScore?: number;
}

export interface QualRules {
  gates?: QualGate[];
  scored: QualScoreRule[];
  /** score at/above `qualified` → qualified; at/above `nurture` → nurture;
   *  below both → unqualified. `nurture` defaults to 0 (everyone who isn't
   *  qualified is at least a nurture candidate) unless set. */
  thresholds: { qualified: number; nurture?: number };
  routes?: QualRoute[];
  /** fallback destination per status when no `routes` entry matches */
  defaultRoutes?: Partial<Record<QualStatus, string>>;
}

export interface QualResult {
  score: number;
  /** sum of all positive rule points — the denominator for `percent` */
  maxScore: number;
  /** score as a 0..100 percentage of maxScore (0 when maxScore is 0) */
  percent: number;
  status: QualStatus;
  matchedRuleIds: string[];
  /** gates that fired (each forces the reject); empty when none did */
  failedGateIds: string[];
  route: string | null;
}

function asNumber(v: QualAnswer | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Evaluate one condition against the answers. Missing answers are false for
 *  every op except `missing` (and `not_equals`/`not_in`, where "absent" is
 *  genuinely "not equal to X"). */
export function evalCondition(cond: QualCondition, answers: QualAnswers): boolean {
  const a = answers[cond.questionId];
  const present = a !== undefined && a !== null && !(typeof a === "string" && a.trim() === "") && !(Array.isArray(a) && a.length === 0);
  switch (cond.op) {
    case "exists": return present;
    case "missing": return !present;
    case "equals": return present && String(a) === String(cond.value);
    case "not_equals": return !present || String(a) !== String(cond.value);
    case "contains": {
      if (Array.isArray(a)) return a.map(String).includes(String(cond.value));
      return present && String(a).includes(String(cond.value));
    }
    case "in": {
      const set = Array.isArray(cond.value) ? cond.value.map(String) : [String(cond.value)];
      if (Array.isArray(a)) return a.some((x) => set.includes(String(x)));
      return present && set.includes(String(a));
    }
    case "not_in": {
      const set = Array.isArray(cond.value) ? cond.value.map(String) : [String(cond.value)];
      if (Array.isArray(a)) return !a.some((x) => set.includes(String(x)));
      return !present || !set.includes(String(a));
    }
    case "gte": case "lte": case "gt": case "lt": {
      const na = asNumber(a);
      const nv = asNumber(cond.value);
      if (na === null || nv === null) return false;
      return cond.op === "gte" ? na >= nv : cond.op === "lte" ? na <= nv : cond.op === "gt" ? na > nv : na < nv;
    }
    default: return false;
  }
}

function pickRoute(rules: QualRules, status: QualStatus, score: number): string | null {
  for (const r of rules.routes ?? []) {
    if (r.status != null && r.status !== status) continue;
    if (r.minScore != null && score < r.minScore) continue;
    return r.destination;
  }
  return rules.defaultRoutes?.[status] ?? null;
}

/** Score a lead's answers against the rules and decide status + route. */
export function scoreLead(answers: QualAnswers, rules: QualRules): QualResult {
  const failedGateIds: string[] = [];
  for (const g of rules.gates ?? []) {
    if (evalCondition(g.when, answers)) failedGateIds.push(g.id);
  }

  let score = 0;
  const matchedRuleIds: string[] = [];
  let maxScore = 0;
  for (const rule of rules.scored) {
    if (rule.points > 0) maxScore += rule.points;
    if (evalCondition(rule.when, answers)) {
      score += rule.points;
      matchedRuleIds.push(rule.id);
    }
  }
  const percent = maxScore > 0 ? Math.max(0, Math.min(100, Math.round((score / maxScore) * 100))) : 0;

  const nurtureAt = rules.thresholds.nurture ?? 0;
  let status: QualStatus;
  if (failedGateIds.length > 0) status = "unqualified";
  else if (score >= rules.thresholds.qualified) status = "qualified";
  else if (score >= nurtureAt) status = "nurture";
  else status = "unqualified";

  return { score, maxScore, percent, status, matchedRuleIds, failedGateIds, route: pickRoute(rules, status, score) };
}
