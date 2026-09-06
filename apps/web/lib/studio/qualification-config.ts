/**
 * Config shape for a live qualification funnel — the data a served /q/[slug]
 * page renders. Questions are asked one-per-screen; the answers are scored by
 * the engine's scoreLead (brick 1) into qualified / nurture / unqualified, and
 * each outcome shows its own result copy + CTA. This is the bridge between the
 * pure qualification engine and the live runtime; the builder (later) writes
 * these configs, and for now a demo funnel is served so the runtime is real.
 */
import type { QualRules } from "@onevyrt/engine";

export type QualQuestionKind = "single" | "multi" | "number" | "text";

export interface QualOption { value: string; label: string }

export interface QualQuestion {
  id: string;
  prompt: string;
  kind: QualQuestionKind;
  /** for single/multi */
  options?: QualOption[];
  /** for number/text */
  placeholder?: string;
  required?: boolean;
}

export interface QualOutcome {
  heading: string;
  body: string;
  ctaLabel: string;
  /** where the CTA points; matches the engine route destinations */
  ctaHref?: string;
}

/** Contact capture, shown once after the questions and before the result, so
 *  every lead — not just the ones who book — carries a name + email. Email is
 *  always required when enabled (it's the key contact); name/phone are opt-in. */
export interface QualContactConfig {
  enabled: boolean;
  headline?: string;
  subtext?: string;
  askName?: boolean;
  askPhone?: boolean;
  requirePhone?: boolean;
}

/** Contact verification (OTP) before a qualified lead can book. Off by default;
 *  when on, the lead proves they own their email (or phone) with a one-time
 *  code — so only reachable leads reach the calendar. */
export interface QualVerificationConfig {
  enabled: boolean;
  channel: "email" | "sms";
}

/** Automated follow-up: email the nurture/unqualified resource to the lead. */
export interface QualFollowUpConfig { enabled: boolean }

/**
 * A paid step on the funnel — a deposit, a paid consult, a tripwire. The price
 * is AUTHORITATIVE and lives only here (server-side config); the public runtime
 * never lets the visitor name their own amount. When enabled and the owning
 * workspace has a connected Stripe account, the runtime can mint a destination
 * charge to that account (see lib/acquisition/funnel-payment.ts). priceCents is
 * in minor units (cents); currency is a lowercase ISO-4217 code. */
export interface QualPaymentConfig {
  enabled: boolean;
  priceCents: number;
  currency: string;
  label?: string;       // shown on the pay button / heading, e.g. "Reserve your spot"
  description?: string;  // charge description (appears on the customer's receipt)
}

/** True only when a payment config is complete enough to charge against:
 *  turned on, a positive whole-cent price, and a well-formed currency code. */
export function isPayable(cfg: QualPaymentConfig | null | undefined): boolean {
  return !!cfg?.enabled
    && Number.isInteger(cfg.priceCents) && cfg.priceCents > 0
    && typeof cfg.currency === "string" && /^[a-z]{3}$/.test(cfg.currency);
}

/** Normalise an untrusted payment config into a clean one (or undefined when
 *  there's nothing usable). Clamps the price to a non-negative integer, lowers
 *  and validates the currency (defaulting to usd), and caps the text fields. */
export function sanitizePaymentConfig(raw: unknown): QualPaymentConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const priceCents = Math.max(0, Math.floor(Number(o.priceCents) || 0));
  const cur = typeof o.currency === "string" ? o.currency.trim().toLowerCase() : "usd";
  const currency = /^[a-z]{3}$/.test(cur) ? cur : "usd";
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
  const cfg: QualPaymentConfig = { enabled: o.enabled === true, priceCents, currency };
  const label = clip(o.label, 80); if (label) cfg.label = label;
  const description = clip(o.description, 300); if (description) cfg.description = description;
  return cfg;
}

export interface QualFunnelConfig {
  slug: string;
  title: string;
  intro?: string;
  brandColor?: string;
  questions: QualQuestion[];
  rules: QualRules;
  contact?: QualContactConfig;
  verification?: QualVerificationConfig;
  followUp?: QualFollowUpConfig;
  payment?: QualPaymentConfig;
  outcomes: {
    qualified: QualOutcome;
    nurture: QualOutcome;
    unqualified: QualOutcome;
  };
}

/** A complete demo funnel — an agency lead-qual flow — so /q/demo works out of
 *  the box before any builder or persistence exists. Mirrors the ruleset the
 *  engine tests use. */
