/**
 * Execution readiness — the live signal for pillar 3 (Execution). Psychology
 * has a persuasion score and Numbers a viability read; this is the third, built
 * from the acquisition milestones the Command Center already tracks: a funnel
 * exists, it's drawing leads, those leads qualify, and calls get booked.
 *
 * Pure and server-free: it reads a plain acquisition shape (a subset of the
 * Command Center payload) so the hub, the home card and unit tests share one
 * source of truth. Deliberately milestone-based, not a vanity metric — each
 * step is a real thing that has or hasn't happened.
 */

export interface ExecutionSignals {
  hasFunnel?: boolean;
  leadsTotal?: number;
  qualified?: number;
  booked?: number;
}

export type ExecutionStage = "Not started" | "Funnel built" | "Getting traffic" | "Qualifying leads" | "Booking calls";

export interface ExecutionStep { key: string; label: string; done: boolean; }

export interface ExecutionReadiness {
  score: number;            // 0–100, 25 per milestone reached
  stage: ExecutionStage;
  steps: ExecutionStep[];   // in order, each done/not
  /** The next milestone not yet reached, or null when all are done. */
  next: ExecutionStep | null;
}

const n = (v: number | undefined): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Roll the acquisition milestones into a 0–100 readiness with a stage label. */
export function executionReadiness(s: ExecutionSignals): ExecutionReadiness {
  const steps: ExecutionStep[] = [
    { key: "funnel", label: "Build a funnel", done: !!s.hasFunnel },
    { key: "leads", label: "Get your first lead", done: n(s.leadsTotal) > 0 },
    { key: "qualified", label: "Qualify a lead", done: n(s.qualified) > 0 },
    { key: "booked", label: "Book a call", done: n(s.booked) > 0 },
  ];
  const done = steps.filter((x) => x.done).length;
  const score = done * 25;
  const stage: ExecutionStage =
    done === 0 ? "Not started" : done === 1 ? "Funnel built" : done === 2 ? "Getting traffic" : done === 3 ? "Qualifying leads" : "Booking calls";
  const next = steps.find((x) => !x.done) ?? null;
  return { score, stage, steps, next };
}
