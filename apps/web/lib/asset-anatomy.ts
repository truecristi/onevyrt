/**
 * Asset anatomy — the "how to build it" structure for each marketing asset a
 * campaign step produces. An email isn't a blank box; it's a subject, a hook,
 * a story, an offer and a CTA. A landing page has a required set of sections.
 *
 * Each section carries a `purpose` (why it exists), `guidance` (how to write
 * it — which doubles as the AI generation brief), and a short `example` so the
 * user sees what "good" looks like. The UI walks these sections in order and
 * can AI-generate any one of them via lib/ai.
 *
 * Original marketing mechanics — no external course material embedded.
 */
export type AssetTypeId = "email" | "landing" | "ad" | "sms";

export interface AssetSection {
  key: string;
  name: string;
  /** Why this section exists / what it must accomplish. */
  purpose: string;
  /** How to write it — the human guidance and the AI generation brief. */
  guidance: string;
  /** A concrete, short example of a good version of this section. */
  example: string;
  /** Optional sections can be skipped without breaking the structure. */
  optional?: boolean;
  /** Soft length ceiling (words) where it matters, e.g. SMS. */
  maxWords?: number;
}

export interface AssetType {
  id: AssetTypeId;
  name: string;
  icon: string;
  /** One-line summary of the whole structure. */
  summary: string;
  sections: AssetSection[];
}

const EMAIL: AssetType = {
  id: "email",
  name: "Email",
  icon: "✉",
  summary: "Subject → Hook → Story → Offer → CTA. Earn the open, hold attention, make one ask.",
  sections: [
    {
      key: "subject",
      name: "Subject line",
      purpose: "Earn the open. Nothing else in the email matters if this fails.",
      guidance: "One specific promise or an open curiosity loop. Under ~9 words. No ALL CAPS, no spammy punctuation, no clickbait you can't pay off.",
      example: "The 3-email sequence that recovered 22% of lost carts",
      maxWords: 12,
    },
    {
      key: "preview",
      name: "Preview text",
      purpose: "The second headline in the inbox — extends the subject, doesn't repeat it.",
      guidance: "Add a reason to open that the subject didn't already say. 5–12 words.",
      example: "Steal the exact timing and copy below.",
      optional: true,
      maxWords: 14,
    },
    {
      key: "hook",
      name: "Hook",
      purpose: "The first line. Stop the scroll and pull them into the next sentence.",
      guidance: "A pattern interrupt tied to their problem — a bold claim, a sharp question, or a surprising fact. Short lines. No throat-clearing ('I hope you're well').",
      example: "Most abandoned carts aren't lost. They're just waiting for one honest nudge.",
    },
    {
      key: "story",
      name: "Story / context",
      purpose: "Build belief and empathy. Show you understand the problem before you sell.",
      guidance: "A short, relatable situation or insight that makes the reader feel understood and positions the offer as the obvious next step. Concrete, not abstract.",
      example: "A skincare brand we worked with was writing off every abandoned cart. One reminder, one reassurance about returns, one gentle deadline — and a fifth of them came back.",
    },
    {
      key: "offer",
      name: "Offer",
      purpose: "The one thing you want them to get — the transformation and what's included.",
      guidance: "State the outcome first, then what they get and why now. One offer per email. Make the value obvious; don't bury it.",
      example: "Grab the Cart Recovery Kit: the 3-email sequence, the timing, and the exact copy — free.",
    },
    {
      key: "cta",
      name: "Call to action",
      purpose: "One clear action, reduced to a single click.",
      guidance: "One CTA, repeated at most twice. Action verb + outcome. A button or a single link — never a menu of choices.",
      example: "Send me the kit →",
    },
    {
      key: "ps",
      name: "P.S.",
      purpose: "The most-read line after the subject — restate the benefit or add honest urgency.",
      guidance: "Reinforce the core benefit or note a real deadline. One or two sentences.",
      example: "P.S. The kit comes down on Friday — grab it while it's still free.",
      optional: true,
    },
  ],
};

