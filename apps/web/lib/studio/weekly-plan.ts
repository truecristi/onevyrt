/**
 * This week — the rhythm layer. The journey (journey.ts) is the one-time path
 * from signup to "first booked call". This is the opposite: the small, repeating
 * set of things to actually DO this week, chosen from where the owner is right
 * now. A non-technical solo founder doesn't want a dashboard; they want to be
 * told "do these three things this week", every week, until it's a habit.
 *
 * Two phases:
 *   • Still setting up  → the week's job is to finish the next setup steps, so
 *     the actions point straight at the unfinished journey work.
 *   • Live (funnel up)  → the week's job is traffic + conversations, so the
 *     actions become the free acquisition rhythm: send First Messages, post
 *     Content Angles, and follow up with the leads and calls you already have.
 *
 * Pure and server-free: reuses JourneySignals so the plan reads from the exact
 * same truth as the journey, and the math/copy live here for the "This week"
 * card and unit tests to share.
 */
import type { JourneySignals } from "./journey";

export type WeeklyPhase = "setup" | "outreach" | "convert" | "grow";

export interface WeeklyAction {
  id: string;
  title: string;        // the imperative, with its target ("Send 10 first messages")
  detail: string;       // one plain line of why / how
  href: string;
  cta: string;
  /** A weekly target count when the action is "do N of these"; omitted for one-offs. */
  target?: number;
}

export interface WeeklyPlan {
  phase: WeeklyPhase;
  headline: string;     // the one-line theme of the week
  actions: WeeklyAction[];
}

/**
 * The phase the owner is in, from their signals. Setup isn't "done" until the
 * message, offer and funnel all exist — those are the three things you need
 * before traffic is worth chasing. After that, leads and bookings decide
 * whether the week is about getting conversations, converting them, or growing.
 */
export function weeklyPhase(s: JourneySignals): WeeklyPhase {
  const liveReady = !!s.messageComplete && !!s.offerReady && !!s.hasFunnel;
  if (!liveReady) return "setup";
  if (!s.firstLead) return "outreach";   // live but nobody's shown up yet
  if (!s.firstBooked) return "convert";  // leads arriving, none booked
  return "grow";                          // booking calls — keep the engine fed
}

/** The next unfinished setup essentials, as ready-to-do actions, in path order. */
function setupActions(s: JourneySignals): WeeklyAction[] {
  const steps: Array<{ done: boolean; a: WeeklyAction }> = [
    { done: !!s.messageComplete, a: { id: "w-message", title: "Write your Message", detail: "One clear sentence — everything else grows from it.", href: "/business/message", cta: "Write it" } },
    { done: !!s.offerReady, a: { id: "w-offer", title: "Build your Offer", detail: "Name it, promise a result, frame the price, add a guarantee.", href: "/psychology/offer", cta: "Build it" } },
    { done: !!s.economicsReady, a: { id: "w-numbers", title: "Check your Numbers", detail: "Make sure the price pays — break-even and how many to sell.", href: "/numbers/break-even", cta: "Check them" } },
    { done: !!s.hasFunnel, a: { id: "w-funnel", title: "Build your Funnel", detail: "The page that qualifies visitors and books calls — your front door.", href: "/business/funnels", cta: "Build it" } },
  ];
  // Show only what's not done yet, capped so the week never looks like a wall.
  return steps.filter((x) => !x.done).map((x) => x.a).slice(0, 3);
}

/** The free acquisition rhythm — the same core every live week, lightly retuned. */
function rhythmActions(opts: { messages: number; posts: number }): WeeklyAction[] {
  return [
    { id: "w-outreach", title: `Send ${opts.messages} first messages`, detail: "One-to-one, personal, no pitch — start real conversations with people who fit.", href: "/psychology/outreach", cta: "Draft messages", target: opts.messages },
    { id: "w-content", title: `Post ${opts.posts} content angles`, detail: "One-to-many — show up where your buyers already are so leads come to you.", href: "/psychology/content", cta: "Get angles", target: opts.posts },
  ];
}

/**
 * The week's plan for the given signals. Deterministic and small — at most a
 * handful of actions, ordered most-important first, so "this week" always fits
 * on one card and never overwhelms.
 */
export function weeklyPlan(signals: JourneySignals): WeeklyPlan {
  const phase = weeklyPhase(signals);

  if (phase === "setup") {
    return {
      phase,
      headline: "Finish your setup — you're almost ready to go live.",
      actions: setupActions(signals),
    };
  }

  if (phase === "outreach") {
    return {
      phase,
      headline: "You're live. This week is about starting conversations.",
      actions: [
        ...rhythmActions({ messages: 10, posts: 3 }),
        { id: "w-firstlead", title: "Land your first lead", detail: "Point every message and post at your funnel — capture the first real one.", href: "/business/funnels", cta: "Open your funnel" },
      ],
    };
  }

  if (phase === "convert") {
    return {
      phase,
      headline: "Leads are arriving — turn them into booked calls.",
      actions: [
        { id: "w-followup", title: "Follow up with every lead within 24h", detail: "Speed wins. A quick, warm reply is what turns a lead into a call.", href: "/business/leads", cta: "See your leads" },
        { id: "w-book", title: "Book your first call", detail: "A real, qualified person on your calendar — that's the finish line of setup.", href: "/business/leads", cta: "Book one" },
        ...rhythmActions({ messages: 8, posts: 2 }),
      ],
    };
  }

  // grow — keep the engine fed and start compounding.
  return {
    phase,
    headline: "You're booking calls. Now keep the engine running — every week.",
    actions: [
      ...rhythmActions({ messages: 10, posts: 3 }),
      { id: "w-nurture", title: "Follow up with everyone who didn't book", detail: "Most sales come from the second and third touch, not the first.", href: "/business/leads", cta: "Follow up" },
      { id: "w-winner", title: "Double down on what's working", detail: "Find the message or post that pulled best and do more of it.", href: "/psychology/content", cta: "Find your winner" },
    ],
  };
}
