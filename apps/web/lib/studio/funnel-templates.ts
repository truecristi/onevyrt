/**
 * Starter qualification-funnel templates. A new funnel doesn't have to begin
 * blank — pick a proven template for your business type and edit from there.
 * Each is a complete FunnelDoc (minus the slug, assigned when created): real
 * questions, scored options, sensible thresholds, contact capture and outcome
 * copy. Pure data; the builder clones one and opens it in the editor. This is
 * also the seed of shareable/community templates later.
 */
import type { FunnelDoc, BuilderOutcome } from "./funnel-builder";

export interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** everything but the slug (assigned at creation) */
  doc: Omit<FunnelDoc, "slug">;
}

const CONTACT = { enabled: true, headline: "Where should we send this?", subtext: "So we can follow up with the right next step.", askName: true, askPhone: true, requirePhone: false };
const VERIFY = { enabled: false, channel: "email" as const };
const FOLLOWUP = { enabled: true };

/** Standard three outcomes with only qualified pre-wired to the calendar; the
 *  nurture/unqualified links are left for the owner to point at their resource. */
function outcomes(qualified: BuilderOutcome, nurture: Partial<BuilderOutcome>, unqualified: Partial<BuilderOutcome>) {
  return {
    qualified,
    nurture: { heading: nurture.heading ?? "There's a strong path here", body: nurture.body ?? "You're close to a fit — grab our playbook and we'll follow up when the timing's right.", ctaLabel: nurture.ctaLabel ?? "Send me the playbook →", ctaHref: nurture.ctaHref },
    unqualified: { heading: unqualified.heading ?? "Let's start with something lighter", body: unqualified.body ?? "A full engagement isn't the right move yet — our free training will get you moving.", ctaLabel: unqualified.ctaLabel ?? "Get the free training →", ctaHref: unqualified.ctaHref },
  };
}

