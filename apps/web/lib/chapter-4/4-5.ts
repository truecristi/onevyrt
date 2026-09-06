/**
 * Chapter 4.5 — Build the Growth Plan.
 *
 * The capstone: synthesises 4.1 (the named constraint), 4.2/4.3 (the
 * current-vs-target metric), and 4.4 (what's already being systemised) into
 * the Growth & Improvement Plan — Chapter 4's permanent artifact and the one
 * submission a coach reviews before this chapter can be marked complete.
 *
 * Maps to the engine's "m-growth-plan" canonical lesson id (see
 * packages/engine/src/curriculum-chapters.ts's chapter-4 stage) — see this
 * directory's index.ts for how the two are linked.
 */
import type { ActionItem } from "./types";

export const title: string = "Build the Growth Plan";

export const description: string =
  "Everything in this chapter has been building toward one document: a Growth & Improvement Plan you could hand to anyone and they'd understand exactly where the business stands, what's holding it back, and what happens in the next 90 days to fix it. This subchapter is where you stop analysing and commit — on paper, with numbers, in a form your coach will review before you move on.\n\n" +
  "You already have every ingredient. From 4.1, your single biggest constraint, named specifically and backed by a number. From 4.2 and 4.3, the current-versus-target figures for the metric that constraint lives in — a conversion rate, a margin, a customer value, whatever it turned out to be. From 4.4, at least one task you've already started automating, delegating or documenting so the plan doesn't quietly depend on you working even harder. The Growth Plan doesn't ask you to generate anything new — it asks you to select and commit.\n\n" +
  "Selection is the actual skill here, not generation. Most business owners can list fifteen things worth doing; almost none of them can pick the five that matter most and say no to the rest for a full quarter. You will be tempted to include everything you've thought of across this chapter — resist it. A plan with twelve priorities is a plan with none, because attention split twelve ways moves nothing far enough to notice. Pick three to five actions, no more, and choose them by asking one question of each candidate: how directly does this move the constraint I named in 4.1? An action that feels productive but doesn't touch the constraint belongs on next quarter's list, not this one.\n\n" +
  "Each action needs to earn its place on the plan by being trackable, not just true. 'Improve follow-up' is a hope; 'send a text within 5 minutes of every new lead, every day, for the next 90 days' is something you can actually check in three months and know whether it happened. For every action, write what will change, who owns making it happen (even in a business of one, naming yourself forces the commitment), and by when. An action nobody owns is an action nobody does.\n\n" +
  "Show your arithmetic, not just your intention. If your target is a conversion rate moving from 8% to 12%, say what that's actually worth: at 100 leads a month, that's the difference between roughly 8 sales and 12 — a real, calculable uplift in revenue, not just a nicer-sounding percentage. Writing out the maths does two things: it proves to you the target is worth the effort before you spend 90 days chasing it, and it gives your coach something concrete to check progress against later, rather than a vague sense of 'things got a bit better.'\n\n" +
  "Structure the plan around four things, in this order: where the business stands today (the real current numbers), the single biggest constraint and why it's the right one, the three-to-five actions that move it with an owner and a date on each, and the expected impact if those actions land — in real numbers, not adjectives. That's the whole document. It should fit on one page; if it doesn't, you've probably let too many priorities back in.\n\n" +
  "Once it's written, it goes to your coach the same way every chapter output has — for a genuine 'does this actually make sense' check, not a formality. A plan that's specific enough to be wrong is far more useful than a vague one that's technically unobjectionable, and a good coach will tell you if a target looks unrealistic or if you've picked an action that doesn't actually touch your stated constraint. Once it's approved, it isn't a document to file away — it's the thing you check yourself against every week for the next 90 days, and the baseline your eventual Transformation Report compares back to.";

export const keyPoints: string[] = [
  "The Growth Plan doesn't need new analysis — it selects and commits using what 4.1-4.4 already produced.",
  "Three to five actions, never more — a plan that tries to do everything moves nothing far enough to matter.",
  "Every action needs an owner, a date, and a way to check in 90 days whether it actually happened.",
  "Show the arithmetic behind your target (e.g. leads times conversion rate) so the impact is a real number, not an adjective.",
  "The plan should fit on one page: current position, the constraint, 3-5 owned actions, and the expected impact.",
];

export const learningObjectives: string[] = [
  "Select 3-5 actions from across this chapter using 'does this move my named constraint' as the filter.",
  "Rewrite vague intentions as specific, dated, owned actions that can be checked as done or not done.",
  "Calculate the real expected impact of hitting a target metric, not just state the target.",
  "Assemble a one-page Growth & Improvement Plan ready for coach review.",
];

export const actionItems: ActionItem[] = [
  {
    title: "Shortlist and cut to 3-5 actions",
    description:
      "List every action idea from 4.1-4.4, then cut the list to the 3-5 that most directly move your named constraint. Everything else waits for next quarter.",
  },
  {
    title: "Give every action an owner and a date",
    description:
      "For each of your chosen actions, write exactly what changes, who is responsible for it, and the date it should be done or reviewed by.",
  },
  {
    title: "Calculate your expected impact",
    description:
      "Using your current and target metrics from 4.2/4.3, calculate the real difference hitting the target makes (e.g. extra sales per month) so the impact is a number, not a feeling.",
  },
  {
    title: "Submit your Growth & Improvement Plan for coach review",
    description:
      "Assemble your current position, constraint, actions and expected impact into one page and submit it for your coach's approval before moving on.",
  },
];
