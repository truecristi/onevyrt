/**
 * Benchmark Library: rough, widely-cited industry-default ranges for common
 * funnel step types, so a user starting from scratch has something realistic
 * to compare their assumption against instead of guessing blind. These are
 * deliberately wide, round-number ranges — general defaults, not a claim of
 * measured/sourced statistics for any specific market or price point.
 */
export interface BenchmarkRange {
  low: number;     // 0..1
  typical: number; // 0..1
  high: number;    // 0..1
}

export type BenchmarkKey =
  | "landingPage" | "optIn" | "salesPage" | "checkout" | "upsell"
  | "webinarShowUp" | "webinarClose" | "applicationForm" | "bookedCall";

export const BENCHMARK_LABELS: Record<BenchmarkKey, string> = {
  landingPage: "Landing page", optIn: "Opt-in / squeeze page", salesPage: "Sales page / VSL",
  checkout: "Checkout / order form", upsell: "Upsell / order bump",
  webinarShowUp: "Webinar show-up rate", webinarClose: "Webinar close rate",
  applicationForm: "Application form", bookedCall: "Booked call → close rate",
};

export const BENCHMARKS: Record<BenchmarkKey, BenchmarkRange> = {
  landingPage:    { low: 0.10, typical: 0.25, high: 0.40 },
  optIn:          { low: 0.20, typical: 0.35, high: 0.50 },
  salesPage:      { low: 0.05, typical: 0.15, high: 0.30 },
  checkout:       { low: 0.01, typical: 0.03, high: 0.06 },
  upsell:         { low: 0.10, typical: 0.25, high: 0.40 },
  webinarShowUp:  { low: 0.20, typical: 0.35, high: 0.50 },
  webinarClose:   { low: 0.02, typical: 0.05, high: 0.10 },
  applicationForm:{ low: 0.10, typical: 0.20, high: 0.35 },
  bookedCall:     { low: 0.15, typical: 0.30, high: 0.50 },
};

/** Guesses which benchmark applies from the node's own label — the same
 *  label-sniffing approach the canvas mockup preview already uses, so a
 *  renamed node ("Webinar Replay" -> webinarShowUp) still gets a sensible
 *  comparison without the user having to categorize anything manually. */
export function inferBenchmarkKey(label: string, kind: "step" | "offer"): BenchmarkKey {
  const l = label.toLowerCase();
  if (kind === "offer") {
    if (/upsell|bump|one.?time/.test(l)) return "upsell";
    return "checkout";
  }
  if (/webinar/.test(l) && /(close|buy|purchase)/.test(l)) return "webinarClose";
  if (/webinar|live class|masterclass/.test(l)) return "webinarShowUp";
  if (/application|apply|qualify/.test(l)) return "applicationForm";
  if (/call|booking|appointment|consult/.test(l)) return "bookedCall";
  if (/opt.?in|squeeze|lead capture|signup|sign.?up/.test(l)) return "optIn";
  if (/sales page|vsl|pitch/.test(l)) return "salesPage";
  return "landingPage";
}

export type BenchmarkVerdict = "below" | "typical" | "above";

export interface BenchmarkComparison {
  key: BenchmarkKey;
  label: string;
  range: BenchmarkRange;
  value: number;
  verdict: BenchmarkVerdict;
}

/** value is 0..1 (a passRate or conversionRate). */
export function compareToBenchmark(value: number, key: BenchmarkKey): BenchmarkComparison {
  const range = BENCHMARKS[key];
  const verdict: BenchmarkVerdict = value < range.low ? "below" : value > range.high ? "above" : "typical";
  return { key, label: BENCHMARK_LABELS[key], range, value, verdict };
}
