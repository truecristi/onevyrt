import { registerEvalSuite, type EvalAssertion, type EvalCase } from "../eval-registry";
import type { ExplainCalculationOutput } from "../prompts/explain-calculation";

/**
 * Golden evaluation suite for explain_calculation@1 (spec §5.4's "factual
 * grounding" property). Both cases here are expected to pass - this is
 * the regression gate a prompt or model change must keep passing (see
 * evals/run-all.test.ts). `makeMentionsValueAssertion` is exported so
 * explain-calculation.eval.test.ts can also prove the same check
 * correctly fails an ungrounded answer, without duplicating the logic.
 */

export function makeMentionsValueAssertion(value: string): EvalAssertion<ExplainCalculationOutput> {
  return (output) =>
    output.explanation.includes(value)
      ? null
      : `explanation does not mention the given value (${value}) - not grounded in the input`;
}

const cases: EvalCase<ExplainCalculationOutput>[] = [
  {
    name: "grounded explanation mentions the given value",
    variables: { label: "Gross margin", value: "18%", context: "" },
    respond: () =>
      JSON.stringify({
        explanation:
          "Your gross margin is 18%, meaning you keep 18 cents of every sales dollar after direct costs.",
        keyTakeaway:
          "Watch this number - a rising trend means your pricing or costs are improving.",
      }),
    assertions: [makeMentionsValueAssertion("18%")],
  },
  {
    name: "grounded explanation mentions a different given value",
    variables: { label: "Break-even point", value: "120 units", context: "" },
    respond: () =>
      JSON.stringify({
        explanation: "You need to sell 120 units before you start turning a profit.",
        keyTakeaway: "Every unit past 120 is where your business starts making money.",
      }),
    assertions: [makeMentionsValueAssertion("120 units")],
  },
];

registerEvalSuite("explain_calculation", 1, cases);
