import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { runPrompt } from "../run-prompt";
import { createDeterministicProvider } from "../providers/deterministic";
import type { ExplainCalculationOutput } from "./explain-calculation";
import "./explain-lesson-block";

describe("explain_lesson_block prompt template", () => {
  it("is registered under key explain_lesson_block, version 1", () => {
    expect(getPromptTemplate("explain_lesson_block", 1)).toBeDefined();
  });

  it("renders the lesson title, block type and content into the user message", () => {
    const template = getPromptTemplate("explain_lesson_block", 1);
    const rendered = template?.render({
      lessonTitle: "Contribution margin",
      blockType: "concept",
      content: "explanation: price minus variable cost",
    });
    expect(rendered?.user).toContain("Contribution margin");
    expect(rendered?.user).toContain("concept");
    expect(rendered?.user).toContain("price minus variable cost");
  });

  it("validates a well-formed model response end to end via runPrompt", async () => {
    const template = getPromptTemplate<ExplainCalculationOutput>("explain_lesson_block", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          explanation: "Contribution margin is what's left after variable costs.",
          keyTakeaway: "Higher contribution margin means more room to cover fixed costs.",
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { lessonTitle: "Contribution margin", blockType: "concept", content: "..." },
      { model: "test-model" },
    );

    expect(output.explanation.length).toBeGreaterThan(0);
    expect(output.keyTakeaway.length).toBeGreaterThan(0);
  });
});
