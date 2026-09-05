import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";
import type { CoachingAskOutput } from "../prompts/coaching-ask";
import "../prompts/coaching-ask";
import "./coaching-ask";
import { answerIsGroundedOrUncertain } from "./coaching-ask";

describe("coaching_ask golden evaluation suite", () => {
  it("every registered golden case passes", async () => {
    const template = getPromptTemplate<CoachingAskOutput>("coaching_ask", 1);
    if (!template) throw new Error("coaching_ask@1 prompt template is not registered");
    const cases = getEvalSuite<CoachingAskOutput>("coaching_ask", 1);
    if (!cases) throw new Error("coaching_ask@1 evaluation suite is not registered");

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(cases.length);
  });

  it("catches a confident, ungrounded fabrication", async () => {
    const template = getPromptTemplate<CoachingAskOutput>("coaching_ask", 1);
    if (!template) throw new Error("coaching_ask@1 prompt template is not registered");

    const report = await runEvalSuite(template, [
      {
        name: "fabricated figure",
        variables: { context: "(none)", question: "What is my monthly revenue?" },
        respond: () =>
          JSON.stringify({ answer: "Your monthly revenue is $50,000.", followUpQuestion: null }),
        assertions: [answerIsGroundedOrUncertain(null)],
      },
    ]);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/does not acknowledge/);
  });
});
