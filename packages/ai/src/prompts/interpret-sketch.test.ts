import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { runPrompt } from "../run-prompt";
import { createDeterministicProvider } from "../providers/deterministic";
import type { InterpretSketchOutput } from "./interpret-sketch";
import "./interpret-sketch";

describe("interpret_sketch prompt template", () => {
  it("is registered under key interpret_sketch, version 1", () => {
    expect(getPromptTemplate("interpret_sketch", 1)).toBeDefined();
  });

  it("renders the sketch description into the user message", () => {
    const template = getPromptTemplate("interpret_sketch", 1);
    const rendered = template?.render({
      description: "A box labeled 'Leads' with an arrow to a box labeled 'Customers'",
    });
    expect(rendered?.user).toContain("Leads");
    expect(rendered?.user).toContain("Customers");
  });

  it("validates a well-formed model response end to end via runPrompt", async () => {
    const template = getPromptTemplate<InterpretSketchOutput>("interpret_sketch", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          observedElements: [
            { label: "Leads", kind: "box" },
            { label: "Customers", kind: "box" },
          ],
          ambiguities: ["Unclear whether the arrow represents a conversion rate or a manual step"],
          proposedLabels: ["Lead pool", "Paying customers"],
          possibleMappings: [
            {
              elementLabel: "Leads",
              suggestedStructuredType: "funnel step",
              confidence: "medium",
            },
          ],
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { description: "A box labeled 'Leads' with an arrow to a box labeled 'Customers'" },
      { model: "test-model" },
    );

    expect(output.observedElements).toHaveLength(2);
    expect(output.ambiguities.length).toBeGreaterThan(0);
    expect(output.possibleMappings[0]?.confidence).toBe("medium");
  });

  it("accepts an empty interpretation (nothing observed, no ambiguities)", async () => {
    const template = getPromptTemplate<InterpretSketchOutput>("interpret_sketch", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          observedElements: [],
          ambiguities: [],
          proposedLabels: [],
          possibleMappings: [],
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { description: "" },
      { model: "test-model" },
    );
    expect(output.observedElements).toEqual([]);
  });

  it("rejects a response with an invalid confidence value", async () => {
    const template = getPromptTemplate<InterpretSketchOutput>("interpret_sketch", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          observedElements: [],
          ambiguities: [],
          proposedLabels: [],
          possibleMappings: [
            { elementLabel: "x", suggestedStructuredType: "y", confidence: "certain" },
          ],
        }),
    });

    await expect(
      runPrompt(provider, template, { description: "x" }, { model: "test-model" }),
    ).rejects.toThrow();
  });
});
