/**
 * Worked examples — the antidote to a blank box. Every AI-powered step in the
 * app can show a founder a fully completed version of itself: what the step is
 * FOR (the thinking), exactly what to put IN so the AI has something to work
 * with, and what comes OUT. A non-technical owner never has to guess "what do I
 * even write here" — they see one done well and adapt it.
 *
 * All examples use one coherent fictional business (a funnel-fix agency for
 * coaches) so the founder sees how the same inputs flow from step to step.
 *
 * Pure data + a tiny lookup, so the shared <WorkedExample> panel and unit tests
 * share one source of truth.
 */

export interface WorkedExampleField {
  label: string;   // the input's name, matching the field on the page
  value: string;   // what a good answer looks like
}

export interface WorkedExample {
  /** Stable id, one per step. */
  id: string;
  /** The step's human name, e.g. "Your Message". */
  step: string;
  /** What they thought — why this step matters and what "good" looks like. */
  thought: string;
  /** What they'd put in — the concrete inputs that give the AI something real
   *  to work with. Shown as labelled fields so it maps onto the page. */
  inputs: WorkedExampleField[];
  /** What they get — a short, honest sample of the output. */
  output: string;
  /** One line on how to use the output once they have it. */
  next?: string;
  /** Optional structured payload for a one-click "Use this example" prefill.
   *  A loose bag keyed to the page's own fields — kept untyped here so this pure
   *  module never depends on any page's shape; the page casts and applies it. */
  prefill?: Record<string, unknown>;
}

