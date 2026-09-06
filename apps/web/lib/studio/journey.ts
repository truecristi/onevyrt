/**
 * Guided journey — the whole path from "just signed up" to "making sales", as
 * one ordered, dated checklist. Deliberately built for an owner who wants to be
 * told exactly what to do next: each step has a plain title, where to do it,
 * whether it's done (read from the real signals the app already tracks), and a
 * target date derived from a pace the owner picks. When they come back, overdue
 * steps light up — the "comeback" is just the app showing what slipped.
 *
 * Pure and server-free: the step list + the date/status math live here so the
 * journey page, the store and unit tests share one source of truth. Dates are
 * passed in as ISO strings (start + now) so the logic is fully deterministic
 * and testable.
 */

export type Pace = "relaxed" | "steady" | "sprint";

/** Multiplier on each step's base day-offset. Steady = the base plan. */
export const PACE_MULT: Record<Pace, number> = { relaxed: 1.6, steady: 1, sprint: 0.5 };
export const PACE_LABEL: Record<Pace, string> = { relaxed: "Relaxed", steady: "Steady", sprint: "Sprint" };

/** The boolean signals that decide whether each step is done. All optional so a
 *  partial load never crashes the journey (missing = not done). */
export interface JourneySignals {
  messageComplete?: boolean;
  aiConnected?: boolean;
  offerReady?: boolean;
  positioningReady?: boolean;
  presentationReady?: boolean;
  economicsReady?: boolean;
  hasFunnel?: boolean;
  firstLead?: boolean;
  firstBooked?: boolean;
}

export interface JourneyState {
  startedAt?: string; // ISO — when the owner began the journey
  pace?: Pace;
}

interface StepDef {
  key: keyof JourneySignals;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  /** Target offset in days from the start, at Steady pace. */
  day: number;
  /** Optional steps are nice-to-have: they never block completion, never go
   *  overdue, and don't count toward the progress total. */
  optional?: boolean;
}

// The path, in order. Day offsets are cumulative from the start date.
export const JOURNEY_STEPS: StepDef[] = [
  { key: "messageComplete", title: "Write your Message", blurb: "One clear sentence: problem → solution → result. Everything else grows from it.", href: "/business/message", cta: "Write your one-liner", day: 1 },
  { key: "aiConnected", title: "Connect your AI", blurb: "One-time key so the app can draft copy for you. Totally optional — you can write everything by hand.", href: "/campaign-studio/connections", cta: "Connect AI", day: 1, optional: true },
  { key: "offerReady", title: "Build your Offer", blurb: "Name it, promise a result, stack the value, frame the price, add a guarantee.", href: "/psychology/offer", cta: "Build your offer", day: 3 },
  { key: "positioningReady", title: "Sharpen your Positioning", blurb: "Who it's for, and why you over the alternative. It makes every word land harder.", href: "/psychology/offer", cta: "Sharpen positioning", day: 4 },
  { key: "presentationReady", title: "Check your Presentation", blurb: "The trust essentials — hero, one CTA, proof, guarantee, mobile — before anyone sees it.", href: "/psychology/presentation", cta: "Run the checklist", day: 5 },
  { key: "economicsReady", title: "Know your Numbers", blurb: "Price minus cost, break-even, and how many you must sell. Make sure it pays.", href: "/numbers/break-even", cta: "Check the numbers", day: 5 },
  { key: "hasFunnel", title: "Build your Funnel", blurb: "The page that qualifies visitors and books calls — your front door.", href: "/business/funnels", cta: "Build a funnel", day: 7 },
  { key: "firstLead", title: "Get your first lead", blurb: "Send traffic to the funnel — an ad, a post, your list — and capture the first one.", href: "/business/funnels", cta: "Drive traffic", day: 10 },
  { key: "firstBooked", title: "Book your first call", blurb: "The finish line of setup: a real, qualified person on your calendar. Now you're selling.", href: "/business/leads", cta: "See your leads", day: 14 },
];

export type StepStatus = "done" | "active" | "upcoming" | "overdue" | "optional";

export interface JourneyStep {
  key: string;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  optional: boolean;
  done: boolean;
  status: StepStatus;
  dueDate: string;      // ISO date of the deadline
  daysLeft: number;     // whole days until due (negative = overdue by that many)
}

export interface Journey {
  steps: JourneyStep[];
  done: number;
  total: number;
  progress: number;         // 0–100
  nextStep: JourneyStep | null;
  overdueCount: number;
  finished: boolean;
  startedAt: string;
  pace: Pace;
}

/**
 * The step keys that are done now but weren't in the `seen` set — i.e. finished
 * since the owner last looked. Used to fire a one-time celebration per step.
 * Returns them in the journey's own order.
 */
export function newlyDone(steps: JourneyStep[], seen: Iterable<string>): string[] {
  const seenSet = seen instanceof Set ? seen : new Set(seen);
  return steps.filter((s) => s.done && !seenSet.has(s.key)).map((s) => s.key);
}

const DAY_MS = 86_400_000;

function addDays(startMs: number, days: number): number {
  return startMs + Math.round(days) * DAY_MS;
}

/**
 * Build the dated, status-tagged journey from the owner's signals + state,
 * evaluated at `nowISO`. `startedAt` defaults to now (a fresh journey), pace to
 * steady. The first not-done step is "active"; any not-done step past its due
 * date is "overdue" (that's what surfaces on a comeback).
 */
export function computeJourney(signals: JourneySignals, state: JourneyState, nowISO: string): Journey {
  const pace: Pace = state.pace && PACE_MULT[state.pace] ? state.pace : "steady";
  const mult = PACE_MULT[pace];
  const now = Date.parse(nowISO);
  const startedAt = state.startedAt && !Number.isNaN(Date.parse(state.startedAt)) ? state.startedAt : nowISO;
  const startMs = Date.parse(startedAt);

  // The first not-done REQUIRED step is the one that's "active" (what to do
  // next). Optional steps are skipped when choosing the active/next step.
  const firstUndoneRequired = JOURNEY_STEPS.findIndex((s) => !s.optional && !signals[s.key]);

  const steps: JourneyStep[] = JOURNEY_STEPS.map((s, i) => {
    const done = !!signals[s.key];
    const dueMs = addDays(startMs, s.day * mult);
    // Future: whole days until due (ceil, so "due in 1 day" until it hits).
    // Past: negative whole days overdue, counting the first slipped day as 1 —
    // plain ceil would give -0 for the first 24h and the UI would say
    // "0 days past" on a step it just flagged overdue.
    const daysLeft = dueMs >= now ? Math.ceil((dueMs - now) / DAY_MS) : -Math.ceil((now - dueMs) / DAY_MS);
    let status: StepStatus;
    if (done) status = "done";
    else if (s.optional) status = "optional";        // never overdue, never blocking
    else if (dueMs < now) status = "overdue";
    else if (i === firstUndoneRequired) status = "active";
    else status = "upcoming";
    return { key: s.key, title: s.title, blurb: s.blurb, href: s.href, cta: s.cta, optional: !!s.optional, done, status, dueDate: new Date(dueMs).toISOString(), daysLeft };
  });

  // Progress and completion count REQUIRED steps only; optional ones are a bonus.
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const total = required.length;
  const overdueCount = steps.filter((s) => s.status === "overdue").length;
  const nextStep = steps.find((s) => !s.optional && !s.done) ?? null;

  return {
    steps,
    done,
    total,
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
    nextStep,
    overdueCount,
    finished: done === total,
    startedAt,
    pace,
  };
}
