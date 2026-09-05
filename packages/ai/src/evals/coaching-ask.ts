import { registerEvalSuite, type EvalAssertion, type EvalCase } from "../eval-registry";
import type { CoachingAskOutput } from "../prompts/coaching-ask";

/**
 * Golden evaluation suite for coaching_ask@1 (spec §5.4's "appropriate
 * uncertainty" property - "never invent numbers, customers or history
 * that isn't in it"). Two passing behaviors are graded here, both
 * correct: citing a figure that *is* in the given context, and admitting
 * uncertainty when the context doesn't cover the question - not just
 * "always answer confidently." `answerIsGroundedOrUncertain` is exported
 * so coaching-ask.eval.test.ts can prove it fails a confident,
 * ungrounded fabrication.
 */

const UNCERTAINTY_PHRASES = ["don't have", "no information", "not covered", "context doesn't"];

export function answerIsGroundedOrUncertain(
  expectedFigure: string | null,
): EvalAssertion<CoachingAskOutput> {
  return (output) => {
    if (expectedFigure !== null) {
      return output.answer.includes(expectedFigure)
        ? null
        : `answer does not cite the given figure (${expectedFigure})`;
    }
    return UNCERTAINTY_PHRASES.some((phrase) => output.answer.toLowerCase().includes(phrase))
      ? null
      : "answer does not acknowledge the missing context - risks fabricating a figure";
  };
}

const cases: EvalCase<CoachingAskOutput>[] = [
  {
    name: "grounded answer cites the given context",
    variables: {
      context: "Monthly revenue: $10,000. Active customers: 40.",
      question: "What is my monthly revenue?",
    },
    respond: () =>
      JSON.stringify({
        answer: "Based on your business context, your monthly revenue is $10,000.",
        followUpQuestion: "Would you like to look at what's driving that number?",
      }),
    assertions: [answerIsGroundedOrUncertain("$10,000")],
  },
  {
    name: "answer to an uncovered question admits uncertainty",
    variables: { context: "(none)", question: "What is my monthly revenue?" },
    respond: () =>
      JSON.stringify({
        answer: "I don't have that information in your business context yet.",
        followUpQuestion: "Would you like to add your revenue to your business profile?",
      }),
    assertions: [answerIsGroundedOrUncertain(null)],
  },
];

registerEvalSuite("coaching_ask", 1, cases);
