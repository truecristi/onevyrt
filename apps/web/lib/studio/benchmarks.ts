/**
 * Rough industry benchmark bands for funnel-stage conversion, so a block can
 * tell the user "your 4% is below the ~8-15% typical for an opt-in page" — a
 * gut-check, not gospel. Ranges are deliberately wide and conservative; they
 * follow the commonly-cited DigitalMarketer / funnel norms for cold-to-warm
 * traffic. Pure and dependency-free so it's unit-testable.
 */
export type BenchBand = "below" | "typical" | "above";

export interface Benchmark {
  /** the metric this block is judged on */
  metric: "passRate" | "conversionRate" | "yesRate";
  low: number; // 0..1 — bottom of the "typical" band
  high: number; // 0..1 — top of the "typical" band
  label: string; // human name for the stage
}

/** The typical band per page kind. Only page-like kinds have one. */
export const BENCHMARKS: Record<string, Benchmark> = {
  // Opt-in / lead-capture pages convert a healthy share of targeted traffic.
  step: { metric: "passRate", low: 0.08, high: 0.4, label: "opt-in / lead page" },
  // Cold sales pages convert low single digits; warm audiences push higher.
  offer: { metric: "conversionRate", low: 0.01, high: 0.1, label: "sales page" },
  // Yes/no branches (e.g. tripwire take rate) sit in a broad middle band.
  split: { metric: "yesRate", low: 0.1, high: 0.4, label: "decision / take-rate" },
};

export interface BenchmarkResult {
  band: BenchBand;
  rate: number; // 0..1 the block's own rate
  low: number;
  high: number;
  label: string;
  message: string;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Judge a block's rate against its stage benchmark. Returns null when the kind
 *  has no benchmark or the rate is missing. */
export function benchmarkFor(kind: string, rate: number | undefined): BenchmarkResult | null {
  const b = BENCHMARKS[kind];
  if (!b || typeof rate !== "number" || !Number.isFinite(rate)) return null;
  const band: BenchBand = rate < b.low ? "below" : rate > b.high ? "above" : "typical";
  const range = `${pct(b.low)}–${pct(b.high)}`;
  const message =
    band === "below" ? `${pct(rate)} is below the ~${range} typical for a ${b.label}.`
    : band === "above" ? `${pct(rate)} is above the ~${range} typical for a ${b.label} — strong, or optimistic?`
    : `${pct(rate)} sits in the ~${range} typical for a ${b.label}.`;
  return { band, rate, low: b.low, high: b.high, label: b.label, message };
}
