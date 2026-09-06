/**
 * Funnel builder model — the friendly, owner-facing shape of a qualification
 * funnel, and the compiler that turns it into the engine's QualFunnelConfig.
 *
 * The engine (packages/engine qualification) is powerful but low-level: gates,
 * weighted conditions, thresholds, routes. Asking a business owner to author
 * that directly would be the "too complicated" trap. So the builder exposes a
 * simple mental model instead:
 *   - each answer OPTION carries `points` (how much this answer signals a good
 *     lead), and can be flagged `disqualify` (an instant hard no),
 *   - two thresholds (`qualified` / `nurture`) split the score,
 *   - three outcomes with their own copy + CTA.
 * compileFunnel() lowers that into engine rules, so the whole existing runtime
 * (wizard, scoreLead, availability, booking) works unchanged.
 */
import type { QualRules } from "@onevyrt/engine";
import type { QualFunnelConfig, QualQuestion, QualOption, QualContactConfig, QualVerificationConfig, QualFollowUpConfig, QualPaymentConfig } from "./qualification-config";
import { sanitizePaymentConfig } from "./qualification-config";

export type BuilderQuestionKind = "single" | "multi" | "number" | "text";

export interface BuilderOption {
  value: string;
  label: string;
  /** points added to the score when this option is chosen (may be 0) */
  points?: number;
  /** choosing this option is an instant hard disqualify (a gate) */
  disqualify?: boolean;
}

export interface BuilderQuestion {
  id: string;
  prompt: string;
  kind: BuilderQuestionKind;
  required?: boolean;
  placeholder?: string;
  options?: BuilderOption[];
}

export interface BuilderOutcome {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
}

export interface FunnelContact {
  enabled: boolean;
  headline?: string;
  subtext?: string;
  askName?: boolean;
  askPhone?: boolean;
  requirePhone?: boolean;
}

export interface FunnelVerification {
  enabled: boolean;
  channel: "email" | "sms";
}

export interface FunnelFollowUp { enabled: boolean }

export interface FunnelDoc {
  slug: string;
  title: string;
  intro?: string;
  brandColor?: string;
  questions: BuilderQuestion[];
  thresholds: { qualified: number; nurture: number };
  contact?: FunnelContact;
  verification?: FunnelVerification;
  followUp?: FunnelFollowUp;
  payment?: QualPaymentConfig;
  outcomes: { qualified: BuilderOutcome; nurture: BuilderOutcome; unqualified: BuilderOutcome };
}

/**
 * The maximum score a real visitor can actually attain — the qualification
 * domain's single source of truth for "100%".
 *
 * A single-choice question lets the visitor pick exactly ONE option, so only its
 * highest positive option can contribute; a multi-choice question lets them pick
 * any subset, so all positive options can add up. Number/text questions are not
 * scored and contribute nothing. Naively summing every positive option across
 * all questions (the old inline calc) inflated the max for single-choice
 * questions, which distorted the score bar and let thresholds be set above
 * anything a visitor could ever reach.
 */
export function attainableMaxScore(doc: Pick<FunnelDoc, "questions">): number {
  let max = 0;
  for (const q of doc.questions ?? []) {
    const positive = (q.options ?? []).map((o) => o.points ?? 0).filter((p) => p > 0);
    if (!positive.length) continue;
    if (q.kind === "multi") max += positive.reduce((a, b) => a + b, 0);
    else if (q.kind === "single") max += Math.max(...positive);
    // number / text questions are unscored → contribute 0
  }
  return max;
}

/** URL-safe slug from a free-text name. */
export function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "funnel";
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;

/** Validate a builder doc; returns an error string or null if it's sound. Keeps
 *  the runtime honest — a saved funnel must always compile to a usable config. */
