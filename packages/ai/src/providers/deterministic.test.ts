import { describe, expect, it } from "vitest";
import { createDeterministicProvider } from "./deterministic";
import type { CompletionRequest } from "../types";

describe("createDeterministicProvider", () => {
  it("echoes the last user message by default, prefixed as obviously not a real model", async () => {
    const provider = createDeterministicProvider();
    const request: CompletionRequest = {
      model: "any-model",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "reply" },
        { role: "user", content: "second" },
      ],
      maxTokens: 50,
    };

    const result = await provider.complete(request);
    expect(result.text).toBe("[deterministic] second");
    expect(result.providerId).toBe("deterministic");
    expect(result.stopReason).toBe("end_turn");
  });

  it("uses a custom respond function when given one", async () => {
    const provider = createDeterministicProvider({ respond: () => "fixed answer" });
    const result = await provider.complete({
      model: "any-model",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 50,
    });
    expect(result.text).toBe("fixed answer");
  });

  it("reports zero tokens for empty content and non-zero for real content", async () => {
    const provider = createDeterministicProvider({ respond: () => "" });
    const empty = await provider.complete({
      model: "any-model",
      messages: [{ role: "user", content: "" }],
      maxTokens: 50,
    });
    expect(empty.usage.outputTokens).toBe(0);

    const withContent = createDeterministicProvider({ respond: () => "several words here" });
    const result = await withContent.complete({
      model: "any-model",
      messages: [{ role: "user", content: "some input words" }],
      maxTokens: 50,
    });
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });
});
