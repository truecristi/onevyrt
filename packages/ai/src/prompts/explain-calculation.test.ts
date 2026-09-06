import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { runPrompt } from "../run-prompt";
import { createDeterministicProvider } from "../providers/deterministic";
import type { ExplainCalculationOutput } from "./explain-calculation";
import "./explain-calculation";

describe("explain_calculation prompt template", () => {
  it("is registered under key explain_calculation, version 1", () => {
    const template = getPromptTemplate("explain_calculation", 1);
    expect(template).toBeDefined();
  });

  it("renders the metric label, value and optional context into the user message", () => {
    const template = getPromptTemplate("explain_calculation", 1);
    const rendered = template?.render({
      label: "Gross margin",
      value: "42%",
      context: "Industry benchmark is 60%",
    });
    expect(rendered?.user).toContain("Gross margin");
    expect(rendered?.user).toContain("42%");
    expect(rendered?.user).toContain("Industry benchmark is 60%");
  });

  it("omits the context line when none is given", () => {
    const template = getPromptTemplate("explain_calculation", 1);
    const rendered = template?.render({ label: "CAC", value: "$50" });
    expect(rendered?.user).not.toContain("Context:");
  });

  it("validates a well-formed model response end to end via runPrompt", async () => {
    const template = getPromptTemplate<ExplainCalculationOutput>("explain_calculation", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          explanation: "Your gross margin is below the typical benchmark for this industry.",
          keyTakeaway: "Look for ways to raise price or cut cost of goods sold.",
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { label: "Gross margin", value: "42%" },
      { model: "test-model" },
    );

    expect(output.explanation.length).toBeGreaterThan(0);
    expect(output.keyTakeaway.length).toBeGreaterThan(0);
  });
});
