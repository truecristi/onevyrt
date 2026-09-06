/**
 * Named, fully-worked asset templates for the Asset Writer — a real starting
 * draft (every section filled) the user loads and then edits or regenerates.
 * Each template's `values` keys match the section keys in asset-anatomy.ts for
 * its type. Original marketing copy, no external material.
 */
import type { AssetTypeId } from "./asset-anatomy";

export interface AssetTemplate {
  id: string;
  type: AssetTypeId;
  name: string;
  description: string;
  /** sectionKey -> copy */
  values: Record<string, string>;
}

export const ASSET_TEMPLATES: AssetTemplate[] = [
  // ── Emails ──
  {
    id: "email-welcome",
    type: "email",
    name: "Welcome",
    description: "First email after someone joins — set expectations, drive one first action.",
    values: {
      subject: "You're in — here's where to start",
      preview: "The one thing to do first (takes 2 minutes).",
      hook: "Welcome aboard. Let's get you a quick win before anything else.",
      story: "Most people who get value fast do one small thing on day one — so we've cut everything else out of your way and left just that.",
      offer: "Do this first: set up your account and see your first result in under 5 minutes.",
      cta: "Take the first step →",
      ps: "P.S. Reply to this email any time — a real person reads it.",
    },
  },
  {
    id: "email-abandoned-cart",
    type: "email",
    name: "Abandoned cart",
    description: "Bring a stalled checkout back — remind, reassure, nudge.",
    values: {
      subject: "You left something behind",
      preview: "Your cart's saved — pick up where you left off.",
      hook: "Life happens — your cart's still here whenever you're ready.",
      story: "No pressure. But if something gave you pause — shipping, sizing, or whether it's right for you — we're happy to help you decide.",
      offer: "Everything in your cart is saved and ready to check out in one click.",
      cta: "Return to my cart →",
      ps: "P.S. Free returns, so there's no risk in trying it.",
    },
  },
  {
    id: "email-nurture",
    type: "email",
    name: "Nurture / value",
    description: "A value-first email that builds trust and softly points to the offer.",
    values: {
      subject: "The mistake that quietly kills conversion",
      preview: "And the 2-minute fix most people skip.",
      hook: "Here's a mistake we see constantly — and it costs real money.",
      story: "Most funnels send traffic to a page that talks about the company, not the visitor's problem. Flip that, and the same traffic converts far better — no extra ad spend needed.",
      offer: "Want the full teardown checklist? It's part of the toolkit inside.",
      cta: "See the checklist →",
      ps: "P.S. Steal the framework even if you never buy anything — it's yours.",
    },
  },
  {
    id: "email-launch",
    type: "email",
    name: "Launch — cart open",
    description: "Open-cart email for a launch window: outcome, offer, one action.",
    values: {
      subject: "It's open: the fastest path to a plan that works",
      preview: "Everything you need, and a guarantee.",
      hook: "The doors are open — and there's a deadline, so let's be quick.",
      story: "You've seen the approach work all week. Now you can put the whole thing to work in your own business, with us guiding each step.",
      offer: "Get the full program: the framework, the templates, and the support — with a money-back guarantee if it's not for you.",
      cta: "Start now →",
      ps: "P.S. The cart closes Friday and doesn't reopen at this price.",
    },
  },

  // ── Landing pages ──
  {
    id: "lp-lead-magnet",
    type: "landing",
    name: "Lead magnet opt-in",
    description: "Trade a valuable free resource for an email — focused, one action.",
    values: {
      hero: "The checklist that turns guesswork into a tested plan — free. Enter your email and get it instantly.",
      problem: "You're making big decisions on gut feel because you don't have a simple way to pressure-test them first.",
      solution: "This checklist walks you through the exact questions that separate a plan that works from a hopeful guess.",
      how: "1) Enter your email. 2) Get the checklist instantly. 3) Run your idea through it today.",
      proof: "Used by 1,000+ founders to sanity-check their next move. (Swap in your real number.)",
      offer: "The full checklist, free — plus a short weekly note with one practical idea.",
      objections: "Q: Is it really free? A: Yes. No card, no catch — just the checklist and useful emails you can leave any time.",
      finalCta: "Send me the checklist →",
    },
  },
  {
    id: "lp-sales-page",
    type: "landing",
    name: "Sales page",
    description: "Full long-form sales page for a paid offer.",
    values: {
      hero: "Stop guessing what to build next. Get a numbers-backed plan you can act on this week. Start free.",
      problem: "Every week without a clear plan is money spent on the wrong things and opportunities missed.",
      stakes: "Keep guessing and you'll keep paying for traffic that doesn't convert and features nobody asked for.",
      solution: "Our system turns your assumptions into a live model — so you can see what actually moves profit before you spend a cent.",
      how: "1) Map your funnel. 2) Simulate the numbers. 3) Act on the highest-leverage move.",
      proof: "\"We found our biggest lever in an afternoon and doubled it.\" — real customer result.",
      offer: "Everything you need to plan, test, and decide with confidence — from $0 to start, upgrade when it pays for itself.",
      objections: "Q: Do I need to be technical? A: No — if you can fill in a form, you can build your model.",
      guarantee: "Try it free. Cancel in two clicks. Keep whatever you learn.",
      finalCta: "Build my plan free →",
    },
  },
  {
    id: "lp-webinar",
    type: "landing",
    name: "Webinar registration",
    description: "Fill a live session — one promise, easy signup.",
    values: {
      hero: "Free live workshop: the 3-step framework to a funnel that actually converts. Save your seat.",
      problem: "You've tried tactics that worked for someone else and fell flat for you — because tactics without a framework are just guesses.",
      solution: "In 45 minutes, you'll get the exact framework we use to turn cold traffic into buyers — and how to apply it to your business.",
      how: "1) Register free. 2) Show up live. 3) Leave with a plan you can use that day.",
      proof: "Join hundreds of founders who've used this framework to fix their funnel.",
      offer: "A free, no-pitch-until-the-end live session — plus the slides and a replay.",
      objections: "Q: Will there be a replay? A: Yes, but the live Q&A is where the real value is — come if you can.",
      finalCta: "Save my seat →",
    },
  },

  // ── Ads ──
  {
    id: "ad-problem-solution",
    type: "ad",
    name: "Problem → solution",
    description: "Classic direct-response ad: name the pain, offer the fix.",
    values: {
      hook: "Paying for traffic that adds to cart — then vanishes?",
      body: "A done-for-you flow brings abandoning buyers back automatically. Set up in minutes, works with your existing checkout.",
      cta: "Start free today.",
    },
  },
  {
    id: "ad-testimonial",
    type: "ad",
    name: "Testimonial",
    description: "Lead with a real result to build instant credibility.",
    values: {
      hook: "\"We recovered 22% of abandoned carts in the first month.\"",
      body: "That's what happened when this store added one simple recovery flow. You can add the same thing today.",
      cta: "See how it works.",
    },
  },

  // ── SMS ──
  {
    id: "sms-abandoned-cart",
    type: "sms",
    name: "Abandoned cart",
    description: "Short, friendly cart nudge with an opt-out.",
    values: {
      hook: "You left something behind 👀",
      value: "Your cart's saved — finish in one tap:",
      cta: "[link] · Reply STOP to opt out",
    },
  },
  {
    id: "sms-flash-sale",
    type: "sms",
    name: "Flash sale",
    description: "Time-boxed offer with urgency, kept under 160 characters.",
    values: {
      hook: "24 hours only ⏰",
      value: "20% off everything — today only:",
      cta: "[link] · Reply STOP to opt out",
    },
  },
];

export function templatesForType(type: AssetTypeId): AssetTemplate[] {
  return ASSET_TEMPLATES.filter((t) => t.type === type);
}
