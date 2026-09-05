import { describe, expect, it } from "vitest";
import {
  checkAiRateLimit,
  resetAiRateLimiterForTests,
  AiRateLimitExceededError,
} from "./rate-limit";

describe("checkAiRateLimit", () => {
  it("allows calls under the limit and throws once the limit is exceeded", () => {
    resetAiRateLimiterForTests(3, 60_000);

    expect(() => checkAiRateLimit("user-a")).not.toThrow();
    expect(() => checkAiRateLimit("user-a")).not.toThrow();
    expect(() => checkAiRateLimit("user-a")).not.toThrow();
    expect(() => checkAiRateLimit("user-a")).toThrow(AiRateLimitExceededError);
  });

  it("tracks limits independently per key", () => {
    resetAiRateLimiterForTests(1, 60_000);

    expect(() => checkAiRateLimit("user-a")).not.toThrow();
    expect(() => checkAiRateLimit("user-a")).toThrow(AiRateLimitExceededError);
    // A different key has its own, unaffected budget.
    expect(() => checkAiRateLimit("user-b")).not.toThrow();
  });
});
