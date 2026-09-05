import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";
import type { ProposeTaskOutput } from "../prompts/propose-task";
import "../prompts/propose-task";
import "./propose-task";
import { makeConcreteTaskAssertion } from "./propose-task";

describe("propose_task golden evaluation suite", () => {
  it("every registered golden case passes", async () => {
    const template = getPromptTemplate<ProposeTaskOutput>("propose_task", 1);
    if (!template) throw new Error("propose_task@1 prompt template is not registered");
    const cases = getEvalSuite<ProposeTaskOutput>("propose_task", 1);
    if (!cases) throw new Error("propose_task@1 evaluation suite is not registered");

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(cases.length);
  });

  it("catches a vague, generic task title", async () => {
    const template = getPromptTemplate<ProposeTaskOutput>("propose_task", 1);
    if (!template) throw new Error("propose_task@1 prompt template is not registered");

    const report = await runEvalSuite(template, [
      {
        name: "vague title",
        variables: {
          context: "Business stage: idea validation. No customer interviews conducted yet.",
          instruction: "Suggest a way to validate demand before building anything",
        },
        respond: () =>
          JSON.stringify({
            task: { title: "Do better", description: "", priority: "medium" },
            rationale: "This will help the business grow.",
          }),
        assertions: [makeConcreteTaskAssertion("interview")],
      },
    ]);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toBeDefined();
  });
});
