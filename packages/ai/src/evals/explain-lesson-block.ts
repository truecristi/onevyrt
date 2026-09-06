import { registerEvalSuite, type EvalAssertion, type EvalCase } from "../eval-registry";
import type { ExplainCalculationOutput } from "../prompts/explain-calculation";

/**
 * Golden evaluation suite for explain_lesson_block@1 - reuses
 * ExplainCalculationOutput (see prompts/explain-lesson-block.ts's doc
 * comment on why) and checks the same "factual grounding" property as
 * explain_calculation's own suite: does the explanation actually
 * reference the lesson content it was asked to explain.
 */

export function makeReferencesContentAssertion(
  keyword: string,
): EvalAssertion<ExplainCalculationOutput> {
  return (output) =>
    output.explanation.toLowerCase().includes(keyword.toLowerCase())
      ? null
      : `explanation does not reference the lesson content it was asked to explain (expected mention of "${keyword}")`;
}

const cases: EvalCase<ExplainCalculationOutput>[] = [
  {
    name: "grounded explanation references the lesson content",
    variables: {
      lessonTitle: "Unit economics basics",
      blockType: "paragraph",
      content: "Contribution margin is price minus variable cost per unit.",
    },
    respond: () =>
      JSON.stringify({
        explanation:
          "Contribution margin is simply your price minus what it costs you to make one more unit - it tells you how much of each sale goes toward covering your fixed costs.",
        keyTakeaway:
          "A higher contribution margin means each sale does more work for your business.",
      }),
    assertions: [makeReferencesContentAssertion("contribution margin")],
  },
  {
    name: "grounded explanation references different lesson content",
    variables: {
      lessonTitle: "Growth channels",
      blockType: "paragraph",
      content: "Customer acquisition cost is total spend divided by customers acquired.",
    },
    respond: () =>
      JSON.stringify({
        explanation:
          "Your customer acquisition cost is what you spend, on average, to win one new customer.",
        keyTakeaway: "Compare this to what a customer is worth over time before increasing spend.",
      }),
    assertions: [makeReferencesContentAssertion("customer acquisition cost")],
  },
];

registerEvalSuite("explain_lesson_block", 1, cases);
