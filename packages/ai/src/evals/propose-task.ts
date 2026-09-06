import { registerEvalSuite, type EvalAssertion, type EvalCase } from "../eval-registry";
import type { ProposeTaskOutput } from "../prompts/propose-task";

/**
 * Golden evaluation suite for propose_task@1 - checks the prompt's own
 * "never a vague or generic task" instruction (spec §7.1's "suggest
 * experiments and actions grounded in current data") the only way
 * mechanically possible without a live model: a concrete title reflects
 * a keyword from the grounding instruction and isn't just a couple of
 * generic words.
 */

export function makeConcreteTaskAssertion(
  expectedKeyword: string,
): EvalAssertion<ProposeTaskOutput> {
  return (output) => {
    if (!output.task.title.toLowerCase().includes(expectedKeyword.toLowerCase())) {
      return `task title does not reflect the grounding instruction (expected mention of "${expectedKeyword}")`;
    }
    if (output.task.title.trim().split(/\s+/).length < 3) {
      return "task title is too short/generic to be a concrete action";
    }
    return null;
  };
}

const cases: EvalCase<ProposeTaskOutput>[] = [
  {
    name: "task title is concrete and grounded in a validation instruction",
    variables: {
      context: "Business stage: idea validation. No customer interviews conducted yet.",
      instruction: "Suggest a way to validate demand before building anything",
    },
    respond: () =>
      JSON.stringify({
        task: {
          title: "Run 5 customer interviews about the problem",
          description:
            "Talk to 5 prospective customers about the problem before building a solution.",
          priority: "high",
        },
        rationale:
          "No interviews have been conducted yet, and demand validation should come before build.",
      }),
    assertions: [makeConcreteTaskAssertion("interview")],
  },
  {
    name: "task title is concrete and grounded in a pricing instruction",
    variables: {
      context: "Business stage: early revenue. Current price has never been tested.",
      instruction: "Suggest a way to test whether the current price is too low",
    },
    respond: () =>
      JSON.stringify({
        task: {
          title: "Run a pricing experiment with a 10% increase",
          description: "Raise price by 10% for new customers for two weeks and compare conversion.",
          priority: "medium",
        },
        rationale: "The current price has never been tested against a higher alternative.",
      }),
    assertions: [makeConcreteTaskAssertion("pricing")],
  },
];

registerEvalSuite("propose_task", 1, cases);
