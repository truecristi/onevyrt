import { RateLimiter } from "@onevyrt/security";

/**
 * PRD-AI-009 vertical slice: AI safety checks (README "AI coaching" ->
 * "Safety checks", ninth slice of Phase 6; spec §39's cost/rate-limit
 * concern - "AI budget and fallback" is explicitly named as an open
 * decision there). Every AI call goes through runCompletion (gateway.ts)
 * - this is the one choke point, so rate limiting lives here rather than
 * requiring every route to remember to apply it itself.
 *
 * Same in-memory, single-instance RateLimiter (@onevyrt/security) the
 * auth routes already use for login/registration (§11) - not durable,
 * the same documented placeholder until a shared store is needed, not a
 * new limitation invented for AI specifically.
 *
 * Checked *before* the provider is ever called - a rate-limited request
 * never reaches a paid API, which is the whole point: this protects cost
 * and abuse exposure, not just perceived fairness.
 */

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let limiter = new RateLimiter(DEFAULT_LIMIT, DEFAULT_WINDOW_MS);

export class AiRateLimitExceededError extends Error {
  constructor(key: string) {
    super(`AI call rate limit exceeded for ${key}`);
    this.name = "AiRateLimitExceededError";
  }
}

/** Throws AiRateLimitExceededError if `key` is over its limit; otherwise records the attempt and returns. */
export function checkAiRateLimit(key: string): void {
  if (!limiter.check(key)) {
    throw new AiRateLimitExceededError(key);
  }
}

/** Test-only: swap in a fresh limiter (optionally with different limits) so tests don't share state with each other or have to wait out the real window. */
export function resetAiRateLimiterForTests(
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): void {
  limiter = new RateLimiter(limit, windowMs);
}
