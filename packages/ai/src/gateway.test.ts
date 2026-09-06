import { describe, expect, it } from "vitest";
import { runCompletion } from "./gateway";
import { createDeterministicProvider } from "./providers/deterministic";
import { resetAiRateLimiterForTests, AiRateLimitExceededError } from "./rate-limit";
import type { AiProvider, CompletionRequest } from "./types";

const request: CompletionRequest = {
  model: "claude-sonnet-5",
  messages: [{ role: "user", content: "What is a good first offer?" }],
  maxTokens: 100,
};

describe("runCompletion", () => {
  it("returns the provider's result with a measured latency added", async () => {
    const provider = createDeterministicProvider();
    const result = await runCompletion(provider, request);

    expect(result.text).toContain("What is a good first offer?");
    expect(result.providerId).toBe("deterministic");
    expect(result.model).toBe(request.model);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("propagates a provider's failure rather than swallowing it", async () => {
    const failingProvider: AiProvider = {
      id: "failing",
      complete() {
        return Promise.reject(new Error("boom"));
      },
    };

    await expect(runCompletion(failingProvider, request)).rejects.toThrow("boom");
  });

  it("passes the exact request through to the provider", async () => {
    let received: CompletionRequest | undefined;
    const provider: AiProvider = {
      id: "spy",
      async complete(req) {
        received = req;
        return {
          text: "ok",
          stopReason: "end_turn",
          usage: { inputTokens: 1, outputTokens: 1 },
          model: req.model,
          providerId: "spy",
        };
      },
    };

    await runCompletion(provider, request);
    expect(received).toEqual(request);
  });

  it("rejects a call over its rate limit before the provider is ever invoked", async () => {
    resetAiRateLimiterForTests(1, 60_000);
    let callCount = 0;
    const provider: AiProvider = {
      id: "counting",
      async complete(req) {
        callCount += 1;
        return {
          text: "ok",
          stopReason: "end_turn",
          usage: { inputTokens: 1, outputTokens: 1 },
          model: req.model,
          providerId: "counting",
        };
      },
    };

    await runCompletion(provider, request, { rateLimitKey: "rate-limit-test-key" });
    await expect(
      runCompletion(provider, request, { rateLimitKey: "rate-limit-test-key" }),
    ).rejects.toThrow(AiRateLimitExceededError);
    expect(callCount).toBe(1);
  });

  it("skips the rate-limit check when no rateLimitKey is given", async () => {
    resetAiRateLimiterForTests(0, 60_000);
    const provider = createDeterministicProvider();
    await expect(runCompletion(provider, request)).resolves.toBeDefined();
  });
});