const LANDING: AssetType = {
  id: "landing",
  name: "Landing page",
  icon: "▤",
  summary: "Hero → Problem → Solution → How → Proof → Offer → Objections → Final CTA. One page, one action.",
  sections: [
    {
      key: "hero",
      name: "Hero",
      purpose: "Above the fold: say what it is, who it's for, and what to do — in seconds.",
      guidance: "Headline = the outcome. Subhead = how / for whom. One primary CTA. No navigation distractions.",
      example: "Headline: Recover the sales your checkout is losing. Subhead: A done-for-you cart-recovery flow that brings buyers back. CTA: Start free.",
    },
    {
      key: "problem",
      name: "Problem",
      purpose: "Name the exact problem the visitor feels, so they feel understood.",
      guidance: "Describe the pain in their words. Make them nod. Don't pitch yet.",
      example: "You're paying for traffic that adds to cart — then vanishes. Every lost cart is money you already spent to earn.",
    },
    {
      key: "stakes",
      name: "Stakes",
      purpose: "What it costs to leave the problem unsolved — raise the tension honestly.",
      guidance: "Quantify or vividly describe the cost of inaction. Keep it true.",
      example: "At a 70% abandonment rate, that's 7 in 10 interested buyers walking away — every single day.",
      optional: true,
    },
    {
      key: "solution",
      name: "Solution",
      purpose: "Introduce your offer as the bridge from the problem to the outcome.",
      guidance: "Position the product as the obvious answer to the problem you just named. Benefit-led, not feature-led.",
      example: "Cart Recovery turns those exits into a simple, automatic sequence that reminds, reassures, and brings them back to buy.",
    },
    {
      key: "how",
      name: "How it works",
      purpose: "Reduce perceived effort — show it's simple to get the result.",
      guidance: "3 short steps. Each step is one line. Make success feel easy and fast.",
      example: "1) Connect your store. 2) Pick a proven flow. 3) Go live in minutes.",
    },
    {
      key: "proof",
      name: "Proof",
      purpose: "Evidence it works — remove doubt with reality.",
      guidance: "Testimonials, concrete results, recognizable logos, or data. Specific beats superlative. Never fabricate.",
      example: "\"We recovered 22% of abandoned carts in the first month.\" — real customer quote and result.",
    },
    {
      key: "offer",
      name: "Offer",
      purpose: "What's included, the value, and the price — made concrete.",
      guidance: "List what they get, anchor the value, state the price plainly. One primary offer.",
      example: "Everything you need to launch: proven flows, done-for-you copy, and analytics — from $0 to start.",
    },
    {
      key: "objections",
      name: "Objections / FAQ",
      purpose: "Answer the top reasons they hesitate before they bounce.",
      guidance: "3–5 real objections as short Q&As: price, effort, fit, trust, time.",
      example: "Q: Will this work for my store? A: If you take online payments, yes — it plugs into the checkout you already have.",
    },
    {
      key: "guarantee",
      name: "Risk reversal",
      purpose: "Remove the downside so the decision feels safe.",
      guidance: "A guarantee, free trial, or easy cancellation — whatever is true. Make the risk yours, not theirs.",
      example: "Try it free. Cancel in two clicks. Keep any sales you recover.",
      optional: true,
    },
    {
      key: "finalCta",
      name: "Final CTA",
      purpose: "Close: restate the outcome and give one clear action.",
      guidance: "Repeat the primary CTA, restate the core benefit, add honest urgency if any.",
      example: "Stop paying for carts you never close. Start free →",
    },
  ],
};

const AD: AssetType = {
  id: "ad",
  name: "Ad",
  icon: "◆",
  summary: "Hook → Value → CTA. Stop the scroll, make one point, ask once.",
  sections: [
    {
      key: "hook",
      name: "Hook",
      purpose: "Stop the scroll in the first line/second.",
      guidance: "A bold claim, sharp question, or pattern interrupt aimed at the target's problem. Front-load it.",
      example: "7 in 10 carts never check out. Here's the fix.",
    },
    {
      key: "body",
      name: "Body / value",
      purpose: "Make one point — the single most compelling reason to care.",
      guidance: "One benefit, made concrete. Short. No feature dump.",
      example: "A done-for-you flow that brings abandoning buyers back automatically — set up in minutes.",
    },
    {
      key: "cta",
      name: "Call to action",
      purpose: "One clear next step.",
      guidance: "Action verb + outcome. Match the platform's CTA button.",
      example: "Start free today.",
    },
  ],
};

const SMS: AssetType = {
  id: "sms",
  name: "SMS",
  icon: "▸",
  summary: "Hook → Value → CTA, in under ~25 words. Respect the opt-out.",
  sections: [
    {
      key: "hook",
      name: "Hook",
      purpose: "Earn the read in the first few words (that's all that previews).",
      guidance: "Lead with the name/benefit. No fluff.",
      example: "You left something behind 👀",
      maxWords: 8,
    },
    {
      key: "value",
      name: "Value + link",
      purpose: "One reason to act, plus the link.",
      guidance: "One benefit, one short link. Keep the whole message under 160 characters.",
      example: "Your cart's saved — finish in one tap:",
      maxWords: 14,
    },
    {
      key: "cta",
      name: "Close + opt-out",
      purpose: "Clear action and a respectful opt-out.",
      guidance: "Short action + 'Reply STOP to opt out'.",
      example: "[link] · Reply STOP to opt out",
      maxWords: 10,
    },
  ],
};

export const ASSET_TYPES: AssetType[] = [EMAIL, LANDING, AD, SMS];

export function getAssetType(id: string): AssetType | undefined {
  return ASSET_TYPES.find((a) => a.id === id);
}

/** The required (non-optional) sections of an asset type, in order. */
export function requiredSections(id: string): AssetSection[] {
  return getAssetType(id)?.sections.filter((s) => !s.optional) ?? [];
}