export function validateFunnelDoc(doc: FunnelDoc): string | null {
  if (!doc || typeof doc !== "object") return "missing funnel";
  if (!SLUG_RE.test(doc.slug || "")) return "slug must be lowercase letters, numbers and dashes";
  if (doc.slug === "demo") return "\"demo\" is reserved for the sample funnel";
  if (!doc.title || !doc.title.trim()) return "a title is required";
  if (!Array.isArray(doc.questions) || doc.questions.length === 0) return "add at least one question";
  const seen = new Set<string>();
  for (const q of doc.questions) {
    if (!q.id || !/^[a-z0-9_]+$/.test(q.id)) return `question id "${q.id}" must be lowercase letters, numbers or underscores`;
    if (seen.has(q.id)) return `duplicate question id "${q.id}"`;
    seen.add(q.id);
    if (!q.prompt || !q.prompt.trim()) return `question "${q.id}" needs a prompt`;
    if ((q.kind === "single" || q.kind === "multi")) {
      if (!q.options || q.options.length < 2) return `question "${q.id}" needs at least two options`;
      const ov = new Set<string>();
      for (const o of q.options) {
        if (!o.value || !o.label) return `an option in "${q.id}" is missing a value or label`;
        if (ov.has(o.value)) return `duplicate option value "${o.value}" in "${q.id}"`;
        ov.add(o.value);
      }
    }
  }
  const t = doc.thresholds;
  if (!t || typeof t.qualified !== "number" || typeof t.nurture !== "number") return "thresholds are required";
  // Reject configurations no visitor could ever satisfy — the old check only
  // enforced ordering, so negative, non-finite, or above-maximum thresholds all
  // saved happily and produced a funnel where nobody can qualify.
  if (!Number.isFinite(t.qualified) || !Number.isFinite(t.nurture)) return "thresholds must be finite numbers";
  if (t.qualified < 0 || t.nurture < 0) return "thresholds cannot be negative";
  if (t.qualified < t.nurture) return "the qualified threshold must be at least the nurture threshold";
  const attainable = attainableMaxScore(doc);
  if (t.qualified > attainable) return `the qualified threshold (${t.qualified}) is above the maximum attainable score (${attainable}) — no visitor could ever qualify`;
  if (t.nurture > attainable) return `the nurture threshold (${t.nurture}) is above the maximum attainable score (${attainable}) — no visitor could ever reach it`;
  for (const k of ["qualified", "nurture", "unqualified"] as const) {
    const o = doc.outcomes?.[k];
    if (!o || !o.heading || !o.ctaLabel) return `the ${k} outcome needs a heading and button label`;
  }
  return null;
}

/** Lower a builder doc into the engine-level QualFunnelConfig the runtime uses. */
export function compileFunnel(doc: FunnelDoc): QualFunnelConfig {
  const questions: QualQuestion[] = doc.questions.map((q) => {
    const options: QualOption[] | undefined = (q.kind === "single" || q.kind === "multi")
      ? (q.options ?? []).map((o) => ({ value: o.value, label: o.label }))
      : undefined;
    return { id: q.id, prompt: q.prompt, kind: q.kind, required: q.required, placeholder: q.placeholder, options };
  });

  const scored: QualRules["scored"] = [];
  const gates: NonNullable<QualRules["gates"]> = [];
  for (const q of doc.questions) {
    if (q.kind !== "single" && q.kind !== "multi") continue;
    const op = q.kind === "multi" ? "contains" : "equals";
    for (const o of q.options ?? []) {
      if (o.disqualify) {
        gates.push({ id: `gate-${q.id}-${o.value}`, when: { questionId: q.id, op, value: o.value }, reason: `${q.id}=${o.value}` });
      }
      if (o.points && o.points !== 0) {
        scored.push({ id: `s-${q.id}-${o.value}`, when: { questionId: q.id, op, value: o.value }, points: o.points });
      }
    }
  }

  const rules: QualRules = {
    gates: gates.length ? gates : undefined,
    scored,
    thresholds: { qualified: doc.thresholds.qualified, nurture: doc.thresholds.nurture },
    routes: [
      { id: "r-qualified", status: "qualified", destination: "calendar" },
      { id: "r-nurture", status: "nurture", destination: "nurture" },
      { id: "r-reject", destination: "alt" },
    ],
  };

  const outc = (o: BuilderOutcome, fallbackHref: string): QualFunnelConfig["outcomes"]["qualified"] => ({
    heading: o.heading, body: o.body, ctaLabel: o.ctaLabel, ctaHref: o.ctaHref || fallbackHref,
  });

  const contact: QualContactConfig | undefined = doc.contact
    ? { enabled: doc.contact.enabled, headline: doc.contact.headline, subtext: doc.contact.subtext, askName: doc.contact.askName, askPhone: doc.contact.askPhone, requirePhone: doc.contact.requirePhone }
    : undefined;
  const verification: QualVerificationConfig | undefined = doc.verification
    ? { enabled: doc.verification.enabled, channel: doc.verification.channel }
    : undefined;
  const followUp: QualFollowUpConfig | undefined = doc.followUp ? { enabled: doc.followUp.enabled } : undefined;
  // A paid step, sanitised so the compiled config's price is always a clean,
  // server-authoritative value regardless of what the stored doc holds.
  const payment = doc.payment ? sanitizePaymentConfig(doc.payment) : undefined;

  return {
    slug: doc.slug,
    title: doc.title,
    intro: doc.intro,
    brandColor: doc.brandColor || "#088057",
    questions,
    rules,
    contact,
    verification,
    followUp,
    payment,
    outcomes: {
      // qualified defaults to #book so the calendar step appears.
      qualified: outc(doc.outcomes.qualified, "#book"),
      // nurture/unqualified default to unfilled-placeholder hrefs — there's no
      // real "playbook"/"training" destination to guess at here, so this is
      // intentionally left for the operator to fill in with their own link.
      // Until they do, QualificationWizard's result screen recognizes these as
      // unresolved and shows an honest status line instead of a dead button or
      // an empty result screen — never a fake URL.
      nurture: outc(doc.outcomes.nurture, "#playbook"),
      unqualified: outc(doc.outcomes.unqualified, "#training"),
    },
  };
}