export const DEMO_QUAL_FUNNEL: QualFunnelConfig = {
  slug: "demo",
  title: "See if we're a fit",
  intro: "A few quick questions so we only book calls that are genuinely worth your time — and ours.",
  brandColor: "#088057",
  questions: [
    { id: "goals", prompt: "What are you trying to achieve?", kind: "multi", required: true, options: [
      { value: "leads", label: "More qualified leads" },
      { value: "sales", label: "Close more sales" },
      { value: "brand", label: "Build the brand" },
      { value: "retention", label: "Keep clients longer" },
    ] },
    { id: "business_type", prompt: "Which best describes your business?", kind: "single", required: true, options: [
      { value: "agency", label: "Marketing / creative agency" },
      { value: "ecom", label: "E-commerce" },
      { value: "coach", label: "Coach / consultant" },
      { value: "saas", label: "SaaS / software" },
      { value: "other", label: "Something else" },
    ] },
    { id: "monthly_revenue", prompt: "Roughly what's your current monthly revenue?", kind: "single", required: true, options: [
      { value: "0", label: "Under $5k" },
      { value: "5000", label: "$5k – $25k" },
      { value: "25000", label: "$25k – $50k" },
      { value: "50000", label: "$50k – $100k" },
      { value: "100000", label: "$100k+" },
    ] },
    { id: "role", prompt: "What's your role?", kind: "single", required: true, options: [
      { value: "owner", label: "Founder / owner" },
      { value: "exec", label: "Executive / director" },
      { value: "manager", label: "Manager" },
      { value: "other", label: "Other" },
    ] },
    { id: "budget", prompt: "What monthly budget could you put behind this?", kind: "single", required: true, options: [
      { value: "0", label: "Under $1k" },
      { value: "2000", label: "$1k – $5k" },
      { value: "5000", label: "$5k – $15k" },
      { value: "15000", label: "$15k+" },
    ] },
    { id: "timeline", prompt: "When are you looking to move?", kind: "single", required: true, options: [
      { value: "now", label: "Right now" },
      { value: "soon", label: "In the next month or two" },
      { value: "later", label: "Just exploring" },
    ] },
    { id: "country", prompt: "Where are you based?", kind: "single", required: true, options: [
      { value: "US", label: "United States" },
      { value: "UK", label: "United Kingdom" },
      { value: "OTHER", label: "Somewhere else" },
    ] },
  ],
  rules: {
    gates: [
      { id: "gate-country", when: { questionId: "country", op: "not_in", value: ["US", "UK"] }, reason: "unsupported region" },
    ],
    scored: [
      { id: "s-owner", when: { questionId: "role", op: "in", value: ["owner", "exec"] }, points: 20 },
      { id: "s-rev-mid", when: { questionId: "monthly_revenue", op: "gte", value: 25000 }, points: 15 },
      { id: "s-rev-high", when: { questionId: "monthly_revenue", op: "gte", value: 50000 }, points: 15 },
      { id: "s-urgent", when: { questionId: "timeline", op: "equals", value: "now" }, points: 20 },
      { id: "s-budget", when: { questionId: "budget", op: "gte", value: 5000 }, points: 20 },
      { id: "s-goal", when: { questionId: "goals", op: "contains", value: "leads" }, points: 10 },
    ],
    thresholds: { qualified: 70, nurture: 40 },
    routes: [
      { id: "r-enterprise", status: "qualified", minScore: 90, destination: "calendar_enterprise" },
      { id: "r-standard", status: "qualified", destination: "calendar_standard" },
      { id: "r-nurture", status: "nurture", destination: "nurture" },
      { id: "r-reject", destination: "alt" },
    ],
  },
  contact: {
    enabled: true,
    headline: "Where should we send this?",
    subtext: "So we can follow up with the right next step.",
    askName: true,
    askPhone: true,
    requirePhone: false,
  },
  followUp: { enabled: true },
  outcomes: {
    qualified: {
      heading: "You're a great fit — let's talk",
      body: "Based on your answers, a strategy call makes sense. Grab a time that works for you.",
      ctaLabel: "Book my call →",
      ctaHref: "#book",
    },
    nurture: {
      heading: "There's a strong path here",
      body: "You're close to a fit. Get our playbook first, and we'll follow up when the timing's right.",
      ctaLabel: "Send me the playbook →",
      ctaHref: "#playbook",
    },
    unqualified: {
      heading: "Let's start with something lighter",
      body: "A full engagement isn't the right move yet — but our free training will get you moving in the meantime.",
      ctaLabel: "Get the free training →",
      ctaHref: "#training",
    },
  },
};

/** Look up a funnel config by slug. For now only the demo exists; later this
 *  reads a persisted funnel instance. Returns null for an unknown slug. */
export function getQualFunnel(slug: string): QualFunnelConfig | null {
  return slug === DEMO_QUAL_FUNNEL.slug ? DEMO_QUAL_FUNNEL : null;
}
