/**
 * Chapter 4.1 — Find the Bottleneck.
 *
 * First subchapter of IMPROVE & SCALE: before optimising anything, name the
 * ONE constraint actually limiting growth right now. Every later subchapter
 * in this chapter assumes the learner did this honestly — 4.2-4.4 each work a
 * candidate area (conversion, profit, the systems behind them), and 4.5 turns
 * whichever one this subchapter identifies into the Growth & Improvement Plan.
 *
 * Maps to the engine's "m-bottleneck" canonical lesson id (see
 * packages/engine/src/curriculum-chapters.ts's chapter-4 stage) — see this
 * directory's index.ts for how the two are linked.
 */
import type { ActionItem } from "./types";

export const title: string = "Find the Bottleneck";

export const description: string =
  "You came out of CONTROL with real numbers — revenue, margin, conversion rate, customer value. Most business owners look at a wall of numbers like that and try to improve all of them at once: a bit more marketing, a slightly better price, a faster follow-up, a new hire. It feels productive. It rarely works, because a business doesn't grow evenly — it grows at the speed of its single worst link.\n\n" +
  "This is the Theory of Constraints applied to a small business: at any given moment, exactly one thing is the biggest limit on how fast you can grow. Everything else could be improved and the business still wouldn't grow much faster, because the constraint caps the whole system. Fix the constraint and the whole system speeds up. Fix anything else first and you've spent time, money and attention on a problem that was never actually stopping you.\n\n" +
  "Nearly every constraint in a small business lives in one of four places: leads (not enough of the right people know you exist), conversion (people find you, but too few become paying customers), profit (you sell fine, but keep too little of what comes in), or delivery and capacity (you're maxed out and can't safely take on more without quality slipping).\n\n" +
  "The trap is that the loudest problem is rarely the real constraint. A slow website, an outdated logo, a competitor's new ad — these feel urgent because they're visible, not because they're what's actually capping growth. The constraint is found in the numbers you already built in Chapter 3, not in what's making the most noise this week.\n\n" +
  "To find it honestly, walk your own numbers through the chain a customer actually travels: enough traffic? enough of that traffic becoming leads? enough of those leads becoming appointments or conversations? enough of those becoming sales? and once they're a customer, are you keeping enough of the money and enough of them coming back? The first point where the number is clearly worse than it should be — compared to your industry, your own best month, or plain common sense — is where you look first. If you have plenty of leads but a low close rate, more leads won't fix that; you'll just be feeding a leaky bucket faster. If your close rate is fine but your margin is thin, you can double sales and still not have the profit to show for it.\n\n" +
  "Score honestly, not defensively. It's tempting to protect the part of the business you personally built or enjoy — the product, the brand — and blame the part you don't understand, like sales follow-up or pricing. The Growth Constraint Engine in your Business OS exists for exactly this: score each candidate area 0-5 on how much it's holding growth back right now, using this quarter's real numbers as evidence, not gut feel. The highest score — not the one you feel most like fixing — is your constraint.\n\n" +
  "Naming it precisely matters as much as naming it correctly. \"Marketing\" is too vague to act on; \"only 8% of booked calls become paying customers, versus a realistic 15-20% for this kind of offer\" is a constraint you can actually go fix. Chapters 4.2 through 4.4 each work on a different candidate area, but you'll get the most out of every one of them if you already know, precisely, which one is yours.\n\n" +
  "The last discipline is what you deliberately stop doing. Once you've named the constraint, every hour and pound spent elsewhere is an hour and pound not spent relieving it. That doesn't mean neglecting the rest of the business — it means new initiatives outside the constraint wait, and existing ones keep running on autopilot rather than getting your attention this quarter. Write down one or two things you're consciously pausing so the constraint gets the focus it needs, and revisit that list once the constraint moves.";

export const keyPoints: string[] = [
  "At any moment, one constraint limits growth more than everything else — fixing anything else first wastes effort.",
  "Nearly every constraint falls into one of four areas: leads, conversion, profit, or delivery and capacity.",
  "The loudest, most visible problem is rarely the real constraint — the numbers tell you, not your gut.",
  "Trace the customer's real path (traffic to leads to appointments to sales to repeat) to find the first serious leak.",
  "Naming the constraint precisely — with a number attached — makes it something you can actually act on.",
];

export const learningObjectives: string[] = [
  "Explain why fixing several things at once grows a business slower than fixing the one true constraint.",
  "Sort your Chapter 3 numbers into the four candidate constraint areas: leads, conversion, profit, delivery.",
  "Score each area honestly against real evidence, rather than instinct or personal preference.",
  "State your single biggest constraint in one specific, numbers-backed sentence.",
  "Choose at least one thing to deliberately stop or pause so the constraint gets real attention.",
];

export const actionItems: ActionItem[] = [
  {
    title: "Score your four growth areas",
    description:
      "Using your Chapter 3 numbers, score leads, conversion, profit and delivery/capacity from 0-5 on how much each is holding back growth right now. Record the evidence (the actual number) behind each score, not just a gut feeling.",
  },
  {
    title: "Trace your customer path for leaks",
    description:
      "Walk through traffic to leads to appointments to sales to repeat/referral for your business and mark the first stage where the number is clearly worse than it should be.",
  },
  {
    title: "Name your #1 constraint in one sentence",
    description:
      "Write a single, specific sentence naming your biggest constraint and the number that proves it — e.g. '8% of booked calls close, versus a realistic 15-20%.'",
  },
  {
    title: "List what you'll stop doing",
    description:
      "Write 1-2 things outside the constraint area you'll deliberately pause or leave on autopilot for the next 90 days, so effort concentrates where it matters.",
  },
];
