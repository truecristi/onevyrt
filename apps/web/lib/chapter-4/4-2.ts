/**
 * Chapter 4.2 — Improve Conversion.
 *
 * Builds directly on 4.1: whether or not conversion turned out to be the
 * named constraint, this is the fastest lever most businesses have, and the
 * current/target rate a learner sets here is exactly the kind of pair 4.5
 * turns into the Growth & Improvement Plan's headline metric.
 *
 * Maps to the engine's "m-improve-conversion" canonical lesson id (see
 * packages/engine/src/curriculum-chapters.ts's chapter-4 stage) — see this
 * directory's index.ts for how the two are linked.
 */
import type { ActionItem } from "./types";

export const title: string = "Improve Conversion";

export const description: string =
  "If Chapter 4.1 pointed you at conversion — or even if it didn't, this is worth mastering regardless, because it's the fastest lever most businesses have — this is where you go from 'that's the constraint' to 'here's exactly what to fix'.\n\n" +
  "Conversion isn't one number. It's a chain: leads to booked appointments or calls, to people who actually show up, to sales, to customers. A single 'lead to sale' percentage hides which link in that chain is actually broken, and you can't fix what you can't see. Break your own numbers into that chain and calculate the conversion rate between each pair of stages. Most businesses, when they do this for the first time, are surprised — the leak usually isn't where they expected.\n\n" +
  "A few patterns show up constantly in this work. Speed to lead: a lead contacted within five minutes converts dramatically better than one contacted the next day — not because the offer changed, but because the buyer's interest is highest the moment they raise their hand. If leads sit for hours before anyone follows up, you're losing sales you already paid to generate.\n\n" +
  "Follow-up, not first contact: most sales aren't lost on the first conversation — they're lost in the silence afterwards. A prospect says 'let me think about it' and never hears from the business again. A defined follow-up sequence — a call, then a text, then an email, on a fixed schedule, for a fixed number of attempts — recovers sales that a single conversation simply drops.\n\n" +
  "A real process, not a vibe: if your 'sales process' lives entirely in your head and changes depending on your mood that day, your conversion rate will be as inconsistent as your mood. Writing down the actual steps — how you qualify, what you say, how you present price, how you handle the three objections you hear every week — turns a skill only you have into a system anyone on your team can run close to your own level.\n\n" +
  "No-shows are a conversion problem too: a booked call that never happens converts at zero, no matter how good your close rate is once someone's actually in the room. A confirmation text, a reminder the day before, and an easy reschedule link routinely cut no-shows in half.\n\n" +
  "Once you've found where the real leak is, the fix is almost always cheaper than more marketing. Doubling your ad spend to fix a follow-up problem doubles the number of leads that fall through the same hole — you're just filling a leaky bucket faster instead of patching it. A tighter follow-up sequence or a rewritten sales script usually costs nothing but attention, and it compounds: every percentage point you add to a conversion stage applies to every lead that ever passes through it, this month and every month after.\n\n" +
  "Set a real target, not a hopeful one. Look at what's realistic for your kind of offer and your current baseline — a 2-point improvement in close rate is usually achievable in 90 days with focused effort; a jump from 8% to 40% isn't, and chasing it will just produce a target nobody believes in. Write down today's rate at your weakest stage and a specific, defensible target for 90 days out — that pair of numbers is what Chapter 4.5 turns into your growth plan, and what your coach will hold you to.";

export const keyPoints: string[] = [
  "Conversion is a chain (leads to booked to shown up to sale), not one number — find which link actually leaks.",
  "Speed to lead matters: contacting a new lead within minutes converts far better than contacting it hours later.",
  "Most sales are lost in the follow-up silence after the first conversation, not in the first conversation itself.",
  "A written sales process turns a skill only you have into one your whole team can run.",
  "A no-show is a 0% conversion regardless of how good your close rate is — confirmations and reminders fix this cheaply.",
  "Fixing the real leak is usually cheaper than buying more leads to pour through the same hole.",
];

export const learningObjectives: string[] = [
  "Break a single 'lead to sale' percentage into the individual stages that make it up.",
  "Identify the exact stage in your pipeline where the biggest share of prospects is lost.",
  "Apply at least one proven fix — speed to lead, follow-up cadence, a written process, or no-show reduction — to your weakest stage.",
  "Set a specific, achievable 90-day conversion target based on your real current rate.",
];

export const actionItems: ActionItem[] = [
  {
    title: "Map your conversion pipeline",
    description:
      "Write down your actual numbers for each stage: leads to booked appointments/calls to shows/attended to sales. Calculate the conversion percentage between each pair of stages.",
  },
  {
    title: "Identify your weakest stage",
    description:
      "Circle the single stage with the lowest conversion rate relative to what's realistic for your offer — this is your leak, not just the overall low number.",
  },
  {
    title: "Build or rewrite your follow-up sequence",
    description:
      "Write a fixed follow-up sequence (channel, message, timing) for at least 5 touches after first contact, so no lead goes silent after one conversation.",
  },
  {
    title: "Set your current and target conversion rate",
    description:
      "Record today's conversion rate at your weakest stage and a specific, realistic target for 90 days from now.",
  },
];