export const WORKED_EXAMPLES: WorkedExample[] = [
  {
    id: "message",
    step: "Your Message",
    thought:
      "One clear sentence is the seed everything else grows from. If a stranger can't tell in five seconds who you help and what changes for them, no amount of clever copy saves it. Name the customer, the problem they feel, and the result they get — plainly, no jargon.",
    inputs: [
      { label: "Who it's for (the customer)", value: "Online coaches who run ads but can't turn clicks into booked calls" },
      { label: "The problem they feel", value: "They're burning ad budget and blaming themselves, not the leaky funnel" },
      { label: "The result they want", value: "A funnel that books qualified calls without spending more on ads" },
    ],
    output:
      "\"Most coaches waste ad spend on funnels that don't convert. OneVYRT maps your funnel and fixes the leaks — so the clicks you already pay for turn into booked calls.\"",
    next: "This one-liner auto-feeds your Offer, your outreach and your content — write it once, reuse it everywhere.",
    prefill: {
      oneLiner: {
        problem: "Most coaches waste ad spend on funnels that don't convert",
        solution: "OneVYRT maps your funnel and fixes the leaks",
        result: "so the clicks you already pay for turn into booked calls",
      },
      character: "Online coaches who run ads but can't turn clicks into booked calls",
      wants: "A funnel that books qualified calls without spending more on ads",
      internalProblem: "They feel like they're burning money — and blame themselves, not the leaky funnel",
      plan: "Map the funnel, fix the two weakest steps, watch booked calls climb",
      success: "A calendar filling with qualified calls from the same ad budget",
      failure: "Keep paying for clicks that leak away before anyone ever books",
    },
  },
  {
    id: "offer",
    step: "Your Offer",
    thought:
      "People don't buy a service; they buy a result with the risk removed. Give the offer a name so it feels real, promise one specific outcome, stack what's included, frame the price against what it's worth, and add a guarantee that takes the fear away.",
    inputs: [
      { label: "Offer name", value: "The Funnel Fix Sprint" },
      { label: "The promise (one outcome)", value: "Booked, qualified calls within 14 days — without raising your ad budget" },
      { label: "What's included", value: "Funnel teardown • rebuild of the two weakest steps • two weeks of optimisation" },
      { label: "Price & anchor", value: "$2,000 (agencies charge $8k+ for the same rebuild)" },
      { label: "Guarantee", value: "If you don't get a qualified call in 14 days, the next two weeks are free" },
    ],
    output:
      "A named, premium-looking offer with a specific promise, a value stack, price framing that makes $2,000 feel small, and a risk-reversal guarantee — plus AI-drafted answers to the top objections.",
    next: "Weak spots get flagged live; fix them, then export the whole thing as a sales page from the Sales Kit.",
    prefill: {
      name: "The Funnel Fix Sprint",
      promise: "Booked, qualified calls within 14 days — without raising your ad budget",
      deliverables: ["Full funnel teardown", "Rebuild of your two weakest steps", "Two weeks of optimisation"],
      price: "$2,000",
      priceAnchor: "Agencies charge $8k+ for the same rebuild",
      guarantee: "No qualified call in 14 days? The next two weeks are free.",
      audience: "Coaches spending $1k+/mo on ads with no reliable booked calls",
      alternative: "A generic funnel agency, or duct-taping templates themselves",
      edge: "We diagnose the leak first and only rebuild the two steps actually losing the click",
      objections: [
        { q: "How's this different from a $5k agency rebuild?", a: "We don't rebuild everything — we fix only the two steps losing your clicks, so you pay for the fix, not the busywork." },
        { q: "What if it doesn't work?", a: "If you don't get a qualified call in 14 days, the next two weeks are on us." },
      ],
    },
  },
  {
    id: "golden",
    step: "The Golden Example",
    thought:
      "The most durable businesses don't make their money on the first sale. Lead with a cheap 'driving product' to get people in the door, then earn the real profit on the back end (the McDonald's move). See what that looks like for your business.",
    inputs: [
      { label: "Your saved Offer", value: "The Funnel Fix Sprint — $2,000" },
      { label: "Your saved Message", value: "Fix the leaky funnel so paid clicks become booked calls" },
    ],
    output:
      "A ladder: a $47 Funnel Teardown (driving product) → the $2,000 Sprint (core) → an $800/mo Growth Retainer (profit engine) — plus a USP, sales-page angle and ad that all sell that one story.",
    next: "Once saved, this strategy steers your outreach, content, rewrites and Sales Kit automatically.",
  },
  {
    id: "outreach",
    step: "First Message (outreach)",
    thought:
      "When you have no audience yet, one-to-one still works — if you lead with THEM, keep it short, and end with a low-friction question (never 'can I book 30 minutes'). The AI drafts it from your offer so it never sounds like a template.",
    inputs: [
      { label: "Channel", value: "Instagram DM" },
      { label: "Grounding (auto from your Offer)", value: "Funnel Fix Sprint for coaches; result = booked calls without more ad spend" },
    ],
    output:
      "\"Hey [name] — saw you're running ads for your coaching. Quick one: are the clicks actually turning into booked calls, or dropping off before that? Reason I ask is I fix that exact leak for coaches.\"",
    next: "Send 5–10 a day; the follow-up tab writes the gentle second touch for anyone who doesn't reply.",
  },
  {
    id: "content",
    step: "Content Angles",
    thought:
      "One-to-many is the other road to customers: show up where your buyer already scrolls. You don't need to be clever daily — you need angles that stop your exact customer. Each idea is a hook plus what the post says, grounded in your offer.",
    inputs: [
      { label: "Grounding (auto from your Offer + Message)", value: "Funnel Fix Sprint; customer = coaches wasting ad spend" },
    ],
    output:
      "Six post ideas, e.g. — Hook: \"Your ads aren't the problem. Your funnel is.\" Idea: walk through the 3 steps where coaches lose the click they just paid for, and what to change first.",
    next: "Pick one, post the hook as the first line, and write it in your own voice.",
  },
  {
    id: "sell-better",
    step: "Sell it better",
    thought:
      "Any copy can be sharper. Paste what you've got — a headline, an email, an ad — and get it scored on hook, clarity, emotion and one clear call to action, then rewritten to sell harder while staying true to your message.",
    inputs: [
      { label: "What kind of copy", value: "Landing page headline" },
      { label: "Paste your copy", value: "Welcome to my coaching funnel service — I help you grow your business online." },
    ],
    output:
      "Scores (hook 3/10, clarity 6/10…) plus a rewrite: \"You're paying for clicks that never book a call. Let's fix the funnel that's losing them — in 14 days.\" — and 3 specific tips.",
    next: "Copy the rewrite straight into your page, or hit 'Use this' where it's embedded next to an editor.",
  },
];

