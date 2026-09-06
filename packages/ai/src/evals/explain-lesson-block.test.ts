import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";
import type { ExplainCalculationOutput } from "../prompts/explain-calculation";
import "../prompts/explain-lesson-block";
import "./explain-lesson-block";
import { makeReferencesContentAssertion } from "./explain-lesson-block";

describe("explain_lesson_block golden evaluation suite", () => {
  it("every registered golden case passes", async () => {
    const template = getPromptTemplate<ExplainCalculationOutput>("explain_lesson_block", 1);
    if (!template) throw new Error("explain_lesson_block@1 prompt template is not registered");
    const cases = getEvalSuite<ExplainCalculationOutput>("explain_lesson_block", 1);
    if (!cases) throw new Error("explain_lesson_block@1 evaluation suite is not registered");

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(cases.length);
  });

  it("catches an explanation unrelated to the lesson content it was asked to explain", async () => {
    const template = getPromptTemplate<ExplainCalculationOutput>("explain_lesson_block", 1);
    if (!template) throw new Error("explain_lesson_block@1 prompt template is not registered");

    const report = await runEvalSuite(template, [
      {
        name: "unrelated explanation",
        variables: {
          lessonTitle: "Unit economics basics",
          blockType: "paragraph",
          content: "Contribution margin is price minus variable cost per unit.",
        },
        respond: () =>
          JSON.stringify({
            explanation: "Marketing is how you get the word out about your business.",
            keyTakeaway: "Try posting on social media.",
          }),
        assertions: [makeReferencesContentAssertion("contribution margin")],
      },
    ]);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/does not reference/);
  });
});
