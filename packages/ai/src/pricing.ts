/**
 * PRD-AI-010 vertical slice: cost estimation (README "AI coaching" ->
 * "Cost and latency tracking", tenth slice of Phase 6; spec §39's "AI
 * budget" concern). Per §40's financial-assurance rule ("never invent
 * unverified financial figures"), this is explicitly an *estimate*, both
 * in its naming (estimateCostMicros) and everywhere its result is
 * stored/displayed - never authoritative billing. Real billing comes from
 * the provider's own usage report, not a client-side guess computed from
 * a hand-maintained price table that can drift out of date the moment a
 * provider changes pricing.
 *
 * Rates below were entered by hand from Anthropic's public per-model API
 * pricing as of this slice's implementation date (2026-09-05) - not
 * fetched live, so review/update them whenever pricing actually changes
 * rather than trusting they still match.
 *
 * Cost is tracked in USD micros (millionths of a dollar, i.e. 1,000,000
 * micros = $1) rather than cents, so per-token rates are exact integers
 * with no fractional-cent rounding on small calls - the same
 * "no floating point for money" reasoning as offers.priceCents, just a
 * finer-grained unit since a single AI call can cost a small fraction of
 * a cent.
 */

export interface ModelPricing {
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-5": { inputMicrosPerToken: 2, outputMicrosPerToken: 10 },
  "claude-opus-5": { inputMicrosPerToken: 5, outputMicrosPerToken: 25 },
  "claude-haiku-4-5-20251001": { inputMicrosPerToken: 1, outputMicrosPerToken: 5 },
};

/** Returns null for a model with no known pricing (e.g. "deterministic", "test-model", or a real model not yet added above) - never a fabricated 0, which would misleadingly imply the call was free. */
export function estimateCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = PRICING[model];
  if (!pricing) return null;
  return inputTokens * pricing.inputMicrosPerToken + outputTokens * pricing.outputMicrosPerToken;
}
