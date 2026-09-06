/**
 * "Score my funnel" — a deterministic health check with exact one-click fixes
 * (task #40). Deliberately rule-based (no AI) so the score is stable, the fixes
 * are precise, and it works even without a connected model. The funnel builder
 * layers an optional AI copy-critique on top using buildCritiquePrompt().
 *
 * Pure and server-free: the builder client and fast unit tests both import it.
 */
import type { FunnelDoc } from "./funnel-builder";

export type Severity = "good" | "warn" | "fix";

export interface FunnelFinding {
  /** Stable id for React keys and de-duping. */
  id: string;
  area: string;
  severity: Severity;
  message: string;
  /** When present, a one-click fix exists — pass this to applyFix(). */
  fixId?: string;
  fixLabel?: string;
}

export interface CritiqueResult {
  /** 0–100 health score: starts at 100, each warn/fix subtracts. */
  score: number;
  findings: FunnelFinding[];
}

/**
 * Max reachable score — matches the funnel builder's own display (sum of every
 * positive option's points) so a threshold is judged against the number the
 * user actually sees on screen.
 */
export function maxScore(doc: FunnelDoc): number {
  let m = 0;
  for (const q of doc.questions) for (const o of q.options ?? []) if ((o.points ?? 0) > 0) m += o.points ?? 0;
  return m;
}

const WEIGHT: Record<Severity, number> = { good: 0, warn: 8, fix: 16 };