/** A sensible starter funnel for a new build — one scored question, one
 *  disqualifier, sane thresholds and outcome copy — so the builder is never a
 *  blank page. */
export function blankFunnelDoc(slug: string, title: string): FunnelDoc {
  return {
    slug,
    title,
    intro: "A few quick questions so we only book calls that are worth everyone's time.",
    brandColor: "#088057",
    questions: [
      { id: "budget", prompt: "What monthly budget could you put behind this?", kind: "single", required: true, options: [
        { value: "under1k", label: "Under $1k", points: 0 },
        { value: "1to5k", label: "$1k – $5k", points: 10 },
        { value: "5to15k", label: "$5k – $15k", points: 25 },
        { value: "15kplus", label: "$15k+", points: 40 },
      ] },
      { id: "timeline", prompt: "When are you looking to move?", kind: "single", required: true, options: [
        { value: "now", label: "Right now", points: 30 },
        { value: "soon", label: "In the next month or two", points: 15 },
        { value: "exploring", label: "Just exploring", points: 0 },
      ] },
      { id: "role", prompt: "What's your role?", kind: "single", required: true, options: [
        { value: "owner", label: "Founder / owner", points: 30 },
        { value: "exec", label: "Executive / director", points: 20 },
        { value: "other", label: "Something else", points: 0 },
      ] },
    ],
    thresholds: { qualified: 70, nurture: 35 },
    contact: { enabled: true, headline: "Where should we send this?", subtext: "So we can follow up with the right next step.", askName: true, askPhone: true, requirePhone: false },
    verification: { enabled: false, channel: "email" },
    followUp: { enabled: true },
    // nurture/unqualified ship with placeholder hrefs ("#playbook"/"#training")
    // for the operator to replace with a real resource link — same as
    // compileFunnel's fallback above. Left unfilled, the wizard's result
    // screen still renders a real status line rather than a dead button or a
    // blank screen, so a never-customized funnel is never broken, just plain.
    outcomes: {
      qualified: { heading: "You're a great fit — let's talk", body: "Grab a time that works for you.", ctaLabel: "Book my call →", ctaHref: "#book" },
      nurture: { heading: "There's a strong path here", body: "Get our playbook and we'll follow up when the timing's right.", ctaLabel: "Send me the playbook →", ctaHref: "#playbook" },
      unqualified: { heading: "Let's start with something lighter", body: "Our free training will get you moving in the meantime.", ctaLabel: "Get the free training →", ctaHref: "#training" },
    },
  };
}
