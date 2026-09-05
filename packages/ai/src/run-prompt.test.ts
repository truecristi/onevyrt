import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runPrompt, PromptOutputValidationError } from "./run-prompt";
import { createDeterministicProvider } from "./providers/deterministic";
import type { PromptTemplate } from "./prompt-registry";
import type { AiProvider } from "./types";

const outputSchema = z.object({ answer: z.string() });

const template: PromptTemplate<z.infer<typeof outputSchema>> = {
  key: "test_run_prompt",
  version: 1,
  defaultMaxTokens: 100,
  outputSchema,
  render: (variables) => ({
    system: "You are a test.",
    user: `Question: ${variables.question}`,
  }),
};

describe("runPrompt", () => {
  it("parses and validates a well-formed JSON response", async () => {
    const provider = createDeterministicProvider({
      respond: () => JSON.stringify({ answer: "42" }),
    });

    const { output, completion } = await runPrompt(
      provider,
      template,
      { question: "life, the universe and everything" },
      { model: "test-model" },
    );

    expect(output).toEqual({ answer: "42" });
    expect(completion.providerId).toBe("deterministic");
  });

  it("throws PromptOutputValidationError when the response isn't valid JSON", async () => {
    const provider = createDeterministicProvider({ respond: () => "not json" });

    await expect(
      runPrompt(provider, template, { question: "x" }, { model: "test-model" }),
    ).rejects.toThrow(PromptOutputValidationError);
  });

  it("throws PromptOutputValidationError when JSON doesn't match the schema", async () => {
    const provider = createDeterministicProvider({
      respond: () => JSON.stringify({ wrongField: true }),
    });

    await expect(
      runPrompt(provider, template, { question: "x" }, { model: "test-model" }),
    ).rejects.toThrow(PromptOutputValidationError);
  });

  it("uses the template's defaultMaxTokens when the caller doesn't override it", async () => {
    let capturedMaxTokens: number | undefined;
    const provider: AiProvider = {
      id: "spy",
      async complete(request) {
        capturedMaxTokens = request.maxTokens;
        return {
          text: JSON.stringify({ answer: "ok" }),
          stopReason: "end_turn",
          usage: { inputTokens: 1, outputTokens: 1 },
          model: "test-model",
          providerId: "spy",
        };
      },
    };

    await runPrompt(provider, template, { question: "x" }, { model: "test-model" });
    expect(capturedMaxTokens).toBe(100);
  });
});