/** Run every rule and produce a scored, ordered finding list (worst first). */
export function critiqueFunnel(doc: FunnelDoc): CritiqueResult {
  const f: FunnelFinding[] = [];
  const max = maxScore(doc);
  const qs = doc.questions ?? [];

  // — Intro —
  const intro = (doc.intro ?? "").trim();
  if (!intro) f.push({ id: "intro-missing", area: "Intro", severity: "warn", message: "No intro — visitors land on a cold form. Add one line on why to answer." });
  else if (intro.length < 20) f.push({ id: "intro-thin", area: "Intro", severity: "warn", message: "The intro is very short — one warm sentence lifts completion." });
  else f.push({ id: "intro-ok", area: "Intro", severity: "good", message: "Intro sets up the questions." });

  // — Questions —
  if (qs.length === 0) f.push({ id: "q-none", area: "Questions", severity: "fix", message: "No questions yet — a funnel needs at least one to qualify anyone." });
  else if (qs.length === 1) f.push({ id: "q-thin", area: "Questions", severity: "warn", message: "Only one question — two or three sort leads far better without adding friction." });
  else if (qs.length > 6) f.push({ id: "q-many", area: "Questions", severity: "warn", message: `${qs.length} questions is a lot — trim toward 3–5 to cut drop-off.` });
  else f.push({ id: "q-ok", area: "Questions", severity: "good", message: `${qs.length} questions — a healthy length.` });

  // Choice questions that can't actually be answered.
  const shortChoice = qs.filter((q) => (q.kind === "single" || q.kind === "multi") && (q.options ?? []).length < 2);
  if (shortChoice.length) f.push({ id: "q-shortopts", area: "Questions", severity: "fix", message: `${shortChoice.length} choice question${shortChoice.length === 1 ? "" : "s"} ${shortChoice.length === 1 ? "has" : "have"} fewer than two options.` });

  // — Scoring —
  if (max === 0 && qs.length > 0) {
    f.push({ id: "score-zero", area: "Scoring", severity: "fix", message: "No answer carries points, so everyone scores 0 and nobody qualifies. Give strong answers points." });
  } else if (max > 0) {
    const t = doc.thresholds ?? { qualified: 0, nurture: 0 };
    if (t.qualified > max) f.push({ id: "thr-unreachable", area: "Scoring", severity: "fix", message: `The "qualified" bar (${t.qualified}) is above the max possible score (${max}) — no one can ever qualify.`, fixId: "cap-qualified", fixLabel: `Set qualified to ${max}` });
    if (t.nurture >= t.qualified && t.qualified > 0) f.push({ id: "thr-order", area: "Scoring", severity: "fix", message: `The "nurture" bar (${t.nurture}) is not below "qualified" (${t.qualified}) — the nurture band collapses.`, fixId: "order-thresholds", fixLabel: "Space the thresholds" });
    if (t.nurture <= 0 && t.qualified > 0) f.push({ id: "thr-nurture-zero", area: "Scoring", severity: "warn", message: "Nurture starts at 0, so every non-qualified lead is treated as warm — consider a floor." });
  }

  // — Outcomes —
  const emptyOutcomes = outcomeGaps(doc);
  if (emptyOutcomes.length) f.push({ id: "outcome-empty", area: "Outcomes", severity: "fix", message: `${emptyOutcomes.length} outcome screen${emptyOutcomes.length === 1 ? "" : "s"} (${emptyOutcomes.join(", ")}) ${emptyOutcomes.length === 1 ? "is" : "are"} missing copy — leads hit a blank end.`, fixId: "fill-outcomes", fixLabel: "Fill with starter copy" });
  else f.push({ id: "outcome-ok", area: "Outcomes", severity: "good", message: "All three outcomes have copy." });

  // — Contact capture —
  const contact = doc.contact ?? { enabled: false };
  if (!contact.enabled) f.push({ id: "contact-off", area: "Contact", severity: "fix", message: "Contact capture is off — you won't collect a name or email, so qualified leads vanish.", fixId: "enable-contact", fixLabel: "Turn on contact capture" });
  else f.push({ id: "contact-ok", area: "Contact", severity: "good", message: "Contact capture is on." });

  const penalty = f.reduce((s, x) => s + WEIGHT[x.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const rank: Record<Severity, number> = { fix: 0, warn: 1, good: 2 };
  f.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { score, findings: f };
}

/** The outcome keys whose heading OR body is blank. */
function outcomeGaps(doc: FunnelDoc): string[] {
  const o = doc.outcomes;
  const keys = ["qualified", "nurture", "unqualified"] as const;
  return keys.filter((k) => {
    const oc = o?.[k];
    return !oc || !(oc.heading ?? "").trim() || !(oc.body ?? "").trim();
  });
}

const OUTCOME_DEFAULTS = {
  qualified: { heading: "You're a great fit — let's talk", body: "Grab a time that works for you.", ctaLabel: "Book my call →", ctaHref: "#book" },
  nurture: { heading: "There's a strong path here", body: "Get our playbook and we'll follow up when the timing's right.", ctaLabel: "Send me the playbook →", ctaHref: "#playbook" },
  unqualified: { heading: "Let's start with something lighter", body: "Our free training will get you moving in the meantime.", ctaLabel: "Get the free training →", ctaHref: "#training" },
} as const;

/**
 * Apply a one-click fix by id, returning a NEW doc (never mutates). Unknown ids
 * return the doc unchanged so a stale fixId can't throw.
 */
export function applyFix(doc: FunnelDoc, fixId: string): FunnelDoc {
  switch (fixId) {
    case "cap-qualified": {
      const max = maxScore(doc);
      return { ...doc, thresholds: { ...doc.thresholds, qualified: max } };
    }
    case "order-thresholds": {
      // Keep qualified; drop nurture to a sensible band below it (at least 1 gap).
      const q = doc.thresholds.qualified;
      const nurture = Math.max(1, Math.floor(q / 2));
      return { ...doc, thresholds: { ...doc.thresholds, nurture: Math.min(nurture, q - 1) } };
    }
    case "fill-outcomes": {
      const keys = ["qualified", "nurture", "unqualified"] as const;
      const outcomes = { ...doc.outcomes };
      for (const k of keys) {
        const cur = outcomes[k] ?? { heading: "", body: "", ctaLabel: "" };
        const def = OUTCOME_DEFAULTS[k];
        outcomes[k] = {
          heading: (cur.heading ?? "").trim() || def.heading,
          body: (cur.body ?? "").trim() || def.body,
          ctaLabel: (cur.ctaLabel ?? "").trim() || def.ctaLabel,
          ctaHref: cur.ctaHref ?? def.ctaHref,
        };
      }
      return { ...doc, outcomes };
    }
    case "enable-contact": {
      const c = doc.contact ?? { enabled: false };
      return {
        ...doc,
        contact: {
          ...c,
          enabled: true,
          headline: c.headline ?? "Where should we send this?",
          subtext: c.subtext ?? "So we can follow up with the right next step.",
          askName: c.askName ?? true,
        },
      };
    }
    default:
      return doc;
  }
}

/** Build an AI prompt for a qualitative copy critique (optional layer on top). */
export const CRITIQUE_SYSTEM =
  "You are a direct-response funnel coach. Given a qualification funnel, give brief, specific, actionable feedback on the copy and flow — intro hook, question wording, and whether the outcomes make the next step obvious. Three to five short bullet points, plain language, no preamble.";

export function buildCritiquePrompt(doc: FunnelDoc, strategy = "", brand = ""): string {
  const lines: string[] = [];
  if (brand.trim()) lines.push(`BRAND (judge the copy against this voice):\n${brand.trim()}`);
  if (strategy.trim()) lines.push(`BUSINESS STRATEGY (judge the funnel against this goal and constraint):\n${strategy.trim()}`);
  lines.push(`Funnel: ${doc.title}`, doc.intro ? `Intro: ${doc.intro}` : "Intro: (none)");
  doc.questions.forEach((q, i) => {
    const opts = (q.options ?? []).map((o) => `${o.label} (${o.points ?? 0}pts${o.disqualify ? ", disqualify" : ""})`).join(", ");
    lines.push(`Q${i + 1} [${q.kind}]: ${q.prompt}${opts ? ` — ${opts}` : ""}`);
  });
  const o = doc.outcomes;
  lines.push(`Qualified screen: ${o?.qualified?.heading ?? ""} / ${o?.qualified?.body ?? ""}`);
  lines.push(`Nurture screen: ${o?.nurture?.heading ?? ""} / ${o?.nurture?.body ?? ""}`);
  lines.push(`Unqualified screen: ${o?.unqualified?.heading ?? ""} / ${o?.unqualified?.body ?? ""}`);
  return `${lines.join("\n")}\n\nGive your critique now.`;
}