const bookOutcome = (heading: string, body: string): BuilderOutcome => ({ heading, body, ctaLabel: "Book my call →", ctaHref: "#book" });

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: "agency", name: "Agency / done-for-you", icon: "🎯",
    description: "Qualify prospects for a marketing/creative or services agency by budget, decision-making and urgency.",
    doc: {
      title: "See if we're a fit", intro: "A few quick questions so we only book calls that are genuinely worth everyone's time.", brandColor: "#088057",
      questions: [
        { id: "monthly_revenue", prompt: "Roughly what's your current monthly revenue?", kind: "single", required: true, options: [
          { value: "u10k", label: "Under $10k", points: 0 }, { value: "10_50k", label: "$10k – $50k", points: 15 }, { value: "50_100k", label: "$50k – $100k", points: 25 }, { value: "100k", label: "$100k+", points: 35 } ] },
        { id: "budget", prompt: "What monthly budget could you put behind this?", kind: "single", required: true, options: [
          { value: "u1k", label: "Under $1k", points: 0 }, { value: "1_5k", label: "$1k – $5k", points: 15 }, { value: "5_15k", label: "$5k – $15k", points: 30 }, { value: "15k", label: "$15k+", points: 40 } ] },
        { id: "role", prompt: "What's your role?", kind: "single", required: true, options: [
          { value: "owner", label: "Founder / owner", points: 25 }, { value: "exec", label: "Executive / director", points: 20 }, { value: "manager", label: "Manager", points: 10 }, { value: "other", label: "Other", points: 0 } ] },
        { id: "timeline", prompt: "When are you looking to move?", kind: "single", required: true, options: [
          { value: "now", label: "Right now", points: 25 }, { value: "soon", label: "Next month or two", points: 12 }, { value: "later", label: "Just exploring", points: 0 } ] },
      ],
      thresholds: { qualified: 80, nurture: 40 }, contact: CONTACT, verification: VERIFY, followUp: FOLLOWUP,
      outcomes: outcomes(bookOutcome("You're a great fit — let's talk", "Based on your answers, a strategy call makes sense. Grab a time that works."), {}, {}),
    },
  },
  {
    id: "coach", name: "Coach / consultant", icon: "🧠",
    description: "Qualify coaching or consulting leads by goal, commitment and ability to invest.",
    doc: {
      title: "Let's see if I can help", intro: "A few questions so our call is focused on the right thing for you.", brandColor: "#088057",
      questions: [
        { id: "goal", prompt: "What are you most trying to change?", kind: "single", required: true, options: [
          { value: "grow", label: "Grow / scale my business", points: 25 }, { value: "start", label: "Start something new", points: 12 }, { value: "clarity", label: "Get clarity / direction", points: 15 }, { value: "curious", label: "Just curious", points: 0 } ] },
        { id: "invest", prompt: "Are you in a position to invest in the right support?", kind: "single", required: true, options: [
          { value: "ready", label: "Yes, ready to invest", points: 35 }, { value: "soon", label: "Soon, if it's the right fit", points: 18 }, { value: "no", label: "Not right now", points: 0 } ] },
        { id: "commit", prompt: "How much time can you commit each week?", kind: "single", required: true, options: [
          { value: "5plus", label: "5+ hours", points: 25 }, { value: "2_5", label: "2–5 hours", points: 15 }, { value: "u2", label: "Under 2 hours", points: 5 } ] },
        { id: "when", prompt: "When do you want to start?", kind: "single", required: true, options: [
          { value: "now", label: "Now", points: 20 }, { value: "month", label: "This month", points: 12 }, { value: "later", label: "Later", points: 0 } ] },
      ],
      thresholds: { qualified: 75, nurture: 35 }, contact: CONTACT, verification: VERIFY, followUp: FOLLOWUP,
      outcomes: outcomes(bookOutcome("Sounds like a fit — let's talk", "Book a call and we'll map out your next step together."), {}, {}),
    },
  },
  {
    id: "ecom", name: "E-commerce / DTC brand", icon: "🛍️",
    description: "Qualify e-commerce brands for growth services by revenue, channel and ad spend.",
    doc: {
      title: "Is your store ready to scale?", intro: "Quick questions so we can tell you straight whether we can move the needle.", brandColor: "#088057",
      questions: [
        { id: "revenue", prompt: "What's your store doing per month?", kind: "single", required: true, options: [
          { value: "u5k", label: "Under $5k", points: 0 }, { value: "5_25k", label: "$5k – $25k", points: 15 }, { value: "25_100k", label: "$25k – $100k", points: 28 }, { value: "100k", label: "$100k+", points: 38 } ] },
        { id: "adspend", prompt: "Current monthly ad spend?", kind: "single", required: true, options: [
          { value: "0", label: "Not running ads yet", points: 5 }, { value: "u2k", label: "Under $2k", points: 12 }, { value: "2_10k", label: "$2k – $10k", points: 25 }, { value: "10k", label: "$10k+", points: 35 } ] },
        { id: "platform", prompt: "What are you selling on?", kind: "single", required: true, options: [
          { value: "shopify", label: "Shopify", points: 15 }, { value: "woo", label: "WooCommerce", points: 12 }, { value: "amazon", label: "Amazon only", points: 8 }, { value: "other", label: "Something else", points: 5 } ] },
        { id: "goal", prompt: "What's the priority right now?", kind: "multi", required: true, options: [
          { value: "acquire", label: "New-customer acquisition", points: 15 }, { value: "aov", label: "Higher average order value", points: 10 }, { value: "retention", label: "Retention / LTV", points: 10 } ] },
      ],
      thresholds: { qualified: 80, nurture: 40 }, contact: CONTACT, verification: VERIFY, followUp: FOLLOWUP,
      outcomes: outcomes(bookOutcome("There's real upside here — let's talk", "Grab a growth teardown call and we'll show you where the money's being left."), {}, {}),
    },
  },
  {
    id: "local", name: "Local / home service", icon: "🏠",
    description: "Qualify local-service leads (home services, trades, clinics) by job, timeline and location.",
    doc: {
      title: "Let's get you a quote", intro: "A few quick questions so we can help you fast.", brandColor: "#088057",
      questions: [
        { id: "service", prompt: "What do you need help with?", kind: "single", required: true, options: [
          { value: "install", label: "A new installation / project", points: 30 }, { value: "repair", label: "A repair / fix", points: 20 }, { value: "quote", label: "Just a quote for now", points: 10 } ] },
        { id: "timeline", prompt: "How soon do you need it done?", kind: "single", required: true, options: [
          { value: "asap", label: "As soon as possible", points: 30 }, { value: "weeks", label: "In the next few weeks", points: 18 }, { value: "planning", label: "Just planning ahead", points: 5 } ] },
        { id: "owner", prompt: "Is this for a property you own?", kind: "single", required: true, options: [
          { value: "own", label: "Yes, I own it", points: 20 }, { value: "rent", label: "I rent", points: 8 }, { value: "manage", label: "I manage it for someone", points: 15 } ] },
        { id: "budget", prompt: "Do you have a budget in mind?", kind: "single", required: true, options: [
          { value: "yes", label: "Yes, ready to go", points: 20 }, { value: "flexible", label: "Flexible for the right work", points: 12 }, { value: "no", label: "Not yet", points: 3 } ] },
      ],
      thresholds: { qualified: 70, nurture: 35 }, contact: { ...CONTACT, askPhone: true, requirePhone: true }, verification: VERIFY, followUp: FOLLOWUP,
      outcomes: outcomes(bookOutcome("Great — let's book you in", "Pick a time and we'll sort out the details on a quick call."), { ctaLabel: "Send me info →" }, { ctaLabel: "Send me info →" }),
    },
  },
  {
    id: "saas", name: "SaaS / software", icon: "💻",
    description: "Qualify software demo requests by team size, use case and buying timeline.",
    doc: {
      title: "Book a demo", intro: "Tell us a little so the demo is tailored to you.", brandColor: "#088057",
      questions: [
        { id: "team", prompt: "How big is your team?", kind: "single", required: true, options: [
          { value: "solo", label: "Just me", points: 5 }, { value: "2_10", label: "2–10", points: 15 }, { value: "11_50", label: "11–50", points: 28 }, { value: "50", label: "50+", points: 35 } ] },
        { id: "usecase", prompt: "What are you trying to solve?", kind: "single", required: true, options: [
          { value: "clear", label: "A specific, urgent problem", points: 30 }, { value: "improve", label: "Improve an existing process", points: 18 }, { value: "explore", label: "Just exploring options", points: 5 } ] },
        { id: "timeline", prompt: "When are you looking to decide?", kind: "single", required: true, options: [
          { value: "now", label: "This month", points: 30 }, { value: "quarter", label: "This quarter", points: 18 }, { value: "later", label: "No timeline yet", points: 3 } ] },
        { id: "role", prompt: "What's your role in the decision?", kind: "single", required: true, options: [
          { value: "decider", label: "I decide / sign off", points: 25 }, { value: "influence", label: "I influence it", points: 15 }, { value: "research", label: "Just researching", points: 5 } ] },
      ],
      thresholds: { qualified: 80, nurture: 40 }, contact: CONTACT, verification: VERIFY, followUp: FOLLOWUP,
      outcomes: outcomes(bookOutcome("Let's get you a tailored demo", "Pick a time and we'll walk through exactly what you need."), { ctaLabel: "Send me a walkthrough →" }, { ctaLabel: "Watch the overview →" }),
    },
  },
];

/** Get a template's doc with a slug assigned, ready to open in the editor. */
export function templateDoc(templateId: string, slug: string): FunnelDoc | null {
  const t = FUNNEL_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return null;
  return { ...structuredClone(t.doc), slug };
}
