/**
 * One "next move," not four.
 *
 * The app grew several independent "what should I do next?" engines — the
 * guided journey's next step, the launch-readiness gaps, the command-centre's
 * momentum next-move, the funnel's biggest money leak, the next-best-audience
 * suggestions. Each was reasonable alone, but on a screen that shows two or
 * three of them at once (the Command Centre showed three) they can each claim
 * "Do this next" with a different answer, which is exactly the kind of
 * incoherence a polished product doesn't ship.
 *
 * This is the shared prioritiser they feed into: every producer maps its output
 * to a Recommendation, and rankRecommendations returns them worst-first so a
 * surface can show ONE authoritative next move (topRecommendation) and treat the
 * rest as supporting detail. It generalises lib/studio/fix-first.ts (which does
 * the same thing but only for the funnel's internal signals) by adding the CTA
 * fields (href/cta) the cross-app surfaces need.
 *
 * Pure and dependency-free so it's unit-testable and safe to call during render.
 */

export type RecSource = "programme" | "leak" | "momentum" | "journey" | "readiness" | "audience";

export interface Recommendation {
  /** Stable id for React keys / dedupe. */
  id: string;
  source: RecSource;
  /** The action itself, e.g. "Write your Message". */
  title: string;
  /** One-line rationale, optional. */
  why?: string;
  /** Where the CTA goes. */
  href: string;
  /** Button label, e.g. "Open →". */
  cta?: string;
  /** Dollars/mo at stake when known — lifts money-bearing moves above nudges. */
  impact?: number;
  /** 0..100 urgency the producer assigns (e.g. an overdue step scores higher). */
  weight: number;
}

// When two moves score equally, this decides the order: a real money leak beats
// the momentum engine's considered pick, which beats a guided-plan step, and so
// on. Kept close together on purpose — the per-item `weight` is the primary
// signal; this is only the tie-breaker.
const SOURCE_RANK: Record<RecSource, number> = {
  // The programme road is the canonical journey — it leads until it's finished,
  // above the selling-machine engines. A live money leak is the one thing urgent
  // enough to still tie-break above it.
  leak: 100, programme: 90, momentum: 85, journey: 70, readiness: 65, audience: 45,
};

/** Score a recommendation. The producer's `weight` carries urgency; known
 *  dollars-at-stake add on top (capped so one huge number can't dwarf
 *  everything), so a quantified leak outranks an equally-urgent nudge. */
export function scoreRecommendation(r: Recommendation): number {
  const money = typeof r.impact === "number" && Number.isFinite(r.impact) ? Math.min(500, Math.abs(r.impact) / 100) : 0;
  return r.weight + money;
}

/** Rank recommendations most-important first. Ties break by source so the
 *  ordering is deterministic across renders. Ignores nullish entries so callers
 *  can map optional producers straight in without filtering first. */
export function rankRecommendations(recs: (Recommendation | null | undefined)[]): Recommendation[] {
  return recs
    .filter((r): r is Recommendation => !!r)
    .sort((a, b) => {
      const d = scoreRecommendation(b) - scoreRecommendation(a);
      if (d !== 0) return d;
      return (SOURCE_RANK[b.source] ?? 0) - (SOURCE_RANK[a.source] ?? 0);
    });
}

/** The single highest-priority move, or null when there's nothing to do. */
export function topRecommendation(recs: (Recommendation | null | undefined)[]): Recommendation | null {
  return rankRecommendations(recs)[0] ?? null;
}

// ---- adapters: each producer's shape → a Recommendation ------------------
// Kept here (not in the page) so the mapping is covered by the same tests.

/** The learner's next step on the canonical ONEVYRT programme road (engine
 *  `nextAction`). This is THE journey now — a new learner's first move is the
 *  foundational identity work at the start of the programme, not a mid-path
 *  selling tool. So while the programme is unfinished it outranks the momentum /
 *  journey / readiness moves; once every chapter is complete it steps aside
 *  (low weight) and points at the Transformation Report, letting the
 *  selling-machine moves lead. A learner paced out by their cohort (no
 *  actionable lesson yet, not finished) yields no move, so the others lead. */
export function fromProgrammeNextAction(
  // Structurally the engine's NextAction — the whole object is passed through
  // from /api/programme/enrollment; this adapter reads the subset it needs.
  action:
    | { currentStageId?: string | null; currentLessonId: string | null; currentLessonTitle?: string | null; overallPercent?: number; ctaLabel: string; ctaHref: string; done: boolean }
    | null
    | undefined,
): Recommendation | null {
  if (!action) return null;
  // Paced out / waiting on the cohort — nothing to act on, so don't claim the CTA.
  if (!action.done && !action.currentLessonId) return null;
  return {
    id: `programme:${action.ctaHref}`,
    source: "programme",
    title: action.done ? "View your Transformation Report" : action.currentLessonTitle || action.ctaLabel,
    href: action.ctaHref,
    cta: action.ctaLabel,
    why: action.done ? "You've completed the programme" : "Your next step on the ONEVYRT programme",
    weight: action.done ? 40 : 98,
  };
}

/** The guided journey's next step. Overdue steps are urgent, so they score
 *  above an on-track step and above the readiness gaps. */
export function fromJourneyNextStep(
  step: { title: string; href: string; cta?: string } | null | undefined,
  opts: { overdueCount?: number } = {},
): Recommendation | null {
  if (!step) return null;
  const overdue = opts.overdueCount ?? 0;
  return {
    id: `journey:${step.href}`,
    source: "journey",
    title: step.title,
    href: step.href,
    cta: step.cta,
    why: overdue > 0 ? `${overdue} step${overdue === 1 ? "" : "s"} past their date` : "Next in your step-by-step plan",
    weight: overdue > 0 ? 95 : 70,
  };
}

/** The command-centre momentum engine's considered single next-move. */
export function fromMomentumNextMove(
  nextMove: { label: string; href: string; why?: string } | null | undefined,
): Recommendation | null {
  if (!nextMove || !nextMove.label) return null;
  return {
    id: `momentum:${nextMove.href}`,
    source: "momentum",
    title: nextMove.label,
    href: nextMove.href,
    why: nextMove.why,
    weight: 85,
  };
}

/** A launch-readiness gap (the weakest of the five essentials). */
export function fromReadinessGap(
  gap: { key?: string; area: string; label: string; href: string; cta?: string } | null | undefined,
): Recommendation | null {
  if (!gap) return null;
  return {
    id: `readiness:${gap.key ?? gap.href}`,
    source: "readiness",
    title: gap.label,
    href: gap.href,
    cta: gap.cta,
    why: gap.area,
    weight: 65,
  };
}
