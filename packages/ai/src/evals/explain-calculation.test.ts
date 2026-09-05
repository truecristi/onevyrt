import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";
import type { ExplainCalculationOutput } from "../prompts/explain-calculation";
import "../prompts/explain-calculation";
import "./explain-calculation";
import { makeMentionsValueAssertion } from "./explain-calculation";

describe("explain_calculation golden evaluation suite", () => {
  it("every registered golden case passes", async () => {
    const template = getPromptTemplate<ExplainCalculationOutput>("explain_calculation", 1);
    if (!template) throw new Error("explain_calculation@1 prompt template is not registered");
    const cases = getEvalSuite<ExplainCalculationOutput>("explain_calculation", 1);
    if (!cases) throw new Error("explain_calculation@1 evaluation suite is not registered");

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(cases.length);
  });

  it("catches an explanation that invents a different figure than the one given", async () => {
    const template = getPromptTemplate<ExplainCalculationOutput>("explain_calculation", 1);
    if (!template) throw new Error("explain_calculation@1 prompt template is not registered");

    const report = await runEvalSuite(template, [
      {
        name: "ungrounded figure",
        variables: { label: "Gross margin", value: "18%", context: "" },
        respond: () =>
          JSON.stringify({
            explanation: "Your gross margin is strong at 45%, well above the industry average.",
            keyTakeaway: "Keep doing what you're doing.",
          }),
        assertions: [makeMentionsValueAssertion("18%")],
      },
    ]);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/not grounded/);
  });
});
