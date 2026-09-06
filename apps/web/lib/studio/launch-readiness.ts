/**
 * Launch readiness — one honest answer to the question a non-technical founder
 * actually has: "am I ready to sell yet, or not?" The app already tracks a
 * dozen signals and three pillar scores; this collapses the five that truly
 * gate a launch into a single verdict plus the specific gaps to close, in the
 * order worth closing them.
 *
 * The five essentials, in order:
 *   Message → Offer → Numbers (viable) → Presentation (trust) → Funnel (front door)
 *
 * Pure and server-free: reuses JourneySignals so it reads the exact same truth
 * as Your Plan, and the verdict + gap list live here for the home card and unit
 * tests to share.
 */
import type { JourneySignals } from "./journey";

export interface ReadinessGap {
  key: string;
  area: string;   // the pillar / step name
  label: string;  // what to do, in plain words
  href: string;
  cta: string;
}

export interface LaunchReadiness {
  /** 0–100: essentials done ÷ total. */
  score: number;
  done: number;
  total: number;
  /** true once every essential is in place. */
  ready: boolean;
  /** short stage word for a badge. */
  stage: "Not started" | "Getting set up" | "Almost ready" | "Ready to sell";
  /** one plain-English line for the founder. */
  headline: string;
  /** the essentials still missing, in priority order (empty when ready). */
  gaps: ReadinessGap[];
  /** the essentials already in place, in order. */
  done_labels: string[];
}

interface Essential {
  key: keyof JourneySignals;
  area: string;
  label: string;
  doneLabel: string;
  href: string;
  cta: string;
}

// The five things that gate being able to sell at all, in the order to fix them.
const ESSENTIALS: Essential[] = [
  { key: "messageComplete", area: "Message", label: "Write your one clear Message", doneLabel: "Message written", href: "/business/message", cta: "Write it" },
  { key: "offerReady", area: "Offer", label: "Build an offer they can't ignore", doneLabel: "Offer built", href: "/psychology/offer", cta: "Build it" },
  { key: "economicsReady", area: "Numbers", label: "Check the numbers actually pay", doneLabel: "Numbers checked", href: "/numbers/break-even", cta: "Check them" },
  { key: "presentationReady", area: "Presentation", label: "Pass the trust checklist", doneLabel: "Presentation ready", href: "/psychology/presentation", cta: "Run it" },
  { key: "hasFunnel", area: "Funnel", label: "Build your funnel — the front door", doneLabel: "Funnel live", href: "/business/funnels", cta: "Build it" },
];

function stageFor(done: number, total: number): LaunchReadiness["stage"] {
  if (done >= total) return "Ready to sell";
  if (done === 0) return "Not started";
  if (done >= total - 2) return "Almost ready";
  return "Getting set up";
}

function headlineFor(stage: LaunchReadiness["stage"], gaps: ReadinessGap[], firstBooked?: boolean): string {
  if (stage === "Ready to sell") {
    return firstBooked
      ? "You're set up and booking calls — keep the engine running."
      : "You're ready to sell. Drive traffic to your funnel and start booking calls.";
  }
  if (gaps.length === 1) return `You're one step from ready — ${gaps[0]!.label.toLowerCase()}.`;
  if (stage === "Almost ready") return `Almost there — ${gaps.length} things left before you can sell.`;
  if (stage === "Not started") return "Let's get you ready to sell — start with your Message.";
  return `Coming together — ${gaps.length} essentials left to set up.`;
}

/**
 * The launch verdict for the given signals: how ready, what's done, and the
 * exact gaps still blocking a launch (in priority order).
 */
export function launchReadiness(signals: JourneySignals): LaunchReadiness {
  const doneEssentials = ESSENTIALS.filter((e) => !!signals[e.key]);
  const gaps: ReadinessGap[] = ESSENTIALS.filter((e) => !signals[e.key]).map((e) => ({
    key: e.key, area: e.area, label: e.label, href: e.href, cta: e.cta,
  }));
  const done = doneEssentials.length;
  const total = ESSENTIALS.length;
  const stage = stageFor(done, total);
  return {
    score: Math.round((done / total) * 100),
    done,
    total,
    ready: done >= total,
    stage,
    headline: headlineFor(stage, gaps, signals.firstBooked),
    gaps,
    done_labels: doneEssentials.map((e) => e.doneLabel),
  };
}
