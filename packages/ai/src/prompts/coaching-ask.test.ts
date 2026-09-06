import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { runPrompt } from "../run-prompt";
import { createDeterministicProvider } from "../providers/deterministic";
import type { CoachingAskOutput } from "./coaching-ask";
import "./coaching-ask";

describe("coaching_ask prompt template", () => {
  it("is registered under key coaching_ask, version 1", () => {
    expect(getPromptTemplate("coaching_ask", 1)).toBeDefined();
  });

  it("renders the assembled context and question into the user message", () => {
    const template = getPromptTemplate("coaching_ask", 1);
    const rendered = template?.render({
      context: "Business profile: Alice Co",
      question: "Should I raise my prices?",
    });
    expect(rendered?.user).toContain("Business profile: Alice Co");
    expect(rendered?.user).toContain("Should I raise my prices?");
  });

  it("renders a placeholder when no context was assembled", () => {
    const template = getPromptTemplate("coaching_ask", 1);
    const rendered = template?.render({ question: "What should I do?" });
    expect(rendered?.user).toContain("Business context: (none)");
  });

  it("validates a well-formed model response end to end via runPrompt", async () => {
    const template = getPromptTemplate<CoachingAskOutput>("coaching_ask", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          answer: "Based on your margins, a modest price increase looks supportable.",
          followUpQuestion: "Have you tested a higher price with new customers yet?",
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { context: "Business profile: Alice Co", question: "Should I raise my prices?" },
      { model: "test-model" },
    );

    expect(output.answer.length).toBeGreaterThan(0);
    expect(output.followUpQuestion).not.toBeNull();
  });

  it("accepts a null followUpQuestion", async () => {
    const template = getPromptTemplate<CoachingAskOutput>("coaching_ask", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () => JSON.stringify({ answer: "That looks correct.", followUpQuestion: null }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { question: "Is my math right?" },
      { model: "test-model" },
    );

    expect(output.followUpQuestion).toBeNull();
  });
});
