/**
 * What moved this week — the "comeback" payoff. A solo founder who's been away a
 * few days shouldn't land on a cold dashboard; they should see, in one glance,
 * what actually moved forward. This diffs a saved weekly baseline against where
 * things stand now and turns the positive deltas into plain, encouraging lines.
 *
 * Only forward motion is shown — this is a morale and momentum surface, not a
 * report card, so a quiet week simply shows nothing rather than red numbers.
 *
 * Pure and server-free: the snapshot shape + the diff live here so the home card
 * and unit tests share one source of truth. Dates are passed in as ISO strings
 * so the logic is deterministic and testable.
 */

/** The handful of counts worth remembering week to week. */
export interface ProgressSnapshot {
  at: string;            // ISO timestamp the baseline was taken
  readinessDone: number; // launch essentials completed (0–5)
  leads: number;         // total leads captured
  booked: number;        // total booked calls
  funnels: number;       // live funnels
  views: number;         // total funnel visits
}

export type ProgressStats = Omit<ProgressSnapshot, "at">;

export interface Move {
  key: string;
  label: string;
  /** "win" = a real milestone (a call, a live funnel); "progress" = movement. */
  tone: "win" | "progress";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Ordered most-exciting first: booked calls are the money moment; views are
// just motion. Each entry turns a positive delta into one line.
const MOVE_SPECS: { key: keyof ProgressStats; tone: Move["tone"]; line: (n: number) => string }[] = [
  { key: "booked", tone: "win", line: (n) => `${plural(n, "call")} booked 🎉` },
  { key: "leads", tone: "win", line: (n) => `${plural(n, "new lead")} came in` },
  { key: "funnels", tone: "win", line: (n) => `${plural(n, "funnel")} went live` },
  { key: "readinessDone", tone: "progress", line: (n) => `${plural(n, "setup essential")} completed` },
  { key: "views", tone: "progress", line: (n) => `${plural(n, "more funnel visit")}` },
];

/**
 * Positive moves from `prev` to `cur`, in priority order. Returns [] when
 * there's no baseline yet or nothing moved forward. Backwards or flat deltas are
 * never shown.
 */
export function computeMoves(prev: ProgressSnapshot | null | undefined, cur: ProgressStats): Move[] {
  if (!prev) return [];
  const moves: Move[] = [];
  for (const spec of MOVE_SPECS) {
    const delta = Math.round((cur[spec.key] ?? 0) - (prev[spec.key] ?? 0));
    if (delta > 0) moves.push({ key: spec.key, label: spec.line(delta), tone: spec.tone });
  }
  return moves;
}

const DAY_MS = 86_400_000;

/** Whole days between two ISO timestamps (0 if either is unparseable). */
export function daysBetween(fromISO: string | undefined, toISO: string): number {
  if (!fromISO) return 0;
  const a = Date.parse(fromISO), b = Date.parse(toISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / DAY_MS);
}

/**
 * Whether to roll the weekly baseline forward to now: when there's no baseline
 * yet, or the current one is at least `windowDays` old. Keeping the baseline
 * fixed within the window lets the digest accumulate the whole week's progress.
 */
export function shouldResetBaseline(prev: ProgressSnapshot | null | undefined, nowISO: string, windowDays = 7): boolean {
  if (!prev) return true;
  return daysBetween(prev.at, nowISO) >= windowDays;
}