// — Execution-side steps —
WORKED_EXAMPLES.push(
  {
    id: "positioning",
    step: "Positioning",
    thought:
      "Positioning is why you over the alternative, for a specific person. It makes every other word land harder. Name exactly who it's for, what they'd otherwise do, and the one thing you do differently.",
    inputs: [
      { label: "Who it's for", value: "Coaches spending $1k+/mo on ads with no reliable booked calls" },
      { label: "The alternative they'd use", value: "A generic funnel agency, or duct-taping templates themselves" },
      { label: "Your unique difference", value: "We diagnose the leak first and only rebuild the two steps that are actually losing the click" },
    ],
    output:
      "\"For coaches burning ad budget, OneVYRT fixes the two funnel steps actually losing your clicks — instead of an expensive full rebuild you don't need.\"",
    next: "This folds into your persuasion score and sharpens your Offer and sales page.",
  },
  {
    id: "objections",
    step: "Objection handling",
    thought:
      "Every prospect has 3–4 silent 'yeah, but…' thoughts. Name them out loud and answer them and you remove the friction before it stops the sale. The AI drafts honest answers from your offer.",
    inputs: [
      { label: "Grounding (auto from your Offer)", value: "Funnel Fix Sprint, $2,000, 14-day booked-call guarantee" },
    ],
    output:
      "Q: \"How's this different from a $5k agency rebuild?\" A: \"We don't rebuild everything — we fix only the two steps losing your clicks, so you pay for the fix, not the busywork.\" (…plus 3 more)",
    next: "Drop these straight into your sales page as an FAQ — they're already in the Sales Kit.",
  },
  {
    id: "funnel",
    step: "Funnel copy",
    thought:
      "Your funnel is the front door: it qualifies visitors and books calls. You don't start from a blank page — the AI drafts the questions and copy from your one-liner, so every step already speaks to your customer.",
    inputs: [
      { label: "Grounding (auto from your Message)", value: "Fix the leaky funnel so paid clicks become booked calls, for coaches" },
      { label: "What you want it to do", value: "Qualify by ad spend + coaching niche, then book a call" },
    ],
    output:
      "A ready funnel: headline (\"Find the leak that's costing you booked calls\"), 3 qualifying questions, and a booking step — each editable, each in your voice.",
    next: "Tweak any step, then 'score my funnel' for one-click fixes before you publish.",
  },
  {
    id: "break-even",
    step: "Break-even & goal planner",
    thought:
      "This is the reality check: at your price, how many must you sell to stop losing money — and what would it take to hit a real profit goal? Put in the few numbers you already know; you don't need an accountant.",
    inputs: [
      { label: "Price / unit", value: "$2,000 (from your offer)" },
      { label: "Variable cost / unit", value: "$300 — contractor time, tools, payment fees to deliver one" },
      { label: "Fixed costs (period)", value: "$6,000/mo — software, your baseline, ads you'd run anyway" },
      { label: "Profit goal (optional)", value: "$10,000 this month" },
      { label: "Close / qualify / opt-in % (optional)", value: "25% close · 50% qualify · 20% of visitors opt in" },
    ],
    output:
      "Break-even ≈ 4 sales/mo. To make $10k you need ~9 sales → ~36 sales conversations → ~72 leads → ~360 visitors — and, if you're buying traffic, the ad budget to get them.",
    next: "See a target you can't hit cheaply? That's your cue to use the free channels — First Message and Content Angles.",
  },
  {
    id: "audiences",
    step: "Audience suggestions",
    thought:
      "Who you send to matters as much as what you send. From your contacts and offer, the AI suggests the next-best segment to reach — the group most likely to say yes right now — so a broadcast isn't a guess.",
    inputs: [
      { label: "Grounding (auto from your leads + Offer)", value: "Funnel Fix Sprint; 120 leads, 18 booked a call, 40 opened but never replied" },
    ],
    output:
      "Suggested segment: \"Opened, never booked (last 30 days)\" — 40 people — with a one-line angle: lead with the free $47 teardown to restart the conversation.",
    next: "Turn a suggestion into a segment, then draft the broadcast right from it.",
  },
);

/** Look up the worked example for a step id. */
export function workedExample(id: string): WorkedExample | undefined {
  return WORKED_EXAMPLES.find((w) => w.id === id);
}
