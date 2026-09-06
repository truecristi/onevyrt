/**
 * Chapter 4.4 — Systemise & Automate.
 *
 * Builds on 4.2/4.3: makes sure whatever was just improved survives a normal
 * week without the founder personally holding it together — the audit this
 * subchapter runs feeds the "already systemising" evidence 4.5 folds into the
 * Growth & Improvement Plan's action list.
 *
 * Maps to the engine's "m-systemise-automate" canonical lesson id (see
 * packages/engine/src/curriculum-chapters.ts's chapter-4 stage) — see this
 * directory's index.ts for how the two are linked.
 */
import type { ActionItem } from "./types";

export const title: string = "Systemise & Automate";

export const description: string =
  "Everything you improved in 4.2 and 4.3 has one hidden cost: it works today because you're the one holding it together. A better follow-up sequence, a sharper sales process, a smarter price — all of it depends on somebody actually doing it, consistently, every single time, whether you're in the room or not. This subchapter is about making sure the improvements survive contact with a normal week: you get sick, you take a holiday, you get busy with something else, and the business runs anyway.\n\n" +
  "Start by finding the repetition, not the big projects. The tasks worth systemising aren't the rare, complicated ones — they're the boring ones you or someone on your team does over and over: sending the same follow-up message, chasing the same invoice, onboarding a new customer the same way, posting the same weekly update. Spend a week actually noticing what you do more than once, and write it down as you go rather than trying to remember it later — founders consistently underestimate how much of their week is repetition because each instance feels like a one-off in the moment.\n\n" +
  "For every repetitive task you find, ask four questions, in this order. Does this need to happen at all? Some repeated tasks exist because they always have, not because they still earn their place. If stopping it entirely would cost nothing, that's the cheapest fix in this whole chapter.\n\n" +
  "Can software do it without a human? Follow-up messages, appointment reminders, invoice chasing, scheduling — a huge share of small-business repetition is exactly the kind of rule-based, no-judgment-required work automation handles for a few pounds a month and never forgets, never has an off day, and never waits until tomorrow.\n\n" +
  "Can someone other than you do it? If it needs a human but not specifically you, it's a delegation candidate — but only once it's written down. Handing over a task that only exists in your head just moves the bottleneck onto whoever you handed it to, and they'll do it their way, inconsistently, because there was never a 'your way' to follow.\n\n" +
  "If none of the above yet, at least document it. Writing the steps down — even roughly, even just a checklist — is what makes a task delegable or automatable later, and it's the cheapest insurance in the business: the day you're unexpectedly unavailable, a written process is the difference between the business coping and the business stopping.\n\n" +
  "A simple test cuts through a lot of hesitation here: could the business run for two weeks without you, at today's quality, if you weren't reachable? For most owners the honest answer is no — and usually not because the business is too complicated, but because too much of it exists only as habits and memory rather than as anything that could be handed to someone else, human or software. That dependency is invisible day-to-day and expensive the one day it matters.\n\n" +
  "You don't need to systemise everything this quarter — that's not realistic and it's not the point. Pick the two or three repetitive tasks most connected to your constraint from 4.1 (the ones that, if they slipped, would hurt the exact number you're trying to move) and take each through eliminate-automate-delegate-document properly, rather than doing a shallow pass across everything. A handful of processes done properly beats twenty half-written ones nobody actually follows.";

export const keyPoints: string[] = [
  "Every improvement from 4.2 and 4.3 only survives if it runs without you personally holding it together every time.",
  "The tasks worth systemising are the boring, repeated ones — not the rare, complicated projects.",
  "For each repetitive task, ask in order: eliminate it, automate it, delegate it, or at minimum document it.",
  "A task can't be safely delegated until it's written down — otherwise you've just moved the bottleneck onto someone else.",
  "The real test: could the business run two weeks at today's quality if you were unreachable?",
];

export const learningObjectives: string[] = [
  "Identify the repetitive tasks in your business that currently depend on you personally.",
  "Apply the eliminate, automate, delegate, document sequence to your own repeated work.",
  "Write a basic, usable process for at least one task you currently hold only in your head.",
  "Prioritise systemising the 2-3 repetitive tasks most connected to your Chapter 4.1 constraint.",
];

export const actionItems: ActionItem[] = [
  {
    title: "Log a week of repetition",
    description:
      "For one week, note every task you or your team does more than once — however small — as it happens rather than trying to recall it later.",
  },
  {
    title: "Run each task through the four questions",
    description:
      "For your top 5 repeated tasks, decide: eliminate, automate, delegate, or document — and record the decision for each.",
  },
  {
    title: "Write one real process",
    description:
      "Pick one task you currently hold only in your head and write it down as a step-by-step process someone else could follow without asking you questions.",
  },
  {
    title: "Automate or delegate your constraint-linked task",
    description:
      "Choose the single repetitive task most connected to your Chapter 4.1 constraint and either set up an automation for it or hand it to someone else this week.",
  },
];
