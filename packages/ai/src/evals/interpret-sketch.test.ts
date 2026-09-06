import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";
import type { InterpretSketchOutput } from "../prompts/interpret-sketch";
import "../prompts/interpret-sketch";
import "./interpret-sketch";
import { mappingsReferenceObservedElements } from "./interpret-sketch";

describe("interpret_sketch golden evaluation suite", () => {
  it("every registered golden case passes", async () => {
    const template = getPromptTemplate<InterpretSketchOutput>("interpret_sketch", 1);
    if (!template) throw new Error("interpret_sketch@1 prompt template is not registered");
    const cases = getEvalSuite<InterpretSketchOutput>("interpret_sketch", 1);
    if (!cases) throw new Error("interpret_sketch@1 evaluation suite is not registered");

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(cases.length);
  });

  it("catches a mapping that references an element never observed in the sketch", async () => {
    const template = getPromptTemplate<InterpretSketchOutput>("interpret_sketch", 1);
    if (!template) throw new Error("interpret_sketch@1 prompt template is not registered");

    const report = await runEvalSuite(template, [
      {
        name: "invented element",
        variables: {
          description: "A box labeled Signup, with an arrow to a box labeled Purchase.",
        },
        respond: () =>
          JSON.stringify({
            observedElements: [
              { label: "Signup", kind: "box" },
              { label: "Purchase", kind: "box" },
            ],
            ambiguities: [],
            proposedLabels: ["Signup", "Purchase"],
            possibleMappings: [
              {
                elementLabel: "Signup",
                suggestedStructuredType: "funnel step",
                confidence: "medium",
              },
              { elementLabel: "Refund", suggestedStructuredType: "funnel step", confidence: "low" },
            ],
          }),
        assertions: [mappingsReferenceObservedElements],
      },
    ]);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/never observed/);
  });
});
